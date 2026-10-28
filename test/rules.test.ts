import { describe, expect, it } from "vitest";
import type { Member, QueueItem } from "../src/api/schemas";
import type { StoredMessage } from "../src/model/types";
import { decodeHistoryRecord, mergeHistory } from "../src/protocol/history";
import { encodePayload, parsePayload, safeFileName } from "../src/protocol/payload";
import { activeMentionQuery, resolveMentions } from "../src/sync/mentions";
import { applyDelete, applyDelivered, applyEdit, applyReaction, applyRead, preview, receivedMentions, sendsReadReceipts, textMessage } from "../src/sync/rules";
import { browserDeviceName } from "../src/sync/session";
import { readVectors } from "./support/reference";

const item = (over: Partial<QueueItem> = {}): QueueItem => ({
  id: 1,
  kind: "envelope",
  conversationId: "c-1",
  messageId: "m-1",
  senderUserId: "u-bob",
  senderDeviceId: "d-bob",
  createdAt: 1000,
  expiresAt: 2000,
  payload: { cls: "message", sentAt: 900, serverTs: 1000 },
  ...over,
});

const msg = (over: Partial<StoredMessage> = {}): StoredMessage => ({
  ...textMessage({ type: "text", text: "hello" }, item(), false, 1000, { ids: [], all: false }),
  ...over,
});

describe("payload wire format (android griip-payload-v1-vectors.json)", () => {
  const v = readVectors<{ payloads: { name: string; json: Record<string, unknown> }[]; forwardCompatible: { name: string; json: Record<string, unknown> }[] }>("griip-payload-v1-vectors.json");

  it.each(v.payloads.map((p) => [p.name, p.json] as const))("%s parses and re-encodes to the same JSON", (_name, json) => {
    const p = parsePayload(JSON.stringify(json));
    expect(p).not.toBeNull();
    expect(JSON.parse(encodePayload(p!))).toEqual(json);
  });

  it("accepts newer apps' types and fields without breaking", () => {
    for (const f of v.forwardCompatible) expect(parsePayload(JSON.stringify(f.json))).not.toBeNull();
    expect(parsePayload(JSON.stringify(v.forwardCompatible[1].json))).toEqual({ type: "text", text: "hi" });
  });

  it("refuses what isn't a payload", () => {
    expect(parsePayload("not json")).toBeNull();
    expect(parsePayload(JSON.stringify({ text: "no type" }))).toBeNull();
    expect(parsePayload(JSON.stringify({ type: "text", attachments: [{ id: "a" }] }))).toBeNull();
  });

  it("refuses link previews that aren't web links (a javascript: URL from another device never becomes a link)", () => {
    expect(parsePayload(JSON.stringify({ type: "text", text: "x", link: { url: "javascript:alert(1)" } }))).toBeNull();
    expect(parsePayload(JSON.stringify({ type: "text", text: "x", link: { url: "data:text/html,hi" } }))).toBeNull();
    expect(parsePayload(JSON.stringify({ type: "text", text: "x", link: { url: "https://example.org/a" } }))?.link?.url).toBe("https://example.org/a");
    const row = { id: "m", conversationId: "c", senderUserId: "u", outgoing: false, kind: "text", sentAt: 1, sortTs: 1, richJson: JSON.stringify({ link: { url: "javascript:alert(1)" } }) };
    expect(decodeHistoryRecord(JSON.stringify({ v: 1, message: row }))?.message?.rich).toBeNull();
  });

  it("cleans file names that could disguise a file type", () => {
    expect(safeFileName("photo\u202Egpj.exe")).toBe("photogpj.exe");
    expect(safeFileName("\u0000\u0007")).toBe("file");
  });
});

describe("applying received payloads (same outcome as the phone)", () => {
  it("only the author edits or deletes", () => {
    const m = msg();
    expect(applyEdit(m, "u-mallory", { type: "edit", text: "x" }, 2000)).toBeNull();
    expect(applyEdit(m, "u-bob", { type: "edit", text: "fixed" }, 2000)).toMatchObject({ text: "fixed", editedAt: 2000 });
    expect(applyDelete(m, "u-mallory")).toBeNull();
    expect(applyDelete(m, "u-bob")).toMatchObject({ deleted: true, text: "", attachments: [] });
    expect(applyEdit({ ...m, deleted: true }, "u-bob", { type: "edit", text: "back" }, 3000)).toBeNull();
  });

  it("reactions toggle per person and disappear when empty", () => {
    let m = applyReaction(msg(), "u-a", "👍", true);
    m = applyReaction(m, "u-a", "👍", true);
    m = applyReaction(m, "u-b", "👍", true);
    expect(m.reactions["👍"]).toEqual(["u-a", "u-b"]);
    m = applyReaction(applyReaction(m, "u-a", "👍", false), "u-b", "👍", false);
    expect(m.reactions).toEqual({});
  });

  it("receipts move status forward, never back", () => {
    const sent = msg({ outgoing: true, status: "SENT" });
    expect(applyDelivered(sent, "u-b").status).toBe("DELIVERED");
    expect(applyDelivered(applyRead(sent, "u-b"), "u-c").status).toBe("READ");
    expect(applyRead(applyRead(sent, "u-b"), "u-b").readBy).toEqual(["u-b"]);
  });

  it("@everyone counts only with the server's mark, and never in a DM", () => {
    const p = { type: "text", text: "@everyone", mentionAll: true, mentions: ["u-a", "u-a", ""] };
    expect(receivedMentions(p, true, "CHANNEL")).toEqual({ ids: ["u-a"], all: true });
    expect(receivedMentions(p, false, "CHANNEL").all).toBe(false);
    expect(receivedMentions(p, true, "DM").all).toBe(false);
  });

  it("caps received attachments and orders by server time", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `a${i}`, name: `f${i}`, mime: "image/png", size: 1, key: "k", nonce: "n", sha256: "h" }));
    const m = textMessage({ type: "text", text: "", attachments: many }, item(), false, 1234, { ids: [], all: false });
    expect(m.attachments).toHaveLength(20);
    expect(m.sortTs).toBe(1234);
    expect(m.sentAt).toBe(900);
  });

  it("previews read like the phone's chat list", () => {
    expect(preview(msg({ deleted: true }))).toBe("Message deleted");
    expect(preview(msg({ text: "", attachments: [{ id: "a", name: "x.png", mime: "image/png", size: 1, key: "", nonce: "", sha256: "" }] }))).toBe("📷 Photo");
    expect(preview(msg({ text: "", attachments: [{ id: "a", name: "v.m4a", mime: "audio/mp4", size: 1, key: "", nonce: "", sha256: "", voice: true }] }))).toBe("🎤 Voice message");
    expect(preview(msg({ text: "see", attachments: [{ id: "a", name: "x.pdf", mime: "application/pdf", size: 1, key: "", nonce: "", sha256: "" }] }))).toBe("📎 see");
  });

  it("read receipts only in DMs and groups of up to 20 where one can post", () => {
    expect(sendsReadReceipts("DM", 2, true)).toBe(true);
    expect(sendsReadReceipts("GROUP", 21, true)).toBe(false);
    expect(sendsReadReceipts("CHANNEL", 3, true)).toBe(false);
    expect(sendsReadReceipts("GROUP", 3, false)).toBe(false);
  });
});

describe("mentions", () => {
  const members: Member[] = [
    {
      id: "u-sam",
      username: "sam",
      displayName: "Sam",
      avatarColor: 0,
      statusText: null,
      statusEmoji: null,
      notificationsPaused: null,
      photoRev: null,
      homeServer: null,
      role: null,
      orgRole: null,
      online: null,
      presence: null,
      pronouns: null,
      avatarMedia: null,
      profileStyle: null,
      tag: null,
    },
    {
      id: "u-me",
      username: "me",
      displayName: "Me",
      avatarColor: 0,
      statusText: null,
      statusEmoji: null,
      notificationsPaused: null,
      photoRev: null,
      homeServer: null,
      role: null,
      orgRole: null,
      online: null,
      presence: null,
      pronouns: null,
      avatarMedia: null,
      profileStyle: null,
      tag: null,
    },
  ];

  it("resolve only against the conversation's members, never myself", () => {
    expect(resolveMentions("@sam and @nobody and @me", members, false, "u-me")).toEqual({ ids: ["u-sam"], all: false });
    expect(resolveMentions("mail me at a@sam.com", members, false, "u-me").ids).toEqual([]);
  });

  it("@everyone only where it's allowed", () => {
    expect(resolveMentions("@everyone look", members, true, "u-me").all).toBe(true);
    expect(resolveMentions("@everyone look", members, false, "u-me").all).toBe(false);
  });

  it("find the query under the caret", () => {
    expect(activeMentionQuery("hi @sa", 6)).toEqual({ start: 3, query: "sa" });
    expect(activeMentionQuery("a@sa", 4)).toBeNull();
    expect(activeMentionQuery("hi @sa there", 12)).toBeNull();
  });
});

describe("history records (the phone's Room rows)", () => {
  const row = {
    id: "m-9",
    conversationId: "c-1",
    senderUserId: "u-bob",
    senderDeviceId: "d-bob",
    outgoing: false,
    kind: "text",
    text: "hi",
    mentionsJson: '["u-me","@everyone"]',
    attachmentsJson: "not json",
    sentAt: 1,
    serverTs: 2,
    sortTs: 2,
    status: "RECEIVED",
    deleted: false,
    pinned: true,
    reactionsJson: '{"🎉":["u-me"]}',
    readByJson: "[]",
    deliveredToJson: "[]",
    forwarded: false,
    someNewField: 42,
  };

  it("decode tolerantly: a malformed inner field becomes empty, unknown fields are dropped", () => {
    const r = decodeHistoryRecord(JSON.stringify({ v: 1, message: row }));
    expect(r?.message).toMatchObject({ id: "m-9", text: "hi", mentions: ["u-me"], mentionAll: true, attachments: [], pinned: true, reactions: { "🎉": ["u-me"] } });
    expect(decodeHistoryRecord("{")).toBeNull();
    expect(decodeHistoryRecord(JSON.stringify({ v: 1, message: { ...row, kind: "undecryptable" } }))?.message).toBeNull();
    expect(decodeHistoryRecord(JSON.stringify({ v: 1, conversation: { id: "c-1", muted: true } }))?.conversationId).toBe("c-1");
  });

  it("merge: only later edits and deletions change a message this browser already has", () => {
    const local = msg({ text: "mine", editedAt: 5 });
    expect(mergeHistory(null, local)).toBe(local);
    expect(mergeHistory(local, { ...local, text: "older", editedAt: 4 })).toBeNull();
    expect(mergeHistory(local, { ...local, text: "newer", editedAt: 6 })?.text).toBe("newer");
    expect(mergeHistory(local, { ...local, deleted: true })).toMatchObject({ deleted: true, text: "" });
  });
});

describe("device name", () => {
  it("names the browser and system for the device list", () => {
    expect(browserDeviceName("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36")).toBe("Meldiq Web · Chrome on macOS");
    expect(browserDeviceName("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0")).toBe("Meldiq Web · Firefox on Windows");
  });
});
