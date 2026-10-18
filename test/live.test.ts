import nodeCrypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import { sealEnvelope } from "../src/crypto/envelope";
import { LocalStore } from "../src/store/db";
import { listDevices, signOut } from "../src/sync/account";
import { openAttachment, sendFiles } from "../src/sync/attachments";
import type { Engine } from "../src/sync/engine";
import { b64, nodeAesGcmDecrypt, unb64 } from "./support/reference";
import { type LinkedBrowser, linkBrowser, type Phone, type Server, startServer, until, uploadHistory } from "./support/live";

let server: Server;
let phone: Phone; // alice's phone: the reference client, byte-compatible with the Android app
let bob: Phone;
let dm: string;
let browser: LinkedBrowser;
let web: Engine;

const restoredFromBob = "h-restored-from-bob-0001";
const restoredMine = "h-restored-mine-000001";

beforeAll(async () => {
  server = await startServer();
  phone = await server.client("alice", "Alice");
  bob = await server.client("bob", "Bob");
  dm = (await phone.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  // History the phone uploaded before the browser existed (docs/MESSAGE_HISTORY.md).
  const t = Date.now() - 60_000;
  const row = (id: string, outgoing: boolean, text: string, at: number) => ({
    id,
    conversationId: dm,
    senderUserId: outgoing ? phone.userId : bob.userId,
    senderDeviceId: outgoing ? phone.deviceId : bob.deviceId,
    outgoing,
    kind: "text",
    text,
    mentionsJson: "[]",
    attachmentsJson: "[]",
    sentAt: at,
    serverTs: at,
    sortTs: at,
    status: outgoing ? "READ" : "RECEIVED",
    deleted: false,
    pinned: false,
    reactionsJson: '{"👍":["' + bob.userId + '"]}',
    readByJson: "[]",
    deliveredToJson: "[]",
    forwarded: false,
  });
  await uploadHistory(phone, [row(restoredFromBob, false, "an old message from Bob", t), row(restoredMine, true, "my old reply", t + 1000)]);
  await phone.connect();
  await bob.connect();
  browser = await linkBrowser(server, phone);
  web = browser.engine;
});

afterAll(async () => {
  web?.stop();
  await server?.close();
});

const messageIn = async (e: Engine, id: string) => e.store.message(id);
const textOf = async (e: Engine, id: string) => (await e.store.message(id))?.text;

describe("linking a browser as a device of the same account", () => {
  it("is approved from the phone and joins the account's device list", async () => {
    expect(web.device.userId).toBe(phone.userId);
    expect(web.device.history).not.toBeNull();
    const devices = (await phone.req("GET", "/v1/devices")).devices;
    expect(devices.map((d: any) => d.id)).toEqual(expect.arrayContaining([phone.deviceId, web.device.deviceId]));
    expect(web.state.get().conversations[dm]?.type).toBe("DM");
  });

  it("restores the account's encrypted history, without counting it as unread", async () => {
    await until(() => web.state.get().history.status === "done", 6000, "history restore");
    expect(await textOf(web, restoredFromBob)).toBe("an old message from Bob");
    const mine = await messageIn(web, restoredMine);
    expect(mine).toMatchObject({ outgoing: true, text: "my old reply", status: "READ" });
    expect((await messageIn(web, restoredFromBob))?.reactions).toEqual({ "👍": [bob.userId] });
    expect(web.state.get().local[dm]).toMatchObject({ lastPreview: "my old reply", unread: 0 });
  });
});

describe("messaging across devices through the one server", () => {
  it("a message from someone else arrives in the browser in real time, decrypted", async () => {
    const id = "m-bob-to-alice-0001";
    await bob.send(dm, { type: "text", text: "hi Alice, from Bob ✓" }, "message", id);
    await until(() => textOf(web, id), 5000, "bob's message");
    expect(await messageIn(web, id)).toMatchObject({ outgoing: false, senderUserId: bob.userId, status: "RECEIVED" });
    expect(web.state.get().local[dm]?.unread).toBeGreaterThanOrEqual(1);
  });

  it("a message sent in the browser reaches the other person and the account's own phone", async () => {
    const id = await web.sendText(dm, "hello from the browser");
    expect((await messageIn(web, id))?.status).not.toBe("FAILED");
    const atBob = await bob.waitFor(() => bob.received.find((m) => m.messageId === id));
    expect(atBob.payload).toMatchObject({ type: "text", text: "hello from the browser" });
    expect(atBob.senderDeviceId).toBe(web.device.deviceId);
    const atPhone = await phone.waitFor(() => phone.received.find((m) => m.messageId === id));
    expect(atPhone.senderUserId).toBe(phone.userId); // the phone shows it as its own account's message
    // Reconciled with the server: its time, then Bob's device confirms delivery.
    const sent = await until(
      async () => {
        const m = await messageIn(web, id);
        return m?.status === "DELIVERED" ? m : null;
      },
      5000,
      "delivered receipt",
    );
    expect(sent.serverTs).toBe(sent.sortTs);
  });

  it("a message sent on the phone appears in the browser as the account's own", async () => {
    const id = "m-alice-phone-0001";
    await phone.send(dm, { type: "text", text: "typed on my phone" }, "message", id);
    const m = await until(() => messageIn(web, id), 5000, "phone message");
    expect(m).toMatchObject({ outgoing: true, senderDeviceId: phone.deviceId, text: "typed on my phone" });
  });

  it("edits, reactions and deletions apply, only from the author where it matters", async () => {
    const id = "m-bob-editable-0001";
    await bob.send(dm, { type: "text", text: "original" }, "message", id);
    await until(() => messageIn(web, id));
    await bob.send(dm, { type: "edit", target: id, text: "edited by Bob" }, "control");
    await bob.send(dm, { type: "reaction", target: id, emoji: "🎉", add: true }, "control");
    await phone.send(dm, { type: "edit", target: id, text: "Alice can't edit Bob's message" }, "control");
    await until(async () => (await messageIn(web, id))?.reactions["🎉"]?.includes(bob.userId), 5000, "reaction");
    await web.idle();
    expect(await messageIn(web, id)).toMatchObject({ text: "edited by Bob" });
    await bob.send(dm, { type: "delete", target: id }, "control");
    await until(async () => (await messageIn(web, id))?.deleted, 5000, "deletion");
    expect(await textOf(web, id)).toBe("");
  });

  it("a control that arrives before its message is applied when the message comes", async () => {
    const id = "m-bob-arrives-late-01";
    await bob.send(dm, { type: "reaction", target: id, emoji: "👀", add: true }, "control");
    await bob.send(dm, { type: "text", text: "late" }, "message", id);
    const m = await until(
      async () => {
        const x = await messageIn(web, id);
        return x?.reactions["👀"] ? x : null;
      },
      5000,
      "held control replay",
    );
    expect(m.reactions["👀"]).toEqual([bob.userId]);
  });

  it("reading on the phone clears the browser's unread count", async () => {
    const r = await bob.send(dm, { type: "text", text: "unread until the phone reads it" }, "message", "m-bob-unread-00001");
    await until(() => (web.state.get().local[dm]?.unread ?? 0) > 0);
    await phone.send(dm, { type: "read", upTo: r.serverTs }, "control");
    await until(() => web.state.get().local[dm]?.unread === 0, 5000, "read elsewhere");
  });

  it("reading in the browser tells the other devices with an encrypted read receipt", async () => {
    const r = await bob.send(dm, { type: "text", text: "read me in the browser" }, "message", "m-bob-read-in-web1");
    await until(() => messageIn(web, "m-bob-read-in-web1"));
    await web.openConversation(dm);
    const receipt = await bob.waitFor(() => bob.received.find((m) => m.payload?.type === "read" && m.senderDeviceId === web.device.deviceId));
    expect(receipt.payload.upTo).toBe(r.serverTs);
    // The account's phone gets the same receipt, so it clears its own unread count (android MessageRepository "read" + mine).
    await phone.waitFor(() => phone.received.find((m) => m.payload?.type === "read" && m.senderDeviceId === web.device.deviceId));
    await web.openConversation(null);
  });

  it("doesn't repeat a receipt the phone already sent", async () => {
    const r = await bob.send(dm, { type: "text", text: "read on the phone first" }, "message", "m-bob-read-phone01");
    await until(() => messageIn(web, "m-bob-read-phone01"));
    await phone.send(dm, { type: "read", upTo: r.serverTs }, "control");
    await until(() => web.state.get().local[dm]?.unread === 0);
    const before = bob.received.filter((m) => m.payload?.type === "read").length;
    await web.openConversation(dm);
    await web.idle();
    await new Promise((res) => setTimeout(res, 300));
    expect(bob.received.filter((m) => m.payload?.type === "read" && m.senderDeviceId === web.device.deviceId && m.payload.upTo >= r.serverTs)).toHaveLength(0);
    expect(bob.received.filter((m) => m.payload?.type === "read").length).toBe(before);
    await web.openConversation(null);
  });
});

describe("connection loss and recovery", () => {
  it("messages sent while the browser was offline arrive after reconnecting, in order, once each", async () => {
    browser.net.down = true;
    server.ctx.hub.disconnectDevice(web.device.deviceId, "network lost");
    await until(() => web.state.get().connection !== "online", 5000, "offline");
    const ids = ["m-offline-0000001", "m-offline-0000002", "m-offline-0000003"];
    for (const [i, id] of ids.entries()) await bob.send(dm, { type: "text", text: `while offline ${i}` }, "message", id);
    expect(await messageIn(web, ids[0])).toBeNull();
    browser.net.down = false;
    browser.net.duplicateQueueFrames = true; // every delivery twice on the wire
    web.reconnect();
    await until(async () => (await Promise.all(ids.map((id) => messageIn(web, id)))).every(Boolean), 8000, "backlog after reconnect");
    browser.net.duplicateQueueFrames = false;
    const got = await Promise.all(ids.map((id) => messageIn(web, id)));
    const order = [...got].sort((a, b) => a!.sortTs - b!.sortTs).map((m) => m!.id);
    expect(order).toEqual(ids);
    const all = await web.store.latestMessages(dm, 500);
    expect(all.filter((m) => ids.includes(m.id))).toHaveLength(3);
    // Everything was acknowledged: nothing waits in this browser's queue on the server.
    await web.idle();
    await until(
      async () => (await web.api.json("GET", "/v1/queue", (await import("zod")).z.object({ items: (await import("zod")).z.array((await import("zod")).z.unknown()) }))).items.length === 0,
      5000,
      "empty queue",
    );
  });

  it("a message sent while offline is kept and sent once the connection returns", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new TypeError("offline");
    }) as typeof fetch;
    let id = "";
    try {
      id = await web.sendText(dm, "queued while offline");
      await new Promise((r) => setTimeout(r, 200));
      expect((await messageIn(web, id))?.status).toBe("SENDING");
    } finally {
      globalThis.fetch = realFetch;
    }
    web.reconnect();
    await bob.waitFor(() => bob.received.find((m) => m.messageId === id), 10_000);
  });
});

describe("attachments through the existing upload routes", () => {
  it("a file sent from the browser opens on the other side, and theirs opens in the browser", async () => {
    const bytes = nodeCrypto.randomBytes(70_000);
    const id = await sendFiles(web, dm, [{ name: "plan.pdf", type: "application/pdf", size: bytes.length, bytes: async () => new Uint8Array(bytes) }], "the plan");
    const atBob = await bob.waitFor(() => bob.received.find((m) => m.messageId === id));
    const ref = atBob.payload.attachments[0];
    const ct: Buffer = await bob.req("GET", `/v1/attachments/${ref.id}`);
    expect(nodeCrypto.createHash("sha256").update(ct).digest("base64")).toBe(ref.sha256);
    expect(nodeAesGcmDecrypt(unb64(ref.key), unb64(ref.nonce), ct).equals(bytes)).toBe(true);

    // Bob's file, encrypted the way the phone does it, opened in the browser.
    const plain = Buffer.from("Bob's photo bytes ✓");
    const key = nodeCrypto.randomBytes(32);
    const nonce = nodeCrypto.randomBytes(12);
    const c = nodeCrypto.createCipheriv("aes-256-gcm", key, nonce);
    const enc = Buffer.concat([c.update(plain), c.final(), c.getAuthTag()]);
    const up = await bob.req("POST", `/v1/attachments?conversationId=${dm}`, undefined, enc);
    const att = { id: up.id, name: "photo.jpg", mime: "image/jpeg", size: plain.length, key: b64(key), nonce: b64(nonce), sha256: nodeCrypto.createHash("sha256").update(enc).digest("base64") };
    await bob.send(dm, { type: "text", text: "", attachments: [att] }, "message", "m-bob-photo-000001");
    const m = await until(() => messageIn(web, "m-bob-photo-000001"));
    const blob = await openAttachment(web, m.attachments[0]);
    expect(Buffer.from(await blob.arrayBuffer()).equals(plain)).toBe(true);
    expect(blob.type).toBe("image/jpeg");
  });
});

describe("authorization is enforced by the server", () => {
  it("refuses posting to, reading or downloading from a conversation this account isn't in", async () => {
    const carol = await server.client("carol", "Carol");
    const other = (await bob.req("POST", "/v1/conversations/dm", { userId: carol.userId })).conversation.id;
    await expect(web.api.json("GET", `/v1/conversations/${other}`, (await import("zod")).z.unknown())).rejects.toMatchObject({ status: 404 });
    await expect(web.api.json("GET", `/v1/conversations/${other}/devices`, (await import("zod")).z.unknown())).rejects.toMatchObject({ status: 404 });
    const sealed = await sealEnvelope(
      { messageId: "m-intruder-000001", conversationId: other, senderUserId: web.device.userId, senderDeviceId: web.device.deviceId, sentAt: Date.now(), cls: "message" },
      "{}",
      [],
      web.device.keys.signing.privateKey,
    );
    const post = web.api.call("POST", "/v1/messages", {
      body: {
        conversationId: other,
        messageId: "m-intruder-000001",
        cls: "message",
        sentAt: sealed.header.sentAt,
        nonce: sealed.nonce,
        ciphertext: sealed.ciphertext,
        signature: sealed.signature,
        recipients: [],
      },
    });
    await expect(post).rejects.toBeInstanceOf(ApiError);
    await expect(post).rejects.toMatchObject({ status: 404 });
    const file = await bob.req("POST", `/v1/attachments?conversationId=${other}`, undefined, Buffer.from("private"));
    await expect(web.api.bytes(`/v1/attachments/${file.id}`)).rejects.toMatchObject({ status: 404 });
    await expect(web.sendText(other, "not allowed")).rejects.toMatchObject({ status: 403 });
  });

  it("an envelope signed by another device is refused", async () => {
    const other = await linkBrowser(server, bob, "Bob's browser");
    try {
      const sealed = await sealEnvelope(
        { messageId: "m-forged-0000001", conversationId: dm, senderUserId: web.device.userId, senderDeviceId: web.device.deviceId, sentAt: Date.now(), cls: "message" },
        "{}",
        [],
        other.engine.device.keys.signing.privateKey,
      );
      await expect(
        web.api.call("POST", "/v1/messages", {
          body: {
            conversationId: dm,
            messageId: "m-forged-0000001",
            cls: "message",
            sentAt: sealed.header.sentAt,
            nonce: sealed.nonce,
            ciphertext: sealed.ciphertext,
            signature: sealed.signature,
            recipients: [],
          },
        }),
      ).rejects.toMatchObject({ status: 400, code: "bad_signature" });
    } finally {
      other.engine.stop();
    }
  });
});

describe("trust on first use (docs/SECURITY.md §3)", () => {
  it("a contact's changed identity key pauses sending and holds their messages until accepted", async () => {
    // Bob reinstalls without his recovery key (or a server swaps his key): a new identity and device under his account.
    const { GriipClient } = (await import(/* @vite-ignore */ (await import("node:path")).join((await import("./support/serverDir")).serverDir(), "test/support/griipClient.ts"))) as any;
    const newBob = new GriipClient(server.baseUrl, bob.username, "Bob");
    const deviceId = `d_rebob_${nodeCrypto.randomBytes(6).toString("hex")}`;
    server.ctx.db.prepare("UPDATE devices SET revoked_at = ? WHERE user_id = ?").run(Date.now(), bob.userId);
    server.ctx.db.prepare("UPDATE users SET identity_key = ? WHERE id = ?").run(newBob.identityKeyB64, bob.userId);
    server.ctx.db
      .prepare("INSERT INTO devices (id, user_id, name, signing_key, encryption_key, certificate, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(deviceId, bob.userId, "Bob's new phone", newBob.signingKeyB64, newBob.encKeyB64, newBob.certificate(), Date.now());
    newBob.userId = bob.userId;
    newBob.deviceId = deviceId;
    await newBob.login();
    await newBob.connect();
    web.directory.invalidateUser(bob.userId);

    const paused = await web.sendText(dm, "should wait for my review");
    await until(async () => (await messageIn(web, paused))?.status === "HELD", 5000, "held send");
    expect(web.state.get().identityAlerts.map((a) => a.userId)).toContain(bob.userId);
    expect(web.state.get().identityAlerts[0].changedTo).toBe(newBob.identityKeyB64);

    await newBob.send(dm, { type: "text", text: "it's me, new phone" }, "message", "m-newbob-hello-001");
    await new Promise((r) => setTimeout(r, 300));
    await web.idle();
    expect(await messageIn(web, "m-newbob-hello-001")).toBeNull(); // held, not shown
    expect(newBob.received.find((m: any) => m.messageId === paused)).toBeUndefined(); // nothing was encrypted to the new key

    await web.acceptIdentity(bob.userId);
    await newBob.waitFor(() => newBob.received.find((m: any) => m.messageId === paused), 5000);
    expect(await textOf(web, "m-newbob-hello-001")).toBe("it's me, new phone");
    expect(web.state.get().identityAlerts).toHaveLength(0);
    await newBob.disconnect();
  });
});

describe("leaving", () => {
  it("a browser removed from the phone is signed out at once", async () => {
    const extra = await linkBrowser(server, phone, "Removed browser");
    await phone.req("DELETE", `/v1/devices/${extra.engine.device.deviceId}`);
    await until(() => extra.engine.state.get().phase === "revoked", 5000, "revoked");
    expect(extra.engine.state.get().phaseReason).toBe("device_revoked");
  });

  it("signing out removes the browser from the account first, then erases its data", async () => {
    const extra = await linkBrowser(server, phone, "Signing out");
    const name = extra.engine.store.name;
    const deviceId = extra.engine.device.deviceId;
    await signOut(extra.engine);
    const d = (await listDevices(web)).find((x) => x.id === deviceId);
    expect(d?.revokedAt).not.toBeNull();
    expect((await indexedDB.databases()).some((x) => x.name === name)).toBe(false);
    const reopened = await LocalStore.open(name);
    expect(await reopened.device()).toBeNull();
    reopened.close();
  });
});
