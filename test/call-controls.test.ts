import { describe, expect, it } from "vitest";
import type { ApiClient } from "../src/api/client";
import { CallManager, type CallHost, type CallTarget } from "../src/call/manager";
import { audioProcessing, deafenChange, frameShape, micLevel } from "../src/call/rules";
import { SHARE_QUALITIES, type ShareQuality, shareQualityOf } from "../src/call/shareQuality";
import type { CallShareView } from "../src/call/shares";
import { Store } from "../src/state/store";
import { MediaRig } from "./support/fakeMedia";

/** Batches B10 and B11 (android CallManager, ShareModeTest, PreCallCheckTest): deafen, listen-only, noise reduction, sharing. */
const call = (id: string) => ({ id, conversationId: "c1", createdBy: "me", video: false, state: "RINGING", createdAt: Date.now(), endedAt: null, endReason: null, conversationType: "DM" });

const posted: string[] = [];

function setup(
  target: Partial<CallTarget> = {},
  prefs: { noiseReduction: boolean; shareQuality: ShareQuality; shareAudio: boolean } = { noiseReduction: true, shareQuality: "standard", shareAudio: false },
  maxScreenShares?: number,
) {
  const rig = new MediaRig();
  const api = {
    json: async (method: string, path: string, schema: { parse(v: unknown): unknown }) => {
      if (method === "POST" && path === "/v1/calls") return schema.parse({ call: call("k1"), media: { url: "ws://lk", token: "t", room: "r1" }, joinedExisting: false });
      throw new Error(`unexpected ${method} ${path}`);
    },
    call: async (method: string, path: string) => {
      posted.push(`${method} ${path}`);
      return new Response(null, { status: 204 });
    },
  } as unknown as ApiClient;
  const host: CallHost = {
    api,
    state: new Store(),
    me: { userId: "me", deviceId: "d1" },
    sendControlNow: async () => undefined,
    describe: async () => ({ title: "Bo", isGroup: false, colorIndex: 0, voiceRoom: false, canModerate: false, ...target }),
    displayName: () => null,
    recordCall: async () => undefined,
  };
  const calls = new CallManager(host, { media: rig.factory, supported: () => true, keyWaitMs: 500, callPrefs: () => prefs, maxScreenShares });
  return { calls, rig, host };
}

describe("call rules", () => {
  it("deafen mutes the microphone, and undeafening brings it back only if it was on", () => {
    expect(deafenChange(false, true, false)).toEqual({ deafened: true, micOn: false, micBeforeDeafen: true });
    expect(deafenChange(true, false, true)).toEqual({ deafened: false, micOn: true, micBeforeDeafen: true });
    expect(deafenChange(false, false, true)).toEqual({ deafened: true, micOn: false, micBeforeDeafen: false });
    expect(deafenChange(true, false, false).micOn).toBe(false);
  });

  it("share qualities: Standard is 1280×720 at 30 fps, High 1920×1080 at 60; anything else saved reads as Standard", () => {
    expect(SHARE_QUALITIES.standard).toMatchObject({ width: 1280, height: 720, frameRate: 30 });
    expect(SHARE_QUALITIES.high).toMatchObject({ width: 1920, height: 1080, frameRate: 60 });
    expect(shareQualityOf("high")).toBe("high");
    expect(shareQualityOf("motion")).toBe("standard");
    expect(shareQualityOf(null)).toBe("standard");
  });

  it("noise reduction turns noise suppression and level on or off, echo cancellation stays; the meter is the root of the RMS", () => {
    expect(audioProcessing(true)).toEqual({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });
    expect(audioProcessing(false)).toEqual({ echoCancellation: true, noiseSuppression: false, autoGainControl: false });
    expect(micLevel([])).toBe(0);
    expect(micLevel(new Float32Array(100))).toBe(0);
    expect(micLevel(new Float32Array(100).fill(1))).toBe(1);
    expect(micLevel(new Float32Array(100).fill(0.25))).toBeCloseTo(0.5);
  });
});

describe("call controls", () => {
  it("deafens and undeafens, restoring the microphone as it was", async () => {
    const { calls, rig, host } = setup();
    await calls.startCall("c1", false);
    expect(rig.last?.prepareOptions).toEqual({ noiseReduction: true, microphone: true });
    expect(host.state.get().call.micOn).toBe(true);
    await calls.toggleDeafen();
    expect(host.state.get().call).toMatchObject({ deafened: true, micOn: false });
    expect(rig.last).toMatchObject({ deafened: true, mic: false });
    await calls.toggleDeafen();
    expect(host.state.get().call).toMatchObject({ deafened: false, micOn: true });
    expect(rig.last).toMatchObject({ deafened: false, mic: true });
  });

  it("a listen-only voice channel opens no microphone and can't be unmuted", async () => {
    const { calls, rig, host } = setup({ voiceRoom: true, isGroup: true, listenOnly: true }, { noiseReduction: false, shareQuality: "standard", shareAudio: false });
    await calls.startCall("c1", false);
    expect(rig.last?.prepareOptions).toEqual({ noiseReduction: false, microphone: false });
    expect(host.state.get().call).toMatchObject({ listenOnly: true, micOn: false });
    await calls.toggleMicrophone();
    expect(rig.last?.mic).toBe(false);
  });

  it("shares with the chosen quality and sound, changes it during the share, and says when someone else stops", async () => {
    const { calls, rig, host } = setup();
    await calls.startCall("c1", false);
    await calls.toggleScreenShare({ quality: "high", audio: true });
    expect(rig.last?.shareOptions).toEqual({ quality: "high", audio: true });
    expect(host.state.get().call).toMatchObject({ shareQuality: "high", shareAudio: true, screenSharing: true });
    await calls.setShareQuality("standard");
    expect(rig.last?.qualityChanges).toEqual(["standard"]);
    expect(host.state.get().call.shareQuality).toBe("standard");
    rig.last?.events.shareStats?.({ quality: "standard", captured: { width: 1280, height: 720, frameRate: 30 }, sent: { width: 1280, height: 720, fps: 29 }, level: 0, limitation: "none" });
    expect(host.state.get().call.shareStats?.sent).toEqual({ width: 1280, height: 720, fps: 29 });
    await calls.toggleScreenShare();
    expect(host.state.get().call).toMatchObject({ shareQuality: null, shareAudio: false, shareStats: null });
    rig.last?.events.shareEnded?.("Bo");
    expect(host.state.get().call.notice).toBe("Bo stopped sharing their screen");
  });
});

const share = (identity: string, sid: string, isLocal = false): CallShareView => ({
  key: `${identity}#${sid}`,
  identity,
  userId: identity.split(".")[0],
  name: identity,
  isLocal,
  withAudio: false,
  ready: true,
});

describe("several screens shared at once (2026-10-24)", () => {
  it("watches the first share, keeps it when another starts, and moves on when it ends", async () => {
    const { calls, rig, host } = setup({ isGroup: true });
    await calls.startCall("c1", false);
    const media = rig.last!;
    media.remoteShares = [share("ann.d1", "TR_a")];
    media.events.changed();
    expect(host.state.get().call).toMatchObject({ watching: "ann.d1#TR_a" });
    expect(media.watched).toBe("ann.d1#TR_a");
    // A second share doesn't take over.
    media.remoteShares = [share("ann.d1", "TR_a"), share("bob.d2", "TR_b")];
    media.events.changed();
    expect(host.state.get().call.watching).toBe("ann.d1#TR_a");
    expect(host.state.get().call.shares.map((s) => s.key)).toEqual(["ann.d1#TR_a", "bob.d2#TR_b"]);
    // The viewer picks the other one: only this browser's view changes.
    calls.watchShare("bob.d2#TR_b");
    expect(media.watched).toBe("bob.d2#TR_b");
    // It ends: back to the remaining one.
    media.remoteShares = [share("ann.d1", "TR_a")];
    media.events.changed();
    expect(host.state.get().call.watching).toBe("ann.d1#TR_a");
    // All end: back to the people.
    media.remoteShares = [];
    media.events.changed();
    expect(host.state.get().call).toMatchObject({ watching: null, shares: [] });
    expect(media.watched).toBeNull();
  });

  it("keeps the people on screen after the viewer goes back to them, until they pick a share", async () => {
    const { calls, rig, host } = setup({ isGroup: true });
    await calls.startCall("c1", false);
    const media = rig.last!;
    media.remoteShares = [share("ann.d1", "TR_a")];
    media.events.changed();
    calls.watchShare(null);
    expect(host.state.get().call).toMatchObject({ watching: null, watchDismissed: true });
    media.remoteShares = [share("ann.d1", "TR_a"), share("bob.d2", "TR_b")];
    media.events.changed();
    expect(host.state.get().call.watching).toBeNull();
    calls.watchShare("bob.d2#TR_b");
    expect(host.state.get().call).toMatchObject({ watching: "bob.d2#TR_b", watchDismissed: false });
  });

  it("follows a presenter who shares again (a republish or rejoin gives a new track)", async () => {
    const { rig, host, calls } = setup({ isGroup: true });
    await calls.startCall("c1", false);
    const media = rig.last!;
    media.remoteShares = [share("ann.d1", "TR_a"), share("bob.d2", "TR_b")];
    media.events.changed();
    calls.watchShare("bob.d2#TR_b");
    media.remoteShares = [share("ann.d1", "TR_a"), share("bob.d2", "TR_b2")];
    media.events.changed();
    expect(host.state.get().call.watching).toBe("bob.d2#TR_b2");
  });

  it("refuses to start a share past the cap, and never watches your own", async () => {
    const { calls, rig, host } = setup({ isGroup: true }, undefined, 2);
    await calls.startCall("c1", false);
    const media = rig.last!;
    media.remoteShares = [share("ann.d1", "TR_a"), share("bob.d2", "TR_b")];
    media.events.changed();
    await calls.toggleScreenShare({ quality: "standard", audio: false });
    expect(media.screen).toBe(false);
    expect(host.state.get().call.notice).toMatch(/Up to 2 screens/);
    media.remoteShares = [share("ann.d1", "TR_a")];
    media.events.changed();
    await calls.toggleScreenShare({ quality: "standard", audio: false });
    expect(media.screen).toBe(true);
    expect(host.state.get().call.shares.some((s) => s.isLocal)).toBe(true);
    calls.watchShare("me.dev#TR_local");
    expect(host.state.get().call.watching).toBe("ann.d1#TR_a");
  });
});

describe("a shared screen's shape (screen-share crop fix, 2026-10-22)", () => {
  it("is portrait when taller than wide, landscape otherwise, unknown before the first frame", () => {
    expect(frameShape(540, 1170)).toBe("portrait");
    expect(frameShape(1920, 1080)).toBe("landscape");
    expect(frameShape(1000, 1000)).toBe("landscape");
    expect(frameShape(0, 0)).toBeNull();
  });
});

describe("one device per person in a call (API 0.31)", () => {
  it("leaves when the server says this person joined on another device, without ending the call for anyone", async () => {
    const { calls, host } = setup();
    await calls.startCall("c1", false);
    posted.length = 0;
    await calls.onCallEvent("ended", { ...call("k1"), state: "ACTIVE", endReason: "joined_elsewhere" } as never, {});
    expect(host.state.get().call).toMatchObject({ phase: "ended", endReason: "joined_elsewhere" });
    expect(posted.filter((p) => /\/(end|leave)$/.test(p))).toEqual([]);
  });

  it("when the room drops it first (removed by the server), it neither rejoins nor hangs up, and still says why", async () => {
    const { calls, rig, host } = setup();
    await calls.startCall("c1", false);
    posted.length = 0;
    rig.last!.events.disconnected("PARTICIPANT_REMOVED");
    expect(host.state.get().call).toMatchObject({ phase: "ended", endReason: "removed" });
    expect(posted.filter((p) => /\/(end|leave)$/.test(p))).toEqual([]);
    expect(rig.sessions).toHaveLength(1);
    await calls.onCallEvent("ended", { ...call("k1"), state: "ACTIVE", endReason: "joined_elsewhere" } as never, {});
    expect(host.state.get().call.endReason).toBe("joined_elsewhere");
  });
});
