import { describe, expect, it } from "vitest";
import type { ApiClient } from "../src/api/client";
import { CallManager, type CallHost, type CallTarget } from "../src/call/manager";
import { audioProcessing, deafenChange, micLevel, SHARE_MODES, shareModeOf } from "../src/call/rules";
import { Store } from "../src/state/store";
import { MediaRig } from "./support/fakeMedia";

/** Batches B10 and B11 (android CallManager, ShareModeTest, PreCallCheckTest): deafen, listen-only, noise reduction, sharing. */
const call = (id: string) => ({ id, conversationId: "c1", createdBy: "me", video: false, state: "RINGING", createdAt: Date.now(), endedAt: null, endReason: null, conversationType: "DM" });

function setup(target: Partial<CallTarget> = {}, prefs = { noiseReduction: true, shareMode: "text" as const, shareAudio: false }) {
  const rig = new MediaRig();
  const api = {
    json: async (method: string, path: string, schema: { parse(v: unknown): unknown }) => {
      if (method === "POST" && path === "/v1/calls") return schema.parse({ call: call("k1"), media: { url: "ws://lk", token: "t", room: "r1" }, joinedExisting: false });
      throw new Error(`unexpected ${method} ${path}`);
    },
    call: async () => new Response(null, { status: 204 }),
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
  const calls = new CallManager(host, { media: rig.factory, supported: () => true, keyWaitMs: 500, callPrefs: () => prefs });
  return { calls, rig, host };
}

describe("call rules", () => {
  it("deafen mutes the microphone, and undeafening brings it back only if it was on", () => {
    expect(deafenChange(false, true, false)).toEqual({ deafened: true, micOn: false, micBeforeDeafen: true });
    expect(deafenChange(true, false, true)).toEqual({ deafened: false, micOn: true, micBeforeDeafen: true });
    expect(deafenChange(false, false, true)).toEqual({ deafened: true, micOn: false, micBeforeDeafen: false });
    expect(deafenChange(true, false, false).micOn).toBe(false);
  });

  it("share modes: text keeps 1080p sharp at 15 fps, motion keeps 720p smooth at 30 fps; unknown saves read as text", () => {
    expect(SHARE_MODES.text).toMatchObject({ width: 1920, height: 1080, frameRate: 15, maxBitrate: 2_500_000, degradation: "maintain-resolution" });
    expect(SHARE_MODES.motion).toMatchObject({ width: 1280, height: 720, frameRate: 30, maxBitrate: 3_500_000, degradation: "maintain-framerate" });
    expect(shareModeOf("motion")).toBe("motion");
    expect(shareModeOf("game")).toBe("text");
    expect(shareModeOf(null)).toBe("text");
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
    const { calls, rig, host } = setup({ voiceRoom: true, isGroup: true, listenOnly: true }, { noiseReduction: false, shareMode: "text", shareAudio: false });
    await calls.startCall("c1", false);
    expect(rig.last?.prepareOptions).toEqual({ noiseReduction: false, microphone: false });
    expect(host.state.get().call).toMatchObject({ listenOnly: true, micOn: false });
    await calls.toggleMicrophone();
    expect(rig.last?.mic).toBe(false);
  });

  it("shares with the chosen mode and sound, and says when someone else stops sharing", async () => {
    const { calls, rig, host } = setup();
    await calls.startCall("c1", false);
    await calls.toggleScreenShare({ mode: "motion", audio: true });
    expect(rig.last?.shareOptions).toEqual({ mode: "motion", audio: true });
    expect(host.state.get().call).toMatchObject({ shareMode: "motion", shareAudio: true });
    await calls.toggleScreenShare();
    expect(host.state.get().call).toMatchObject({ shareMode: null, shareAudio: false });
    rig.last?.events.shareEnded?.("Bo");
    expect(host.state.get().call.notice).toBe("Bo stopped sharing their screen");
  });
});
