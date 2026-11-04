import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import type { Conversation, ServerInfo, StoredEvent } from "../src/api/schemas";
import type { DeviceRecord } from "../src/model/types";
import { initialState, Store } from "../src/state/store";
import { LocalStore } from "../src/store/db";
import { Engine } from "../src/sync/engine";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const f of cleanup.splice(0)) await f();
  vi.restoreAllMocks();
});
it("sends all filters and paired page cursors to the server, applies changes, and isolates search from the reader", async () => {
  const cid = "c_search";
  const store = await LocalStore.open(`filtered-search-${Math.random()}`);
  const state = new Store({ ...initialState, server: { features: ["filtered-message-search"] } as ServerInfo, conversations: { [cid]: { id: cid, type: "DM", memberCount: 2 } as Conversation } });
  const engine = new Engine({ userId: "u_me", deviceId: "d_web" } as DeviceRecord, store, { base: "http://meldiq.test", wsUrl: "ws://meldiq.test/v1/ws" }, state);
  cleanup.push(async () => {
    engine.stop();
    await LocalStore.erase(store);
  });
  vi.spyOn(engine, "ensureUser").mockResolvedValue();
  const event = (id: string, ts: number, payload = { type: "text", text: id } as Record<string, unknown>): StoredEvent => ({
    id,
    conversationId: cid,
    serverTs: ts,
    sentAt: ts,
    senderUserId: "u_peer",
    senderDeviceId: null,
    cls: payload.type === "text" ? "message" : "control",
    payload,
    importedBy: null,
    mentionAll: false,
  });
  const api = vi.spyOn(engine.api, "json").mockResolvedValueOnce({
    messages: [event("m_new", 200), event("m_old", 100)],
    changes: [
      event("edit_old", 201, { type: "edit", target: "m_old", text: "edited result" }),
      event("pin_old", 202, { type: "pin", target: "m_old", pinned: true }),
      { ...event("foreign_ctl", 203, { type: "edit", target: "m_old", text: "forbidden" }), conversationId: "other_conversation" },
    ],
    more: true,
    nextCursor: { serverTs: 100, id: "m_old" },
  });
  const before = state.get().messages;
  await store.putConversation({ id: cid, unread: 5, mentions: 2, readUpTo: 42, lastActivityAt: 0, lastMessageId: null, lastPreview: null, lastSenderName: null, draft: "" });
  const page = await engine.searchMessagePage('from:"Peer Name" has:image mentions:me in:"test channel" is:pinned during:2026-11-04', cid);
  expect(page.items.map((m) => [m.id, m.text])).toEqual([
    ["m_new", "m_new"],
    ["m_old", "edited result"],
  ]);
  expect(page.items[1]?.pinned).toBe(true);
  expect(page.more).toBe(true);
  expect(state.get().messages).toBe(before);
  expect(state.get().local[cid]).toMatchObject({ unread: 5, mentions: 2, readUpTo: 42 });
  const params = new URL(api.mock.calls[0]![1], "http://meldiq.test").searchParams;
  for (const [key, value] of Object.entries({ q: "", from: "peer name", has: "image", mentions: "me", in: "test channel", pinned: "true", conversationId: cid })) expect(params.get(key)).toBe(value);
  expect(Number(params.get("before"))).toBeGreaterThan(Number(params.get("after")));
  api.mockRejectedValueOnce(new Error("temporary search outage"));
  await expect(engine.searchMessagePage("needle", cid, page.nextCursor)).rejects.toThrow("temporary search outage");
  api.mockResolvedValueOnce({ messages: [event("m_older", 90)], changes: [], more: false, nextCursor: null });
  const next = await engine.searchMessagePage("needle", cid, page.nextCursor);
  expect(next.items.map((m) => m.id)).toEqual(["m_older"]);
  const cursor = new URL(api.mock.calls[2]![1], "http://meldiq.test").searchParams;
  expect(cursor.get("cursorTs")).toBe("100");
  expect(cursor.get("cursorId")).toBe("m_old");
  expect(state.get().messages).toBe(before);
});
