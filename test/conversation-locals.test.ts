import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
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

  it("stay unread when another device read only up to an earlier message", async () => {
    const { store, locals: l } = await locals("locals-read-partly");
    for (const [id, ts] of [
      ["m0", 1000],
      ["m1", 2000],
    ] as const) {
      await store.putMessage(message(id, ts));
      await l.bump(message(id, ts), { unread: true, mention: false });
    }
    await l.readElsewhere("c-1", 1000);
    expect((await l.get("c-1")).unread).toBe(2);
    expect((await l.get("c-1")).readUpTo).toBe(1000);
    await l.readElsewhere("c-1", 2000);
    expect((await l.get("c-1")).unread).toBe(0);
  });

  it("publish the final state last", async () => {
    const { locals: l, published } = await locals("locals-publish-order");
    await Promise.all([l.bump(message("a", 1), { unread: true, mention: false }), l.bump(message("b", 2), { unread: true, mention: false })]);
    expect(published.at(-1)?.unread).toBe(2);
  });
});

// Presentation metadata is durable, while its wording follows the current interface locale.
import { prepareLocale, translate } from "../src/i18n";
import { setPrefs } from "../src/application/prefs";
import { conversationPreview } from "../src/sync/rules";

it("relabels cached system previews without translating people, filenames, or message text", async () => {
  await prepareLocale("bn", ["workspace", "common"]);
  const store = await LocalStore.open("locals-locale-preview");
  const l = new ConversationLocals(store, { senderName: () => "You", publish: () => {} });
  const options = { unread: true, mention: false };
  vi.stubGlobal("document", { documentElement: { setAttribute: vi.fn(), removeAttribute: vi.fn(), style: { setProperty: vi.fn(), removeProperty: vi.fn() } }, querySelector: () => null });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "" }));
  try {
    setPrefs({ language: "en" });
    await l.bump({ ...message("photo", 1), text: "", attachments: [{ mime: "image/png", name: "Save.png" }] as StoredMessage["attachments"] }, options);
    const photo = await l.get("c-1");
    expect(conversationPreview(photo)).toBe(translate("en", "workspace.interface.photo_1b13ff9"));
    expect(photo.lastSenderOwn).toBe(false);
    expect(photo.lastSenderName).toBe("You");
    setPrefs({ language: "bn" });
    expect(conversationPreview(photo)).toBe(translate("bn", "workspace.interface.photo_1b13ff9"));
    for (const [index, text] of ["Photo", "Save"].entries()) {
      await l.bump({ ...message("literal" + index, 2 + index), text }, options);
      expect(conversationPreview(await l.get("c-1"))).toBe(text);
    }
    await l.bump({ ...message("file", 4), text: "", outgoing: true, attachments: [{ mime: "application/pdf", name: "Save.pdf" }] as StoredMessage["attachments"] }, options);
    const file = await l.get("c-1");
    expect(conversationPreview(file)).toBe("📎 Save.pdf");
    expect(file.lastSenderOwn).toBe(true);
  } finally {
    setPrefs({ language: "en" });
    store.close();
    vi.unstubAllGlobals();
  }
});
