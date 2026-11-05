import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { StoredEvent } from "../src/api/schemas";
import type { EngineContext } from "../src/sync/context";
import { Receiver } from "../src/sync/receiver";
import { hideCachedStarboard } from "../src/sync/starboardProjection";
import { LocalStore } from "../src/store/db";
import { historyUploadable, mergeHistory } from "../src/protocol/history";

const bot = "u_board";
const base = {
  id: "m_copy",
  conversationId: "c_board",
  senderUserId: bot,
  senderDeviceId: null,
  cls: "message",
  sentAt: 990,
  serverTs: 1000,
  mentionAll: false,
  importedBy: null,
} as const;
const original = {
  ...base,
  payload: {
    type: "text",
    text: "Original private fixture",
    starboard: { channelId: "c_source", messageId: "m_source" },
    attachments: [{ id: "a_original", name: "picture.png", mime: "image/png", size: 12, key: "test-key", nonce: "test-nonce", sha256: "test-digest" }],
    buttons: [{ kind: "link", label: "Jump to message", emoji: null, url: "https://web.meldiq.app/m/c_source/m_source" }],
  },
};
const hidden = { ...base, payload: { type: "text", text: "Original message unavailable." } };

async function withReceiver(test: (receiver: Receiver, store: LocalStore) => Promise<void>) {
  const store = await LocalStore.open("starboard-" + crypto.randomUUID());
  const ctx = {
    store,
    device: { userId: "u_me" },
    ensureConversation: async () => null,
    refreshPreview: async () => undefined,
    state: { get: () => ({ messages: {} }), update: () => undefined },
    show: () => undefined,
  } as unknown as EngineContext;
  try {
    await test(new Receiver(ctx), store);
  } finally {
    await LocalStore.erase(store);
  }
}
const page = (receiver: Receiver, event: StoredEvent) => receiver.ingest(event, 0, { history: true });

describe("Starboard's projection replaces previously authorized cached data", () => {
  it("scrubs a saved copy on fresh history, retains unrelated state, and ignores old count edits", () =>
    withReceiver(async (r, store) => {
      await page(r, original);
      const prior = (await store.message(base.id))!;
      expect(prior).toMatchObject({ text: "Original private fixture", attachments: [{ id: "a_original" }], rich: { buttons: [{ kind: "link" }] } });
      // Simulate a copy cached before the browser recognized source-bound messages.
      const { starboard: _marker, ...legacy } = prior;
      await store.putMessage({ ...legacy, pinned: true, reactions: { "⭐": ["u_me"] } });
      await page(r, hidden);
      await page(r, { ...base, cls: "control", id: "old-count", serverTs: 2000, payload: { type: "edit", target: base.id, text: "Old count included original text" } });
      const refreshed = (await store.message(base.id))!;
      expect(refreshed).toMatchObject({ starboard: "unavailable", text: "That message is no longer available.", attachments: [], rich: null, pinned: true, reactions: { "⭐": ["u_me"] } });
      expect(mergeHistory(refreshed, { ...prior, editedAt: 9000 })).toBeNull();
      // A subsequent authorized history response may supply the source again.
      await page(r, original);
      expect(await store.message(base.id)).toMatchObject({ starboard: "available", text: "Original private fixture", attachments: [{ id: "a_original" }] });
    }));

  it("does not publish known copies to account backups or show cached text and attachment keys before revalidation", () =>
    withReceiver(async (r, store) => {
      await page(r, original);
      const cached = (await store.message(base.id))!;
      expect(historyUploadable(cached)).toBe(false);
      expect(hideCachedStarboard(cached)).toMatchObject({ starboard: "unavailable", attachments: [], rich: null });
      expect(cached.text).toBe("Original private fixture");
      await r.ingest({ ...base, id: "revoked-edit", cls: "control", serverTs: 3000, payload: { type: "edit", target: base.id, text: "Original message unavailable." } });
      expect(await store.message(base.id)).toMatchObject({ starboard: "unavailable", attachments: [], rich: null });
    }));
});
