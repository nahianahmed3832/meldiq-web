import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { StoredEvent } from "../src/api/schemas";
import type { StoredMessage } from "../src/model/types";
import { LocalStore } from "../src/store/db";
import type { EngineContext } from "../src/sync/context";
import { Receiver } from "../src/sync/receiver";

/**
 * The owner's bug (2026-10-29): your messages showed "seen" until a reload, then a single tick. The browser keeps no
 * messages between page loads, so after one it rebuilds a conversation from a history page: its messages, then its
 * changes, as engine.fetchHistory applies them. Read ticks come back only from the other person's read receipts in
 * those changes (API 0.65.0 serves each other member's newest one with every page).
 */
const ME = "u_alice";
const BOB = "u_bob";
const CONV = "c_dm";

const event = (id: string, senderUserId: string, serverTs: number, cls: StoredEvent["cls"], payload: Record<string, unknown>): StoredEvent => ({
  id,
  conversationId: CONV,
  senderUserId,
  senderDeviceId: null,
  cls,
  payload,
  sentAt: serverTs - 1,
  serverTs,
  mentionAll: false,
  importedBy: null,
});

async function reload(page: { messages: StoredEvent[]; changes: StoredEvent[] }): Promise<StoredMessage[]> {
  const store = await LocalStore.open(`history-reads-${Math.random()}`);
  const ctx = {
    store,
    device: { userId: ME },
    ensureConversation: async () => null,
    ensureUser: async () => undefined,
    show: () => undefined,
  } as unknown as EngineContext;
  const r = new Receiver(ctx);
  for (const e of [...page.messages].reverse()) await r.ingest(e, 0, { history: true });
  for (const e of page.changes) await r.ingest(e, 0, { history: true });
  const out = await store.latestMessages(CONV, 10);
  await LocalStore.erase(store);
  return out;
}

describe("read ticks after a reload", () => {
  const messages = [event("m3", ME, 3000, "message", { type: "text", text: "three" }), event("m2", ME, 2000, "message", { type: "text", text: "two" }), event("m1", ME, 1000, "message", { type: "text", text: "one" })];

  it("your messages up to the other person's read receipt show as read, later ones as sent", async () => {
    const read = event("r1", BOB, 2500, "control", { type: "read", upTo: 2000 });
    const out = await reload({ messages, changes: [read] });
    expect(out.map((m) => [m.id, m.status, m.readBy])).toEqual([
      ["m1", "READ", [BOB]],
      ["m2", "READ", [BOB]],
      ["m3", "SENT", []],
    ]);
  });

  it("your own read receipt from another device doesn't mark your messages read", async () => {
    const mine = event("r2", ME, 3500, "control", { type: "read", upTo: 3000 });
    const out = await reload({ messages, changes: [mine] });
    expect(out.every((m) => m.status === "SENT")).toBe(true);
  });
});
