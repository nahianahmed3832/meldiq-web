import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Conversation, ServerInfo, StoredEvent } from "../src/api/schemas";
import { zMessageCollection } from "../src/api/messageCollections";
import type { DeviceRecord } from "../src/model/types";
import { initialState, Store } from "../src/state/store";
import { LocalStore } from "../src/store/db";
import { Engine } from "../src/sync/engine";
import { collectionThreads } from "../src/sync/messageCollections";

const cid = "c_collection";
const event = (id: string, ts: number, payload: Record<string, unknown> = { type: "text", text: id }, cls: "message" | "control" = "message"): StoredEvent => ({
  id,
  conversationId: cid,
  serverTs: ts,
  sentAt: ts,
  cls,
  senderUserId: "u_peer",
  senderDeviceId: null,
  payload,
  mentionAll: false,
  importedBy: null,
});
const response = (messages: StoredEvent[], changes: StoredEvent[] = []) => ({ historySince: null, messages, context: [], changes, threads: [], more: false, nextCursor: null });
const cleanup: (() => Promise<void>)[] = [];
async function setup() {
  const store = await LocalStore.open(`collections-${Math.random()}`);
  const device = { userId: "u_me", deviceId: "d_web", keys: { signingPublic: "c2lnbg==" }, history: null } as unknown as DeviceRecord;
  const state = new Store({ ...initialState, conversations: { [cid]: { id: cid, type: "CHANNEL", orgId: null, memberCount: 0, canPost: true } as Conversation } });
  const engine = new Engine(device, store, { base: "http://meldiq.test", wsUrl: "ws://meldiq.test/v1/ws" }, state);
  vi.spyOn(engine, "ensureUser").mockResolvedValue();
  const api = vi.spyOn(engine.api, "json");
  cleanup.push(async () => {
    engine.stop();
    await LocalStore.erase(store);
  });
  return { engine, api, store, state };
}
afterEach(async () => {
  for (const f of cleanup.splice(0)) await f();
  vi.restoreAllMocks();
});

describe("shared message collections", () => {
  it("pairs an older around-window cursor before returning to independent main history", async () => {
    const { engine, api, state } = await setup();
    state.update((s) => ({ ...s, server: { features: ["message-collections"] } as ServerInfo }));
    vi.spyOn(engine, "syncSummaries").mockResolvedValue();
    vi.spyOn(engine, "syncCalls").mockResolvedValue();
    api
      .mockResolvedValueOnce(response([event("newest_root", 100)]))
      .mockResolvedValueOnce({ messages: [event("around_root", 50)], changes: [], more: true })
      .mockResolvedValueOnce(response([event("earlier_root", 10)]));
    await engine.openConversation(cid);
    await engine.loadAround(cid, "around_root");
    await engine.loadOlder(cid);
    const query = new URL(api.mock.calls[2]![1], "http://meldiq.test");
    expect(query.pathname).toContain("message-collections");
    expect(query.searchParams.get("before")).toBe("50");
    expect(query.searchParams.get("beforeId")).toBe("around_root");
    expect(state.get().messages[cid]?.items.map((m) => m.id)).toEqual(["earlier_root", "around_root"]);
  });
  it("shares one count request between message lists and clears vanished threads after a complete index", async () => {
    const { engine, api, state } = await setup();
    state.update((s) => ({ ...s, server: { features: ["message-collections"] } as ServerInfo, serverThreadCounts: { [cid]: { removed_root: 4 } } }));
    api.mockResolvedValueOnce({ ...response([]), threads: [{ rootId: "main_root", replyCount: 125, lastReplyTs: 900 }] });
    await Promise.all([engine.refreshThreadCounts(cid), engine.refreshThreadCounts(cid)]);
    expect(api).toHaveBeenCalledTimes(1);
    expect(state.get().serverThreadCounts[cid]).toEqual({ removed_root: 0, main_root: 125 });
  });
  it("uses an independent main timeline page on capable servers", async () => {
    const { engine, api, state } = await setup();
    state.update((s) => ({ ...s, server: { features: ["message-collections"] } as ServerInfo }));
    vi.spyOn(engine, "syncSummaries").mockResolvedValue();
    vi.spyOn(engine, "syncCalls").mockResolvedValue();
    api.mockResolvedValueOnce(response([event("main_root", 100)]));
    await engine.openConversation(cid);
    expect(api.mock.calls[0]?.[1]).toBe(`/v2/conversations/${cid}/message-collections?limit=60&kind=main`);
    expect(state.get().messages[cid]?.items.map((m) => m.id)).toEqual(["main_root"]);
  });
  it("rejects a truncated cursor instead of silently truncating history", () => {
    expect(zMessageCollection.safeParse({ ...response([]), more: true }).success).toBe(false);
    expect(zMessageCollection.safeParse(response([])).success).toBe(true);
  });
  it("uses paired cursors, applies controls and keeps collection results out of the active timeline", async () => {
    const { engine, api, state } = await setup();
    state.update((s) => ({ ...s, messages: { [cid]: { items: [], hasMore: true } } }));
    const read = vi.spyOn(engine, "markReadSoon");
    const notify = vi.spyOn(engine, "notifyIncoming");
    api.mockResolvedValueOnce(response([event("old_message", 100)], [event("pin_control", 101, { type: "pin", target: "old_message", pinned: true }, "control")]));
    const page = await engine.messageCollection(cid, "pins", { serverTs: 200, id: "tie_cursor" });
    expect(api.mock.calls[0]?.[1]).toBe(`/v2/conversations/${cid}/message-collections?kind=pins&limit=50&before=200&beforeId=tie_cursor`);
    expect(page.messages[0]).toMatchObject({ id: "old_message", pinned: true });
    expect(state.get().messages[cid]?.items).toEqual([]);
    expect(state.get().collectionRev).toBe(0);
    expect(read).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
  it("keeps replies reachable when their root is outside the viewer's history", async () => {
    const { engine, api } = await setup();
    api.mockResolvedValueOnce({ ...response([event("reply_later", 300, { type: "text", text: "Available reply", threadRoot: "hidden_root" })]), threads: [] });
    const page = await engine.messageCollection(cid, "thread", null, "hidden_root");
    expect(page.context).toEqual([]);
    expect(page.messages[0]).toMatchObject({ text: "Available reply", threadRootId: "hidden_root" });
    expect(api.mock.calls[0]?.[1]).toContain("root=hidden_root");
  });
  it("does not ingest another conversation's events", async () => {
    const { engine, api, store } = await setup();
    api.mockResolvedValueOnce(response([{ ...event("foreign_id", 100), conversationId: "other_conversation" }]));
    await expect(engine.messageCollection(cid, "media")).rejects.toThrow("another conversation");
    expect(await store.message("foreign_id")).toBeNull();
  });
  it("uses authoritative thread counts even without any cached replies or root", () => {
    const rows = collectionThreads({ messages: [], context: [], threads: [{ rootId: "hidden_root", replyCount: 10501, lastReplyTs: 500 }], more: false, nextCursor: null });
    expect(rows).toEqual([{ rootId: "hidden_root", title: "Earlier thread", senderId: "", outgoing: false, replies: 10501, lastReplyTs: 500 }]);
  });
});
