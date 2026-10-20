import nodeCrypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Engine } from "../src/sync/engine";
import { voters } from "../src/sync/polls";
import { fallbackText, profileCard } from "../src/sync/rich";
import { sendFiles } from "../src/sync/attachments";
import { planSave, saveSummary } from "../src/sync/bulkSave";
import { runBulkSave } from "../src/sync/bulkSaver";
import { linkBrowser, type Phone, type Server, startServer, until } from "./support/live";

/**
 * Polls and stickers between the browser and the phone (the reference client, byte-compatible with Android) through the
 * real server: everything travels inside end-to-end encrypted envelopes (docs/RICH_MESSAGES.md, docs/STICKERS.md).
 */
let server: Server;
let ann: Phone;
let bo: Phone;
let web: Engine;
let group: string;

beforeAll(async () => {
  server = await startServer();
  ann = await server.client("ann", "Ann");
  bo = await server.client("bo", "Bo");
  for (const p of [ann, bo]) await p.connect();
  web = (await linkBrowser(server, ann)).engine;
  group = (await bo.req("POST", "/v1/conversations/group", { name: "Lunch club", memberIds: [ann.userId] })).conversation.id;
  await until(() => !!web.state.get().conversations[group], 8000, "the group in the browser");
});
afterAll(async () => {
  web?.stop();
  await server?.close();
});

const message = async (id: string) => (await web.conversationMessages(group)).find((m) => m.id === id);

describe("polls", () => {
  it("the phone's poll shows here; votes go both ways; a changed vote replaces the old one; only the creator closes it", async () => {
    const pollId = nodeCrypto.randomUUID();
    const poll = {
      question: "Where to?",
      options: [
        { id: "o1", text: "Noodles" },
        { id: "o2", text: "Tacos" },
      ],
      multi: false,
    };
    await bo.send(group, { type: "text", text: "📊 Where to?\n1. Noodles\n2. Tacos", poll }, "message", pollId);
    await until(async () => (await message(pollId))?.rich?.poll?.question === "Where to?", 8000, "poll in the browser");

    // The browser votes: Bo's phone receives an encrypted vote control with the choice.
    await web.vote((await message(pollId))!, ["o2"]);
    await until(() => bo.received.some((m) => m.payload.type === "vote" && m.payload.target === pollId && m.payload.choices?.[0] === "o2"), 8000, "vote on the phone");
    // Changing the vote replaces it.
    await web.vote((await message(pollId))!, ["o1"]);
    await until(() => bo.received.some((m) => m.payload.type === "vote" && m.payload.choices?.[0] === "o1"), 8000, "changed vote");
    expect((await message(pollId))!.rich!.votes).toEqual({ [ann.userId]: ["o1"] });

    // Bo votes from the phone: counted here.
    await bo.send(group, { type: "vote", target: pollId, choices: ["o2"] }, "control");
    await until(async () => voters((await message(pollId))!.rich!) === 2, 8000, "Bo's vote counted");

    // Ann (not the creator) can't close Bo's poll from her phone; Bo can.
    await ann.send(group, { type: "poll_close", target: pollId }, "control");
    await bo.send(group, { type: "text", text: "marker" }, "message");
    await until(async () => (await web.conversationMessages(group)).some((m) => m.text === "marker"), 8000, "later message");
    expect((await message(pollId))!.rich!.pollClosed).toBeFalsy();
    await bo.send(group, { type: "poll_close", target: pollId }, "control");
    await until(async () => (await message(pollId))!.rich!.pollClosed === true, 8000, "closed");
    // A closed poll takes no more votes.
    await web.vote((await message(pollId))!, ["o2"]);
    expect((await message(pollId))!.rich!.votes?.[ann.userId]).toEqual(["o1"]);
  });

  it("a poll made in the browser reaches the phone with its readable fallback", async () => {
    const id = await web.sendText(group, "📊 Team lunch?\n1. Friday\n2. Monday", {
      rich: {
        poll: {
          question: "Team lunch?",
          options: [
            { id: "o1", text: "Friday" },
            { id: "o2", text: "Monday" },
          ],
          multi: true,
        },
      },
    });
    const got = await until(() => bo.received.find((m) => m.messageId === id), 8000, "poll on the phone");
    expect(got.payload.poll).toEqual({
      question: "Team lunch?",
      options: [
        { id: "o1", text: "Friday" },
        { id: "o2", text: "Monday" },
      ],
      multi: true,
    });
    expect(got.payload.text).toContain("Team lunch?");
  });
});

describe("stickers", () => {
  it("a sticker from the browser arrives as {pack, id} with its fallback text; the phone's sticker shows here", async () => {
    const id = await web.sendText(group, "👍 LGTM", { rich: { sticker: { pack: "work", id: "lgtm" } } });
    const got = await until(() => bo.received.find((m) => m.messageId === id), 8000, "sticker on the phone");
    expect(got.payload).toMatchObject({ type: "text", text: "👍 LGTM", sticker: { pack: "work", id: "lgtm" } });

    const fromPhone = nodeCrypto.randomUUID();
    await bo.send(group, { type: "text", text: "🎉 Party!", sticker: { pack: "celebrate", id: "party" } }, "message", fromPhone);
    await until(async () => (await message(fromPhone))?.rich?.sticker?.id === "party", 8000, "phone's sticker in the browser");
    // A malformed reference isn't kept; the text is shown instead.
    const bad = nodeCrypto.randomUUID();
    await bo.send(group, { type: "text", text: "sticker?", sticker: { pack: "../etc", id: "x" } }, "message", bad);
    await until(async () => !!(await message(bad)), 8000, "bad sticker message");
    expect((await message(bad))!.rich?.sticker).toBeUndefined();
  });
});

describe("search in a conversation", () => {
  it("finds message text in this conversation only, newest first", async () => {
    const other = (await bo.req("POST", "/v1/conversations/group", { name: "Elsewhere", memberIds: [ann.userId] })).conversation.id;
    await until(() => !!web.state.get().conversations[other], 8000, "the other group");
    await bo.send(other, { type: "text", text: "marker in another room" }, "message");
    await until(async () => (await web.conversationMessages(other)).some((m) => m.text.includes("another room")), 8000, "other message");
    const here = await web.searchMessages("marker", group);
    expect(here.length).toBeGreaterThan(0);
    expect(here.every((m) => m.conversationId === group)).toBe(true);
    expect((await web.searchMessages("marker")).some((m) => m.conversationId === other)).toBe(true);
    expect(await web.searchMessages("nothing like this", group)).toEqual([]);
  });

  it("Drafts & sent lists this browser's own latest messages, newest first", async () => {
    const id = await web.sendText(group, "sent from the browser just now");
    const sent = await web.recentSent(5);
    expect(sent[0]?.id).toBe(id);
    expect(sent.every((m) => m.outgoing)).toBe(true);
    expect(sent.map((m) => m.sortTs)).toEqual([...sent.map((m) => m.sortTs)].sort((a, b) => b - a));
  });
});

describe("profile cards (android round 7)", () => {
  it("a profile card from the browser carries no numbers; one from the phone is kept as a profile, numbers dropped", async () => {
    const card = profileCard(bo.userId, "Bo", bo.username)!;
    const id = await web.sendText(group, fallbackText({ contact: card }), { rich: { contact: card } });
    const got = await until(() => bo.received.find((m) => m.messageId === id), 8000, "card on the phone");
    expect(got.payload.contact).toEqual({ name: "Bo", userId: bo.userId, username: bo.username });

    const fromPhone = nodeCrypto.randomUUID();
    await bo.send(group, { type: "text", text: "👤 Ann", contact: { name: "Ann", phones: ["+8801712000000"], userId: ann.userId, username: ann.username } }, "message", fromPhone);
    const shown = await until(async () => (await message(fromPhone))?.rich?.contact, 8000, "card in the browser");
    expect(shown).toEqual({ name: "Ann", phones: [], emails: [], userId: ann.userId, username: ann.username });
  });
});

describe("pinned messages (android round 7)", () => {
  it("the pinned list follows pins from the phone, newest first, and an unpin from the browser reaches the phone", async () => {
    const older = nodeCrypto.randomUUID();
    const newer = nodeCrypto.randomUUID();
    await bo.send(group, { type: "text", text: "agenda for Monday" }, "message", older);
    await bo.send(group, { type: "text", text: "the new office address" }, "message", newer);
    await until(async () => !!(await message(newer)), 8000, "messages in the browser");
    await bo.send(group, { type: "pin", target: older, pinned: true }, "control");
    await bo.send(group, { type: "pin", target: newer, pinned: true }, "control");
    await until(async () => (await web.pinnedMessages(group)).length === 2, 8000, "two pins in the browser");
    expect((await web.pinnedMessages(group)).map((m) => m.id)).toEqual([newer, older]);

    await web.setPinned((await message(older))!, false);
    await until(() => bo.received.some((m) => m.payload.type === "pin" && m.payload.target === older && m.payload.pinned === false), 8000, "unpin on the phone");
    expect((await web.pinnedMessages(group)).map((m) => m.id)).toEqual([newer]);
  });
});

describe("bulk save (android round 7)", () => {
  it("saves several files decrypted into a folder, never overwriting what's there, and reports a file it can't get", async () => {
    const a = new TextEncoder().encode("first report");
    const b = new TextEncoder().encode("second report");
    const file = (name: string, data: Uint8Array) => ({ name, type: "text/plain", size: data.byteLength, bytes: async () => data });
    const id = await sendFiles(web, group, [file("report.txt", a), file("report.txt", b)], "two reports");
    const m = (await message(id))!;
    const plan = planSave([...m.attachments.map((ref) => ({ messageId: id, ref })), { messageId: id, ref: { ...m.attachments[0], id: "att_doesnotexist000000", name: "gone.txt" } }]);
    if (plan.kind !== "ready") throw new Error(plan.kind);
    expect(plan.items.map((i) => i.fileName)).toEqual(["report.txt", "report (1).txt", "gone.txt"]);

    // A folder that already holds a "report.txt" of the person's own.
    const folder = new Map<string, Uint8Array>([["report.txt", new TextEncoder().encode("mine, keep it")]]);
    const dir = {
      async getFileHandle(name: string, o?: { create?: boolean }) {
        if (!folder.has(name) && !o?.create) throw new DOMException("not found", "NotFoundError");
        return {
          async createWritable() {
            const parts: Uint8Array[] = [];
            return {
              async write(d: Blob | Uint8Array) {
                parts.push(d instanceof Uint8Array ? d : new Uint8Array(await d.arrayBuffer()));
              },
              async close() {
                folder.set(name, new Uint8Array(Buffer.concat(parts)));
              },
              async abort() {},
            };
          },
        };
      },
    };
    const status: Record<string, string> = {};
    await runBulkSave(
      web,
      plan.items,
      dir,
      (key, s) => void (status[key] = s),
      () => false,
    );
    const text = (n: string) => new TextDecoder().decode(folder.get(n));
    expect(text("report.txt")).toBe("mine, keep it");
    expect([text("report (1).txt"), text("report (1) (1).txt")].sort()).toEqual(["first report", "second report"].sort());
    expect(saveSummary(status as Record<string, "saved" | "failed">)).toMatchObject({ saved: 2, failed: 1, finished: true, retryable: 1 });
  });
});

describe("group notifications off (android Settings › Notifications)", () => {
  it("groups and channels stay quiet; a mention of you and direct messages still notify", async () => {
    const notified: string[] = [];
    const quiet = (
      await linkBrowser(server, ann, "Meldiq Web · Quiet", {
        notify: (_t: string, body: string) => void notified.push(body),
        prefs: () => ({ readReceipts: true, typing: true, groupNotifications: false }),
      })
    ).engine;
    try {
      const dm = (await bo.req("POST", "/v1/conversations/dm", { userId: ann.userId })).conversation.id as string;
      await until(() => !!quiet.state.get().conversations[dm], 8000, "the DM in the quiet browser");
      await bo.send(group, { type: "text", text: "lunch is here" }, "message");
      await bo.send(group, { type: "text", text: "@ann your order", mentions: [ann.userId] }, "message");
      await bo.send(dm, { type: "text", text: "a direct one" }, "message");
      await until(() => notified.some((b) => b.includes("a direct one")), 8000, "the DM notified");
      expect(notified.some((b) => b.includes("your order"))).toBe(true);
      expect(notified.some((b) => b.includes("lunch is here"))).toBe(false);
    } finally {
      quiet.stop();
    }
  });
});
