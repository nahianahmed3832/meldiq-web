import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { ConversationLocal, StoredMessage } from "../src/model/types";
import { LocalStore } from "../src/store/db";
import { ConversationLocals } from "../src/sync/locals";

/**
 * The browser's per-conversation counters (unread, mentions, preview) are read-modify-write over IndexedDB. Changes to
 * one conversation that overlap must all count: none may write back a value it read before another change landed.
 */
const message = (id: string, sortTs: number): StoredMessage =>
  ({
    id,
    conversationId: "c-1",
    senderUserId: "u-bob",
    senderDeviceId: "d-bob",
    outgoing: false,
    kind: "text",
    text: id,
    replyToId: null,
    threadRootId: null,
    mentions: [],
    mentionAll: false,
    attachments: [],
    sentAt: sortTs,
    serverTs: sortTs,
    sortTs,
    status: "RECEIVED",
    errorText: null,
    editedAt: null,
    deleted: false,
    pinned: false,
    reactions: {},
    readBy: [],
    deliveredTo: [],
    call: null,
    rich: null,
    forwarded: false,
  }) as StoredMessage;

async function locals(name: string) {
  const store = await LocalStore.open(name);
  const published: ConversationLocal[] = [];
  return { store, published, locals: new ConversationLocals(store, { senderName: () => "Bob", publish: (l) => published.push(l) }) };
}

describe("conversation counters in this browser", () => {
  it("count every message that arrives at the same time", async () => {
    const { locals: l } = await locals("locals-concurrent-bumps");
    await Promise.all(Array.from({ length: 5 }, (_, i) => l.bump(message(`m${i}`, 1000 + i), { unread: true, mention: i === 0 })));
    const after = await l.get("c-1");
    expect(after.unread).toBe(5);
    expect(after.mentions).toBe(1);
    expect(after.lastMessageId).toBe("m4");
  });

  it("keep a message that arrives while the conversation is being marked read elsewhere", async () => {
    const { locals: l } = await locals("locals-read-and-bump");
    await l.bump(message("m0", 1000), { unread: true, mention: false });
    // Read on the phone up to m0, while m1 arrives: m1 stays unread whichever runs first.
    await Promise.all([l.readElsewhere("c-1", 1000), l.bump(message("m1", 2000), { unread: true, mention: false })]);
    const after = await l.get("c-1");
    expect(after.readUpTo).toBe(1000);
    expect(after.lastMessageId).toBe("m1");
    // The order is the order the calls were made: the read lands first, then the new message counts.
    expect(after.unread).toBe(1);
  });

  it("publish the final state last", async () => {
    const { locals: l, published } = await locals("locals-publish-order");
    await Promise.all([l.bump(message("a", 1), { unread: true, mention: false }), l.bump(message("b", 2), { unread: true, mention: false })]);
    expect(published.at(-1)?.unread).toBe(2);
  });
});
