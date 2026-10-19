import crypto from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { CallFailure } from "../src/call/rules";
import { isWellFormedKey, verificationCode } from "../src/call/callKeys";
import type { Engine } from "../src/sync/engine";
import { MediaRig } from "./support/fakeMedia";
import { linkBrowser, type Phone, type Server, startServer, TestNetwork, until } from "./support/live";

/**
 * The browser's calls against a real server started in-process, with reference clients (byte-compatible with the
 * Android app) as the account's phone and as other people. Media is a fake that records the key the browser joined
 * with; real encrypted media between a browser and a native LiveKit client is in e2e/calls.spec.ts.
 */
let server: Server;
let alice: Phone; // the account's phone; the browser is another device of alice
let bob: Phone;
let carol: Phone;
let web: Engine;
let net: TestNetwork;
let dm: string;
let dmCarol: string;
let group: string;
const rig = new MediaRig();

const key = () => crypto.randomBytes(32).toString("base64");
const callEvent = (p: Phone, callId: string, event: string) => p.waitFor(() => p.events.find((e) => e.t === "call" && e.event === event && e.call?.id === callId), 8000);
const phase = () => web.state.get().call.phase;
const idle = () => until(() => phase() === "idle", 8000, "call to clear");

/** Bob rings the browser's account and sends the media key as the Android app does. */
async function bobCalls(video = false, conversationId = dm, sendKey = true): Promise<{ id: string; key: string; media: { room: string } }> {
  const res = await bob.req("POST", "/v1/calls", { conversationId, video });
  const k = key();
  if (sendKey) await bob.send(conversationId, { type: "call_invite", callId: res.call.id, video, e2eeKey: k }, "control");
  return { id: res.call.id, key: k, media: res.media };
}

beforeAll(async () => {
  server = await startServer({ CALL_PEER_GRACE_MS: "60000" });
  alice = await server.client("alice", "Alice");
  bob = await server.client("bob", "Bob");
  carol = await server.client("carol", "Carol");
  dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  dmCarol = (await alice.req("POST", "/v1/conversations/dm", { userId: carol.userId })).conversation.id;
  group = (await bob.req("POST", "/v1/conversations/group", { name: "Team", memberIds: [alice.userId, carol.userId] })).conversation.id;
  await alice.connect();
  await bob.connect();
  await carol.connect();
  const linked = await linkBrowser(server, alice, "Orbit Web · Calls", {
    media: rig.factory,
    callSupported: () => true,
    callTiming: { keyWaitMs: 2_500, peerWindowMs: 400, rejoinWindowMs: 20_000 },
  });
  web = linked.engine;
  net = linked.net;
});

afterAll(async () => {
  web?.stop();
  await server?.close();
});

afterEach(async () => {
  if (phase() === "incoming") web.calls.decline();
  else if (phase() !== "idle" && phase() !== "ended") web.calls.hangup();
  for (const p of [alice, bob, carol]) for (const c of (await p.req("GET", "/v1/calls/active")).calls) await p.req("POST", `/v1/calls/${c.id}/end`).catch(() => undefined);
  await idle();
  rig.reset();
});

describe("answering a call from the phone app", () => {
  it("rings, tells the caller it's ringing, and joins with the key the caller sent", async () => {
    const c = await bobCalls(true);
    await until(() => phase() === "incoming", 8000, "ring");
    expect(web.state.get().call).toMatchObject({ callId: c.id, title: "Bob", video: true, isGroup: false });
    await callEvent(bob, c.id, "alerted"); // "Ringing…" on the caller's phone
    await until(() => web.calls.hasKey(c.id), 8000, "key");
    await web.calls.accept();
    expect(rig.last?.connected?.key).toBe(c.key);
    expect(rig.last?.connected?.grant.room).toBe(c.media.room);
    expect(rig.last?.prepared).toBe(true); // camera opened for a video call
    expect(web.state.get().call).toMatchObject({ phase: "connected", verification: await verificationCode(c.key, c.id) });
    await bob.req("POST", `/v1/calls/${c.id}/connected`);
    expect((await bob.req("GET", `/v1/calls/${c.id}`)).call.state).toBe("ACTIVE");
    await bob.req("POST", `/v1/calls/${c.id}/end`);
    await until(() => phase() === "ended", 8000, "end");
    expect(web.state.get().call.endReason).toBe("hangup");
    expect(rig.last?.disconnected).toBe(true);
    expect(web.calls.hasKey(c.id)).toBe(false); // keys leave memory with the call
  });

  it("refuses to join when the key doesn't arrive, after asking the caller for it", async () => {
    const c = await bobCalls(false, dm, false);
    await until(() => phase() === "incoming", 8000, "ring");
    const before = rig.sessions.length;
    await web.calls.accept();
    expect(web.state.get().call).toMatchObject({ phase: "ended", error: CallFailure.NO_KEY });
    expect(rig.sessions.slice(before).every((s) => s.connected === null)).toBe(true); // never joined the media room
    // The browser asked the call's creator to send the key again (T5.3), as a late joiner does.
    const asked = bob.received.find((m) => m.payload?.type === "call_key_request" && m.payload.callId === c.id);
    expect(asked?.senderUserId).toBe(alice.userId);
    await bob.req("POST", `/v1/calls/${c.id}/end`);
  });

  it("gets a missing key by asking the call's creator, and joins with it", async () => {
    const c = await bobCalls(false, dm, false);
    await until(() => phase() === "incoming", 8000, "ring");
    const joining = web.calls.accept();
    const request = await bob.waitFor(() => bob.received.find((m) => m.payload?.type === "call_key_request" && m.payload.callId === c.id), 8000);
    expect(request.conversationId).toBe(dm);
    await bob.send(dm, { type: "call_invite", callId: c.id, video: false, e2eeKey: c.key }, "control"); // the creator answers
    await joining;
    expect(rig.last?.connected?.key).toBe(c.key);
    expect(phase()).toBe("connected");
  });

  it("accepts a key only from the call's creator (T5.2)", async () => {
    const res = await bob.req("POST", "/v1/calls", { conversationId: group, video: false });
    const real = key();
    await carol.send(group, { type: "call_invite", callId: res.call.id, video: false, e2eeKey: key() }, "control"); // not the creator
    await until(() => phase() === "incoming", 8000, "ring");
    expect(web.state.get().call).toMatchObject({ isGroup: true, title: "Team", subtitle: "Bob is calling" });
    await web.idle();
    await new Promise((r) => setTimeout(r, 300));
    expect(web.calls.hasKey(res.call.id)).toBe(false);
    await bob.send(group, { type: "call_invite", callId: res.call.id, video: false, e2eeKey: real }, "control");
    await until(() => web.calls.hasKey(res.call.id), 8000, "creator's key");
    await web.calls.accept();
    expect(rig.last?.connected?.key).toBe(real);
    web.calls.hangup();
    await bob.req("POST", `/v1/calls/${res.call.id}/end`).catch(() => undefined);
  });

  it("declines: the caller's call ends as declined", async () => {
    const c = await bobCalls();
    await until(() => phase() === "incoming", 8000, "ring");
    web.calls.decline();
    expect(phase()).toBe("idle");
    const ended = await callEvent(bob, c.id, "ended");
    expect(ended.call.endReason).toBe("declined");
  });

  it("joins listen-only when the camera or microphone is refused, and says why", async () => {
    rig.issues = { microphone: "denied", camera: "missing" };
    const c = await bobCalls(true);
    await until(() => phase() === "incoming" && web.calls.hasKey(c.id), 8000, "ring and key");
    await web.calls.accept();
    expect(web.state.get().call).toMatchObject({ phase: "connected", micOn: false, cameraOn: false, devices: { microphone: "denied", camera: "missing" } });
    expect(rig.last?.connected?.key).toBe(c.key);
  });

  it("stops ringing when the account's phone answers, without an ended screen", async () => {
    const c = await bobCalls();
    await until(() => phase() === "incoming", 8000, "ring");
    await alice.req("POST", `/v1/calls/${c.id}/join`);
    await alice.req("POST", `/v1/calls/${c.id}/connected`); // the phone answered
    await until(() => phase() === "idle", 8000, "ringing to stop");
    expect(rig.sessions.filter((x) => x.connected?.grant.room === c.media.room)).toEqual([]);
  });

  it("rings after reconnecting for a call that started while this browser was offline", async () => {
    net.down = true;
    server.ctx.hub.disconnectDevice(web.device.deviceId, "test");
    await until(() => web.state.get().connection !== "online", 8000, "offline");
    const c = await bobCalls();
    net.down = false;
    web.reconnect();
    await until(() => phase() === "incoming", 10_000, "recovered ring");
    expect(web.state.get().call.callId).toBe(c.id);
    expect(web.calls.hasKey(c.id)).toBe(true);
    web.calls.decline();
  });
});

describe("calling from the browser", () => {
  it("sends a fresh 256-bit key only inside an encrypted message, never to storage, and joins with it", async () => {
    rig.remoteOnConnect = 0; // bob hasn't answered yet
    const starting = web.calls.startCall(dm, false);
    const invite = await bob.waitFor(() => bob.received.find((m) => m.payload?.type === "call_invite" && m.payload.callId === web.state.get().call.callId), 8000);
    await starting;
    const id = invite.payload.callId as string;
    const k = invite.payload.e2eeKey as string;
    expect(isWellFormedKey(k)).toBe(true);
    expect(invite.senderUserId).toBe(alice.userId);
    // The account's phone gets the same key (it's another device of the caller).
    expect((await alice.waitFor(() => alice.received.find((m) => m.payload?.type === "call_invite" && m.payload.callId === id))).payload.e2eeKey).toBe(k);
    expect(rig.last?.connected?.key).toBe(k);
    expect(web.state.get().call).toMatchObject({ phase: "outgoing", alerted: false });
    expect(await web.store.message(`call-${id}`)).toMatchObject({ kind: "call", outgoing: true });
    await expectNotStored(k);

    await bob.req("POST", `/v1/calls/${id}/alerted`);
    await until(() => web.state.get().call.alerted, 8000, "alerted");
    rig.last!.remote = 1;
    rig.last!.events.remoteJoined();
    expect(web.state.get().call.phase).toBe("connected");
    web.calls.hangup();
    expect((await callEvent(bob, id, "ended")).call.endReason).toBe("hangup");
  });

  it("answers a late joiner's key request as the call's creator, and only then", async () => {
    await web.calls.startCall(dm, false);
    const id = web.state.get().call.callId!;
    const first = await bob.waitFor(() => bob.received.find((m) => m.payload?.type === "call_invite" && m.payload.callId === id), 8000);
    await bob.send(dm, { type: "call_key_request", callId: id }, "control");
    await bob.waitFor(() => bob.received.filter((m) => m.payload?.type === "call_invite" && m.payload.callId === id).length === 2, 8000);
    const again = bob.received.filter((m) => m.payload?.type === "call_invite" && m.payload.callId === id)[1];
    expect(again.payload.e2eeKey).toBe(first.payload.e2eeKey);
    // A request for a call this account didn't create, or in another conversation, gets no answer.
    const before = bob.received.length;
    await bob.send(group, { type: "call_key_request", callId: id }, "control");
    await new Promise((r) => setTimeout(r, 600));
    expect(bob.received.slice(before).some((m) => m.payload?.type === "call_invite")).toBe(false);
    web.calls.hangup();
  });

  it("leaves nothing ringing when hung up while the call is being placed", async () => {
    // Hang up the moment the microphone is granted: the request that creates the call is about to go out.
    let asked = false;
    const unsubscribe = web.state.subscribe(() => {
      const c = web.state.get().call;
      if (c.askingPermission) asked = true;
      else if (asked && c.phase === "outgoing") {
        asked = false;
        web.calls.hangup();
      }
    });
    try {
      await web.calls.startCall(dm, false);
    } finally {
      unsubscribe();
    }
    await new Promise((r) => setTimeout(r, 500));
    expect((await bob.req("GET", "/v1/calls/active")).calls).toEqual([]);
  });

  it("won't place a call without a microphone, and the other side never rings", async () => {
    rig.issues = { microphone: "denied", camera: null };
    await web.calls.startCall(dm, false);
    expect(web.state.get().call).toMatchObject({ phase: "ended", error: CallFailure.device("microphone", "denied") });
    expect((await bob.req("GET", "/v1/calls/active")).calls).toEqual([]);
  });

  it("is busy for a second 1:1 call while in one", async () => {
    await web.calls.startCall(dm, false);
    const res = await carol.req("POST", "/v1/calls", { conversationId: dmCarol, video: false });
    expect((await callEvent(carol, res.call.id, "ended")).call.endReason).toBe("busy");
    expect(web.state.get().call.conversationId).toBe(dm);
    web.calls.hangup();
  });
});

describe("screen sharing and devices", () => {
  it("shares the screen and stops; a closed screen picker isn't an error; devices can be switched", async () => {
    rig.remoteOnConnect = 1;
    await web.calls.startCall(dm, false);
    const id = web.state.get().call.callId!;
    await web.calls.toggleScreenShare();
    expect(web.state.get().call.screenSharing).toBe(true);
    expect(rig.last?.screen).toBe(true);
    await web.calls.toggleScreenShare();
    expect(web.state.get().call.screenSharing).toBe(false);
    rig.screenRefused = true;
    await web.calls.toggleScreenShare();
    expect(web.state.get().call).toMatchObject({ screenSharing: false, error: null });
    expect((await web.calls.listDevices("audioinput")).map((d) => d.deviceId)).toEqual(["audioinput-1", "audioinput-2"]);
    await web.calls.useDevice("videoinput", "videoinput-2");
    expect(rig.last?.device.videoinput).toBe("videoinput-2");
    web.calls.hangup();
    await callEvent(bob, id, "ended");
  });
});

describe("keeping a call going", () => {
  it("rejoins the same call with the same key after this browser's media connection drops", async () => {
    const c = await bobCalls();
    await until(() => phase() === "incoming" && web.calls.hasKey(c.id), 8000, "ring and key");
    await web.calls.accept();
    const first = rig.last!;
    first.events.disconnected("SIGNAL_CLOSE");
    expect(phase()).toBe("reconnecting");
    await until(() => rig.last !== first && rig.last?.connected !== null && phase() === "connected", 10_000, "rejoin");
    expect(rig.last?.connected?.key).toBe(c.key);
    expect(first.disconnected).toBe(true);
    // An old connection's late events change nothing.
    first.events.disconnected("SIGNAL_CLOSE");
    expect(phase()).toBe("connected");
  });

  it("ends without retrying when the media server removed this browser", async () => {
    const c = await bobCalls();
    await until(() => phase() === "incoming" && web.calls.hasKey(c.id), 8000, "ring and key");
    await web.calls.accept();
    rig.last!.events.disconnected("PARTICIPANT_REMOVED");
    expect(web.state.get().call).toMatchObject({ phase: "ended", endReason: "disconnected" });
  });

  it("waits for the other person after their connection drops, then ends the call as lost", async () => {
    const c = await bobCalls();
    await until(() => phase() === "incoming" && web.calls.hasKey(c.id), 8000, "ring and key");
    await web.calls.accept();
    rig.last!.remote = 0;
    rig.last!.events.remoteLeft(0);
    expect(web.state.get().call.peerReconnecting).toBe(true);
    await until(() => phase() === "ended", 5000, "lost");
    expect(web.state.get().call.endReason).toBe("lost");
    expect((await callEvent(bob, c.id, "ended")).call.state).toBe("ENDED");
  });

  it("keeps the call when the other person comes back in time", async () => {
    const c = await bobCalls();
    await until(() => phase() === "incoming" && web.calls.hasKey(c.id), 8000, "ring and key");
    await web.calls.accept();
    rig.last!.remote = 0;
    rig.last!.events.remoteLeft(0);
    rig.last!.remote = 1;
    rig.last!.events.remoteJoined();
    await new Promise((r) => setTimeout(r, 700));
    expect(web.state.get().call).toMatchObject({ phase: "connected", peerReconnecting: false });
  });
});

describe("stopping", () => {
  it("doesn't notify when nothing changes, so stopping from a state listener can't loop (sign-out does that)", () => {
    let notified = 0;
    const unsubscribe = web.state.subscribe(() => {
      notified++;
      if (notified < 50) web.calls.stop();
    });
    try {
      web.calls.stop();
      web.calls.stop();
      expect(notified).toBe(0); // already idle: no state change, no listener call
    } finally {
      unsubscribe();
    }
  });
});

describe("a browser that can't encrypt call media", () => {
  it("shows the ring with an explanation, doesn't claim to be ringing, and can't answer", async () => {
    const other = await linkBrowser(server, alice, "Orbit Web · Old", { media: rig.factory, callSupported: () => false });
    try {
      const c = await bobCalls();
      await until(() => other.engine.state.get().call.phase === "incoming", 8000, "ring");
      expect(other.engine.state.get().call.error).toBe(CallFailure.UNSUPPORTED);
      await other.engine.calls.accept();
      expect(other.engine.state.get().call.phase).toBe("incoming");
      await bob.req("POST", `/v1/calls/${c.id}/end`);
      await until(() => other.engine.state.get().call.phase !== "incoming", 8000, "end");
    } finally {
      other.engine.stop();
    }
  });
});

/** Nothing this browser stored (messages, outbox, settings, caches) contains [secret]. */
async function expectNotStored(secret: string): Promise<void> {
  const dump = await new Promise<string>((resolve, reject) => {
    const req = indexedDB.open(web.store.name);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const names = [...db.objectStoreNames];
      const tx = db.transaction(names, "readonly");
      const out: unknown[] = [];
      for (const n of names) tx.objectStore(n).getAll().onsuccess = (ev) => out.push((ev.target as IDBRequest).result);
      tx.oncomplete = () => {
        db.close();
        resolve(JSON.stringify(out));
      };
    };
  });
  expect(dump.length).toBeGreaterThan(100);
  expect(dump).not.toContain(secret);
}
