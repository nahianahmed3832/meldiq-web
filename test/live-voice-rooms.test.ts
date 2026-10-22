import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { joinChannel } from "../src/sync/account";
import type { Engine } from "../src/sync/engine";
import { acceptInvite, createChannel, createInvitation, createWorkspace, requestId } from "../src/sync/workspaces";
import { roomPeople, voiceRooms } from "../src/ui/selectors";
import { MediaRig } from "./support/fakeMedia";
import { linkBrowser, type Phone, type Server, startServer, until } from "./support/live";

/**
 * Voice rooms (server docs/VOICE_ROOMS.md) from the browser against the real server, with the phone's reference client
 * as other people. A stand-in for LiveKit records which microphones a manager muted (as the server's own test does);
 * the browsers' media is the fake rig that records the key each joined with.
 */
class FakeLiveKit {
  publicUrl = "ws://livekit.test";
  muted: string[] = [];
  async token(p: { identity: string }) {
    return `token:${p.identity}`;
  }
  async deleteRoom() {}
  // Unknown here: the server falls back to its own record of who is connected.
  async participantIdentities() {
    return null;
  }
  async participantUsers() {
    return null;
  }
  async removeParticipant() {
    return "removed" as const;
  }
  async muteAudio(_room: string, identity: string) {
    this.muted.push(identity);
    return "muted" as const;
  }
}

let server: Server;
const lk = new FakeLiveKit();
let olivia: Phone; // owns the workspace, so manages the room
let max: Phone;
let carol: Phone;
let oliviaWeb: Engine;
let maxWeb: Engine;
const oliviaRig = new MediaRig();
const maxRig = new MediaRig();
let room: string;

const calling = (rig: MediaRig) => ({ media: rig.factory, callSupported: () => true, callTiming: { keyWaitMs: 6_000, peerWindowMs: 400, rejoinWindowMs: 5_000 } });
const key = () => crypto.randomBytes(32).toString("base64");

/** A phone enters the room's call as the Android app does: open or join it, then report its media connected. */
async function enter(p: Phone): Promise<string> {
  const r = await p.req("POST", "/v1/calls", { conversationId: room, video: false });
  await p.req("POST", `/v1/calls/${r.call.id}/connected`);
  return r.call.id as string;
}

beforeAll(async () => {
  server = await startServer({ CALL_PEER_GRACE_MS: "60000" });
  (server.ctx as unknown as { livekit: FakeLiveKit }).livekit = lk;
  olivia = await server.client("olivia", "Olivia");
  max = await server.client("max", "Max");
  carol = await server.client("carol", "Carol");
  for (const p of [olivia, max, carol]) await p.connect();
  oliviaWeb = (await linkBrowser(server, olivia, "Meldiq Web · Olivia", calling(oliviaRig))).engine;
  maxWeb = (await linkBrowser(server, max, "Meldiq Web · Max", calling(maxRig))).engine;
  const orgId = (await createWorkspace(oliviaWeb, "Voice Lab", null, requestId())).id;
  await acceptInvite(maxWeb, (await createInvitation(oliviaWeb, orgId, { role: "MEMBER", maxUses: 1, expiresInHours: 1 })).code);
  await carol.req("POST", "/v1/invites/accept", { code: (await createInvitation(oliviaWeb, orgId, { role: "MEMBER", maxUses: 1, expiresInHours: 1 })).code });
  room = (await createChannel(oliviaWeb, orgId, { name: "Lounge", topic: null, scope: "ORG", scopeId: null, kind: "PUBLIC", voice: true })).id;
  await joinChannel(maxWeb, room);
  await carol.req("POST", `/v1/conversations/${room}/join`);
  await until(() => maxWeb.state.get().conversations[room]?.voice === true, 8000, "the room in Max's browser");
});
afterAll(async () => {
  oliviaWeb?.stop();
  maxWeb?.stop();
  await server?.close();
});

describe("voice rooms", () => {
  it("is created as a voice room and listed under Home › Voice rooms", async () => {
    expect(oliviaWeb.state.get().server?.features).toContain("voice-rooms");
    const orgId = oliviaWeb.state.get().conversations[room]!.orgId;
    // Community servers also start every community with a voice channel of their own.
    expect(voiceRooms(maxWeb.state.get(), orgId).map((c) => c.id)).toContain(room);
    // Not an announcement channel.
    const e = await createChannel(oliviaWeb, orgId!, { name: "news", topic: null, scope: "ORG", scopeId: null, kind: "ANNOUNCEMENT", voice: true }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(400);
  });

  it("joining opens the room's call without ringing anyone; the next person joins the same call with the room's key", async () => {
    const before = carol.events.length;
    await oliviaWeb.calls.startCall(room, false);
    const callId = oliviaWeb.state.get().call.callId!;
    expect(oliviaWeb.state.get().call).toMatchObject({ phase: "connected", voiceRoom: true, canModerate: true });
    // The key went to the room's members inside an encrypted message; nobody's phone rang.
    const invite = await carol.waitFor(() => carol.received.find((m) => m.payload?.type === "call_invite" && m.payload.callId === callId), 8000);
    expect(invite.payload.e2eeKey).toBe(oliviaRig.last?.connected?.key);
    await carol.waitFor(() => carol.events.slice(before).find((e) => e.t === "call" && e.event === "started" && e.call?.id === callId), 8000);
    expect(carol.events.slice(before).some((e) => e.t === "call" && e.event === "ring")).toBe(false);
    // Who's in the room shows before joining it.
    await until(() => roomPeople(maxWeb.state.get(), room).includes(olivia.userId), 8000, "Olivia in the room, seen by Max");

    await maxWeb.calls.startCall(room, false);
    expect(maxWeb.state.get().call).toMatchObject({ phase: "connected", callId, voiceRoom: true, canModerate: false });
    expect(maxRig.last?.connected?.key).toBe(oliviaRig.last?.connected?.key);
    // Joining a room isn't a call in its history.
    expect((await oliviaWeb.conversationMessages(room)).some((m) => m.call)).toBe(false);
  });

  it("raised hands are queued in order; only the room's managers lower someone else's", async () => {
    const callId = maxWeb.state.get().call.callId!;
    await maxWeb.calls.raiseHand(true);
    expect(maxWeb.state.get().call.hands).toEqual([max.userId]);
    await until(() => oliviaWeb.state.get().call.hands.includes(max.userId), 8000, "Max's hand on Olivia's screen");
    // Max (a member) can't moderate: the server refuses, and the browser doesn't even offer it.
    expect(maxWeb.state.get().call.canModerate).toBe(false);
    const refused = await max.req("POST", `/v1/calls/${callId}/moderate`, { userId: olivia.userId, action: "lower_hand" }).catch((e: unknown) => e);
    expect(String((refused as Error)?.message ?? refused)).toMatch(/403|managers/);
    await oliviaWeb.calls.moderate(max.userId, "lower_hand");
    await until(() => maxWeb.state.get().call.hands.length === 0, 8000, "hand lowered on Max's screen");
    expect(maxWeb.state.get().call.notice).toMatch(/lowered your hand/);
  });

  it("a manager mutes someone's microphone (only they can turn it on) and removes them from the call", async () => {
    const maxDevice = maxWeb.device.deviceId;
    await oliviaWeb.calls.moderate(max.userId, "mute");
    expect(lk.muted).toContain(`${max.userId}.${maxDevice}`);
    await until(() => maxRig.last?.mic === false, 8000, "Max's microphone off in his browser");
    expect(maxWeb.state.get().call.notice).toMatch(/muted your microphone/);

    await oliviaWeb.calls.moderate(max.userId, "remove");
    await until(() => maxWeb.state.get().call.phase === "ended", 8000, "Max removed");
    expect(maxWeb.state.get().call.endReason).toBe("removed");
    // The room goes on for the others.
    expect(oliviaWeb.state.get().call.phase).toBe("connected");
    await until(() => maxWeb.state.get().call.phase === "idle", 8000, "Max's call screen cleared");
  });

  it("someone connected to the room passes its key on to a newcomer, and a key from someone connected is accepted", async () => {
    const callId = oliviaWeb.state.get().call.callId!;
    // Carol (on her phone) asks for the key: Olivia's browser answers because it's connected to the room's call.
    await enter(carol);
    await carol.send(room, { type: "call_key_request", callId }, "control");
    const answer = await carol.waitFor(() => carol.received.find((m) => m.payload?.type === "call_invite" && m.payload.callId === callId && m.senderUserId === olivia.userId && m !== undefined), 8000);
    expect(answer.payload.e2eeKey).toBe(oliviaRig.last?.connected?.key);

    // Olivia leaves; the room stays open with Carol in it (a room's call is left, never ended for everyone).
    oliviaWeb.calls.hangup();
    await until(() => oliviaWeb.state.get().call.phase === "idle", 8000, "Olivia out");
    expect((await carol.req("GET", `/v1/calls/${callId}`)).call.state).toBe("ACTIVE");

    // Max comes back: he asks, and Carol (not the call's creator, but connected) hands him the key, which he accepts.
    const joining = maxWeb.calls.startCall(room, false);
    const asked = await carol.waitFor(() => carol.received.find((m) => m.payload?.type === "call_key_request" && m.payload.callId === callId && m.senderUserId === max.userId), 8000);
    expect(asked.conversationId).toBe(room);
    const roomKey = answer.payload.e2eeKey as string;
    await carol.send(room, { type: "call_invite", callId, video: false, e2eeKey: roomKey }, "control");
    await joining;
    expect(maxWeb.state.get().call).toMatchObject({ phase: "connected", callId });
    expect(maxRig.last?.connected?.key).toBe(roomKey);
    // Someone who isn't connected can't give him a different one: the first accepted key stays.
    expect(maxWeb.calls.onInvite(callId, room, olivia.userId, key(), (await carol.req("GET", `/v1/calls/${callId}`)).call)).not.toBe("accepted");
    maxWeb.calls.hangup();
    await until(() => maxWeb.state.get().call.phase === "idle", 8000, "Max out");
  });
});
