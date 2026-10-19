import nodeCrypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Engine } from "../src/sync/engine";
import { voters } from "../src/sync/polls";
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
