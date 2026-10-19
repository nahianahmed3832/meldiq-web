import nodeCrypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sendFiles } from "../src/sync/attachments";
import type { Engine } from "../src/sync/engine";
import { forwardMessage } from "../src/sync/forward";
import { block, blockedIds, myProfile, setPrivacy, unblock, updateMyProfile } from "../src/sync/profile";
import { fallbackText } from "../src/sync/rich";
import { linkBrowser, type Phone, type Server, startServer, until } from "./support/live";
import { nodeAesGcmDecrypt, unb64 } from "./support/reference";

/**
 * Message kinds and profile features the phone has, sent from the browser to the reference client (byte-compatible with
 * the Android app) through the real server: forwarding with re-encrypted files, contact cards, locations, voice messages,
 * call history from the server's record, profile fields, privacy and blocks.
 */
let server: Server;
let alice: Phone;
let bob: Phone;
let carol: Phone;
let web: Engine;
let dmBob: string;
let dmCarol: string;

beforeAll(async () => {
  server = await startServer();
  alice = await server.client("alice", "Alice");
  bob = await server.client("bob", "Bob");
  carol = await server.client("carol", "Carol");
  dmBob = (await bob.req("POST", "/v1/conversations/dm", { userId: alice.userId })).conversation.id;
  dmCarol = (await carol.req("POST", "/v1/conversations/dm", { userId: alice.userId })).conversation.id;
  await bob.connect();
  await carol.connect();
  web = (await linkBrowser(server, alice)).engine;
});
afterAll(async () => {
  web?.stop();
  await server?.close();
});

const at = (p: Phone, id: string) => p.waitFor(() => p.received.find((m) => m.messageId === id));

describe("rich messages from the browser", () => {
  it("a contact card arrives as the phone sends one: fields in the encrypted payload, readable text alongside", async () => {
    const contact = { name: "Dr. Rahman", phones: ["+8801712345678"], emails: ["dr@example.test"] };
    const id = await web.sendText(dmBob, fallbackText({ contact }), { rich: { contact } });
    const m = await at(bob, id);
    expect(m.payload).toMatchObject({ type: "text", contact, text: "👤 Dr. Rahman\n+8801712345678\ndr@example.test" });
    expect(m.payload.mentions).toBeUndefined();
  });

  it("a location arrives with its coordinates and an OpenStreetMap fallback", async () => {
    const location = { lat: 23.810332, lon: 90.412518, accuracyM: 12, label: "Office" };
    const id = await web.sendText(dmBob, fallbackText({ location }), { rich: { location } });
    const m = await at(bob, id);
    expect(m.payload.location).toEqual(location);
    expect(m.payload.text).toBe("📍 Office\nhttps://www.openstreetmap.org/?mlat=23.810332&mlon=90.412518#map=16/23.810332/90.412518");
  });

  it("a voice message is an encrypted audio attachment marked voice with its length", async () => {
    const audio = nodeCrypto.randomBytes(9_000);
    const id = await sendFiles(web, dmBob, [{ name: "voice.m4a", type: "audio/mp4", size: audio.length, bytes: async () => new Uint8Array(audio), voiceDurationMs: 7_340 }], "");
    const m = await at(bob, id);
    const ref = m.payload.attachments[0];
    expect(ref).toMatchObject({ mime: "audio/mp4", voice: true, durationMs: 7_340, size: audio.length });
    const ct: Buffer = await bob.req("GET", `/v1/attachments/${ref.id}`);
    expect(nodeAesGcmDecrypt(unb64(ref.key), unb64(ref.nonce), ct).equals(audio)).toBe(true);
  });

  it("forwarding sends a new message marked Forwarded, with files re-encrypted for the new conversation", async () => {
    const plan = nodeCrypto.randomBytes(20_000);
    const original = await sendFiles(web, dmBob, [{ name: "plan.pdf", type: "application/pdf", size: plan.length, bytes: async () => new Uint8Array(plan) }], "the plan @bob");
    const stored = (await web.store.message(original))!;
    const fwd = await forwardMessage(web, stored, dmCarol);
    const m = await at(carol, fwd);
    expect(m.payload).toMatchObject({ type: "text", text: "the plan @bob", forwarded: true });
    expect(m.payload.mentions).toBeUndefined();
    const ref = m.payload.attachments[0];
    expect(ref.id).not.toBe(stored.attachments[0].id);
    expect(ref.key).not.toBe(stored.attachments[0].key);
    // Carol (not in Bob's DM) can fetch and decrypt the new copy.
    const ct: Buffer = await carol.req("GET", `/v1/attachments/${ref.id}`);
    expect(nodeAesGcmDecrypt(unb64(ref.key), unb64(ref.nonce), ct).equals(plan)).toBe(true);
    await expect(carol.req("GET", `/v1/attachments/${stored.attachments[0].id}`)).rejects.toThrow();
    expect((await web.store.message(fwd))?.forwarded).toBe(true);
  });
});

describe("call history from the server's record", () => {
  it("a call Bob started and cancelled shows in Alice's browser as a missed call, once", async () => {
    const started = await bob.req("POST", "/v1/calls", { conversationId: dmBob, video: false });
    const callId = started.call.id;
    await bob.req("POST", `/v1/calls/${callId}/end`, { reason: "hangup" });
    await web.syncCalls(dmBob);
    await web.syncCalls(dmBob);
    const entry = await until(
      async () => {
        const m = await web.store.message(`call-${callId}`);
        return m?.call?.info?.outcome === "missed" ? m : null;
      },
      6000,
      "missed call entry",
    );
    expect(entry).toMatchObject({ kind: "call", outgoing: false, senderUserId: bob.userId });
    await until(() => web.state.get().callLog.some((c) => c.callId === callId && c.outcome === "missed"), 6000, "call log entry");
    expect(web.state.get().callLog.filter((c) => c.callId === callId)).toHaveLength(1);
    expect(web.state.get().local[dmBob]?.lastPreview).toBe("📞 Missed voice call");
  });
});

describe("profile, privacy and blocks", () => {
  it("updates profile fields and privacy; the server applies them to what others see", async () => {
    await updateMyProfile(web, { firstName: "Alice", lastName: "Rahman", birthday: "--03-14", phone: "+8801712345678", statusText: "In the studio" });
    const me = await myProfile(web);
    expect(me).toMatchObject({ firstName: "Alice", lastName: "Rahman", birthday: "--03-14", phone: "+8801712345678", statusText: "In the studio" });
    expect(me.privacy).toMatchObject({ birthday: "nobody", phone: "nobody" });
    // Bob shares a DM with Alice (a contact). Birthday hidden by default; shown once she allows contacts.
    expect((await bob.req("GET", `/v1/users/${alice.userId}`)).user.birthday).toBeUndefined();
    await setPrivacy(web, { birthday: "contacts", bio: "nobody" });
    const seen = (await bob.req("GET", `/v1/users/${alice.userId}`)).user;
    expect(seen.birthday).toBe("--03-14");
    expect(seen.statusText ?? null).toBeNull();
  });

  it("blocks and unblocks someone", async () => {
    await block(web, carol.userId);
    expect(await blockedIds(web)).toEqual([carol.userId]);
    expect((await carol.req("GET", `/v1/users/${alice.userId}`)).user.firstName).toBeUndefined();
    await unblock(web, carol.userId);
    expect(await blockedIds(web)).toEqual([]);
  });
});
