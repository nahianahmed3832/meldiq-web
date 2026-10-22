import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { browseChannels, conversationMembers, joinChannel, listDevices, orgActivity, orgDetail, revokeDevice, searchPeople, startDirect, updateProfile, userProfile } from "../src/sync/account";
import type { Engine } from "../src/sync/engine";
import { UNSUPPORTED_TEXT } from "../src/sync/rules";
import { linkBrowser, type Phone, type Server, startServer, until } from "./support/live";

/** What the browser does (rather than receives), against the real server, with reference clients as other people. */
let server: Server;
let alice: Phone;
let bob: Phone;
let carol: Phone;
let web: Engine;
let dm: string;
let org: string;

beforeAll(async () => {
  server = await startServer();
  alice = await server.client("alice", "Alice");
  bob = await server.client("bob", "Bob");
  carol = await server.client("carol", "Carol");
  dm = (await alice.req("POST", "/v1/conversations/dm", { userId: bob.userId })).conversation.id;
  org = (await alice.req("POST", "/v1/orgs", { name: "Acme" })).org.id;
  for (const p of [bob, carol]) {
    const code = (await alice.req("POST", `/v1/orgs/${org}/invites`, { role: "MEMBER" })).invite.code;
    await p.req("POST", "/v1/invites/accept", { code });
  }
  await bob.connect();
  await carol.connect();
  web = (await linkBrowser(server, alice)).engine;
});

afterAll(async () => {
  web?.stop();
  await server?.close();
});

const at = (p: Phone, pred: (m: Phone["received"][number]) => boolean) => p.waitFor(() => p.received.find(pred));

describe("actions from the browser reach everyone", () => {
  it("edit, react, pin and delete arrive at the other side as encrypted controls", async () => {
    const id = await web.sendText(dm, "first draft");
    await at(bob, (m) => m.messageId === id);
    const m = (await web.store.message(id))!;
    await web.edit(m, "final text");
    await web.react((await web.store.message(id))!, "🚀");
    await web.setPinned((await web.store.message(id))!, true);
    expect(await at(bob, (x) => x.payload?.type === "edit" && x.payload.target === id)).toMatchObject({ payload: { text: "final text" } });
    expect(await at(bob, (x) => x.payload?.type === "reaction" && x.payload.target === id)).toMatchObject({ payload: { emoji: "🚀", add: true } });
    expect(await at(bob, (x) => x.payload?.type === "pin" && x.payload.target === id)).toMatchObject({ payload: { pinned: true } });
    await web.react((await web.store.message(id))!, "🚀"); // toggles off
    await at(bob, (x) => x.payload?.type === "reaction" && x.payload.target === id && x.payload.add === false);
    await web.deleteForEveryone((await web.store.message(id))!);
    await at(bob, (x) => x.payload?.type === "delete" && x.payload.target === id);
    expect(await web.store.message(id)).toMatchObject({ deleted: true, text: "", pinned: true, reactions: {} });
    expect(web.state.get().local[dm]?.lastPreview).toBe("Message deleted");
  });

  it("replies and thread replies carry their references", async () => {
    const root = await web.sendText(dm, "thread root");
    const reply = await web.sendText(dm, "quoted reply", { replyTo: root });
    const inThread = await web.sendText(dm, "in the thread", { threadRoot: root });
    expect((await at(bob, (m) => m.messageId === reply)).payload).toMatchObject({ replyTo: root });
    expect((await at(bob, (m) => m.messageId === inThread)).payload).toMatchObject({ threadRoot: root });
    // A thread reply doesn't become the conversation's preview.
    await web.idle();
    expect(web.state.get().local[dm]?.lastPreview).toBe("quoted reply");
  });

  it("mentions resolve against the conversation's members and @everyone needs the server's permission", async () => {
    const ch = (await alice.req("POST", `/v1/orgs/${org}/channels`, { name: "general", scope: "ORG", memberIds: [bob.userId, carol.userId] })).channel.id;
    await until(() => web.state.get().conversations[ch], 5000, "channel appears live (conv.updated)");
    const bobName = (await userProfile(web, bob.userId)).username;
    const id = await web.sendText(ch, `@${bobName} and @nobody, see this. @everyone`);
    const got = await at(carol, (m) => m.messageId === id);
    expect(got.payload.mentions).toEqual([bob.userId]);
    expect(got.payload.mentionAll).toBe(true); // the owner may notify everyone in an org channel
  });

  it("a send the server refuses is marked failed with its reason, and can be retried", async () => {
    const ann = (await alice.req("POST", `/v1/orgs/${org}/channels`, { name: "news", scope: "ORG", kind: "ANNOUNCEMENT", memberIds: [bob.userId] })).channel.id;
    await until(() => web.state.get().conversations[ann]);
    // Queued while offline; meanwhile the channel is archived; sent once the connection returns: the server refuses it.
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new TypeError("offline");
    }) as typeof fetch;
    let id = "";
    try {
      id = await web.sendText(ann, "queued before the archive");
      await new Promise((r) => setTimeout(r, 100));
    } finally {
      globalThis.fetch = realFetch;
    }
    await alice.req("PATCH", `/v1/conversations/${ann}`, { archived: true });
    web.reconnect();
    const failed = await until(
      async () => {
        const m = await web.store.message(id);
        return m?.status === "FAILED" ? m : null;
      },
      10_000,
      "refused send",
    );
    expect(failed.errorText).toMatch(/archived/i);
    await until(() => web.state.get().conversations[ann]?.archived, 5000, "archived flag");
    await expect(web.sendText(ann, "too late")).rejects.toMatchObject({ status: 403 });
    await alice.req("PATCH", `/v1/conversations/${ann}`, { archived: false });
    await until(() => web.state.get().conversations[ann]?.archived === false);
    await web.retry(id);
    await at(bob, (x) => x.messageId === id);
  });

  it("a message whose key wasn't wrapped for this browser shows a placeholder and doesn't block the queue", async () => {
    const users = (await bob.req("GET", `/v1/conversations/${dm}/devices`)).users as { userId: string; devices: { id: string; signingKey: string; encryptionKey: string; certificate: string }[] }[];
    const devices = users.flatMap((u) => u.devices).filter((d) => d.id !== bob.deviceId);
    const wrong = (await import("../src/crypto/identity")).generateDeviceKeys;
    const stranger = (await wrong()).encryptionPublic;
    // The right device ids (the server checks those), but the browser's copy is wrapped to someone else's key.
    const recipients = devices.map((d) => (d.id === web.device.deviceId ? { ...d, encryptionKey: stranger } : d));
    const env = await bob.encrypt(dm, { type: "text", text: "you can't read this" }, "message", recipients, "m-wrong-wrap-00001");
    await bob.req("POST", "/v1/messages", env);
    await bob.send(dm, { type: "text", text: "but this one is fine" }, "message", "m-after-wrong-0001");
    const placeholder = await until(() => web.store.message("m-wrong-wrap-00001"), 5000, "placeholder");
    expect(placeholder).toMatchObject({ kind: "undecryptable", errorText: "key unwrap failed" });
    expect(await until(() => web.store.message("m-after-wrong-0001"), 5000, "next message")).toMatchObject({ text: "but this one is fine" });
  });

  it("a message type from a newer app is kept as a placeholder, not acknowledged and dropped", async () => {
    await bob.send(dm, { type: "hologram", text: "from the future" }, "message", "m-newer-type-0001");
    await bob.send(dm, { type: "text", text: "and back to text" }, "message", "m-after-newer-001");
    const placeholder = await until(() => web.store.message("m-newer-type-0001"), 5000, "placeholder");
    expect(placeholder).toMatchObject({ kind: "undecryptable", text: UNSUPPORTED_TEXT, errorText: "payload type hologram" });
    expect(await until(() => web.store.message("m-after-newer-001"), 5000, "next message")).toMatchObject({ text: "and back to text" });
  });
});

describe("what the browser shows", () => {
  it("pages back through a long conversation, newest first", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 70; i++) ids.push((await bob.send(dm, { type: "text", text: `bulk ${i}` }, "message", `m-bulk-${String(i).padStart(10, "0")}`)) && `m-bulk-${String(i).padStart(10, "0")}`);
    await until(async () => (await web.store.message(ids[69])) !== null, 10_000, "bulk delivery");
    await web.openConversation(dm);
    const first = web.state.get().messages[dm]!;
    expect(first.items).toHaveLength(60);
    expect(first.hasMore).toBe(true);
    expect(first.items[first.items.length - 1].id).toBe(ids[69]);
    await web.loadOlder(dm);
    const more = web.state.get().messages[dm]!;
    expect(more.items.length).toBeGreaterThan(60);
    expect([...more.items].sort((a, b) => a.sortTs - b.sortTs).map((m) => m.id)).toEqual(more.items.map((m) => m.id));
    await web.openConversation(null);
  });

  it("finds messages by their text on this browser, keeps drafts, and remembers verified people", async () => {
    expect((await web.searchMessages("bulk 42")).map((m) => m.text)).toContain("bulk 42");
    await web.saveDraft(dm, "unsent words");
    expect(web.state.get().local[dm]?.draft).toBe("unsent words");
    await web.markVerified(bob.userId, true);
    expect((await web.pinnedIdentity(bob.userId))?.verified).toBe(true);
  });

  it("shows typing and presence from the people it shares conversations with", async () => {
    bob.ws?.send(JSON.stringify({ t: "typing", c: dm, on: true }));
    await until(() => Object.keys(web.state.get().typing[dm] ?? {}).includes(bob.userId), 5000, "typing");
    await bob.disconnect();
    await until(() => web.state.get().users[bob.userId]?.online === false, 5000, "presence offline");
    await bob.connect();
    await until(() => web.state.get().users[bob.userId]?.online === true, 5000, "presence online");
  });

  it("learns about a new group it was added to from the group's first message", async () => {
    const group = (await bob.req("POST", "/v1/conversations/group", { name: "Launch crew", memberIds: [alice.userId, carol.userId] })).conversation.id;
    await bob.send(group, { type: "text", text: "welcome to the crew" }, "message", "m-group-hello-0001");
    await until(() => web.store.message("m-group-hello-0001"), 5000, "group message");
    expect(web.state.get().conversations[group]).toMatchObject({ type: "GROUP", name: "Launch crew" });
  });
});

describe("account and workspace", () => {
  it("people, direct messages, channels, workspace details and activity come from the server", async () => {
    const found = await searchPeople(web, "carol");
    expect(found.map((u) => u.id)).toContain(carol.userId);
    const id = await startDirect(web, carol.userId);
    expect(web.state.get().conversations[id]?.type).toBe("DM");
    const channels = await browseChannels(web, org);
    expect(channels.map((c) => c.name)).toEqual(expect.arrayContaining(["general"]));
    const open = (await carol.req("POST", `/v1/orgs/${org}/channels`, { name: "random", scope: "ORG" }).catch(() => null)) as { channel?: { id: string } } | null;
    const randomId = open?.channel?.id ?? (await alice.req("POST", `/v1/orgs/${org}/channels`, { name: "random", scope: "ORG" })).channel.id;
    await joinChannel(web, randomId);
    expect(web.state.get().conversations[randomId]?.joined).toBe(true);
    expect((await conversationMembers(web, randomId)).map((m) => m.id)).toContain(alice.userId);
    const detail = await orgDetail(web, org);
    expect(detail.permissions.isOwner).toBe(true);
    expect((await orgActivity(web, org)).map((a) => a.action)).toEqual(expect.arrayContaining(["channel.create", "invite.accept"]));
  });

  it("profile changes go to the server and come back to the browser", async () => {
    await updateProfile(web, { displayName: "Alice R.", statusText: "Shipping Meldiq Web" });
    expect(web.state.get().me).toMatchObject({ displayName: "Alice R.", statusText: "Shipping Meldiq Web" });
  });

  it("lists the account's devices and can remove another device of the account", async () => {
    const extra = await linkBrowser(server, alice, "Old laptop");
    const before = await listDevices(web);
    expect(before.find((d) => d.current)?.id).toBe(web.device.deviceId);
    await revokeDevice(web, extra.engine.device.deviceId);
    await until(() => extra.engine.state.get().phase === "revoked", 5000, "other browser signed out");
    expect((await listDevices(web)).find((d) => d.id === extra.engine.device.deviceId)?.revokedAt).not.toBeNull();
  });
});
