import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Conversation, ServerHistoryPage, StoredEvent } from "../src/api/schemas";
import type { DeviceRecord, StoredMessage } from "../src/model/types";
import { initialState, Store, upsertLoaded, withMessages } from "../src/state/store";
import { LocalStore } from "../src/store/db";
import { Engine } from "../src/sync/engine";

const CONV = "c_history";
const device = { userId: "u_me", deviceId: "d_web", keys: { signingPublic: "c2lnbg==" }, history: null } as unknown as DeviceRecord;
const event = (id: string, ts: number, conversationId = CONV): StoredEvent => ({
  id,
  conversationId,
  serverTs: ts,
  sentAt: ts,
  cls: "message",
  senderUserId: "u_bob",
  senderDeviceId: null,
  payload: { type: "text", text: id },
  mentionAll: false,
  importedBy: null,
});
const page = (messages: StoredEvent[], more = false): ServerHistoryPage => ({ messages, changes: [], more });
const message = (id: string, sortTs: number): StoredMessage => ({ id, sortTs, serverTs: sortTs, conversationId: CONV, text: id, outgoing: false, kind: "text", threadRootId: null }) as StoredMessage;
const ids = (engine: Engine) => engine.state.get().messages[CONV]?.items.map((m) => m.id);
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
const cleanups: (() => Promise<void>)[] = [];
async function setup() {
  const store = await LocalStore.open(`history-navigation-${Math.random()}`);
  const conversation = { id: CONV, type: "CHANNEL", orgId: null, memberCount: 0, canPost: false } as Conversation;
  const state = new Store({ ...initialState, conversations: { [CONV]: conversation } });
  const engine = new Engine(device, store, { base: "http://meldiq.test", wsUrl: "ws://meldiq.test/v1/ws" }, state);
  vi.spyOn(engine, "syncCalls").mockResolvedValue();
  vi.spyOn(engine, "syncSummaries").mockResolvedValue();
  vi.spyOn(engine, "ensureUser").mockResolvedValue();
  cleanups.push(async () => {
    engine.stop();
    await LocalStore.erase(store);
  });
  return { engine, store, api: vi.spyOn(engine.api, "json") };
}
afterEach(async () => {
  vi.useRealTimers();
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("history navigation", () => {
  it("reopens a detached conversation with a fresh newest page", async () => {
    const { engine, api } = await setup();
    api
      .mockResolvedValueOnce(page([event("m100", 100)], true))
      .mockResolvedValueOnce(page([event("m10", 10)], true))
      .mockResolvedValueOnce(page([event("m101", 101), event("m100", 100)], true));
    await engine.openConversation(CONV);
    await engine.loadAround(CONV, "m10");
    await engine.openConversation(null);
    await engine.openConversation(CONV);
    expect(api).toHaveBeenCalledTimes(3);
    expect(api.mock.calls[2]?.[1]).not.toContain("around=");
    expect(ids(engine)).toEqual(["m100", "m101"]);
    expect(engine.state.get().messages[CONV]).toMatchObject({ detached: false, historyReady: true });
  });

  it("does not reuse an earlier opening's in-flight request or publish it over the new opening", async () => {
    const { engine, api } = await setup();
    const stale = deferred<ServerHistoryPage>();
    const fresh = deferred<ServerHistoryPage>();
    api.mockImplementationOnce(() => stale.promise).mockImplementationOnce(() => fresh.promise);
    const first = engine.openConversation(CONV);
    await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(1));
    await engine.openConversation(null);
    const second = engine.openConversation(CONV);
    await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    fresh.resolve(page([event("m200", 200)], true));
    await second;
    stale.resolve(page([event("m100", 100)], false));
    await first;
    expect(ids(engine)).toEqual(["m200"]);
    expect(engine.state.get().messages[CONV]?.hasMore).toBe(true);
  });

  it("reopening replaces cached timestamp ties and edits with the fresh bounded page", async () => {
    const { engine, api } = await setup();
    api
      .mockResolvedValueOnce(page([event("m_c", 1000), event("m_b", 1000)], true))
      .mockResolvedValueOnce(page([event("m_a", 1000)]))
      .mockResolvedValueOnce({ ...page([event("m_c", 1000)], true), changes: [{ ...event("edit_c", 1001), cls: "control", payload: { type: "edit", target: "m_c", text: "edited on the server" } }] });
    await engine.openConversation(CONV);
    await engine.loadOlder(CONV);
    expect(ids(engine)).toEqual(["m_a", "m_b", "m_c"]);
    await engine.openConversation(null);
    await engine.openConversation(CONV);
    expect(ids(engine)).toEqual(["m_c"]);
    expect(engine.state.get().messages[CONV]?.items[0]?.text).toBe("edited on the server");
  });

  it("preserves an arrival delivered while the opening reads its cached window", async () => {
    const { engine, store, api } = await setup();
    const cached = deferred<StoredMessage[]>();
    const cacheRead = vi.spyOn(store, "latestMessages").mockImplementationOnce(() => cached.promise);
    api.mockResolvedValueOnce(page([event("m100", 100)], true));
    const opening = engine.openConversation(CONV);
    await vi.waitFor(() => expect(cacheRead).toHaveBeenCalled());
    const incoming = message("m101", 101);
    await store.putMessage(incoming);
    engine.show(incoming);
    cached.resolve([message("m100", 100)]);
    await opening;
    expect(ids(engine)).toEqual(["m100", "m101"]);
  });

  it("requests the newest page while summaries are still pending", async () => {
    const { engine, api } = await setup();
    const summaries = deferred<void>();
    vi.mocked(engine.syncSummaries).mockImplementationOnce(() => summaries.promise);
    api.mockResolvedValueOnce(page([event("latest", 100)]));
    const opening = engine.openConversation(CONV);
    await vi.waitFor(() => expect(api).toHaveBeenCalled());
    expect(engine.state.get().messages[CONV]?.historyReady).toBe(false);
    summaries.resolve();
    await opening;
    expect(ids(engine)).toEqual(["latest"]);
    expect(engine.state.get().messages[CONV]?.historyReady).toBe(true);
  });

  it("renders history without waiting for individual sender profiles", async () => {
    const { engine, api } = await setup();
    const profile = deferred<void>();
    vi.mocked(engine.ensureUser).mockImplementationOnce(() => profile.promise);
    api.mockResolvedValueOnce(page([event("latest", 100)]));
    const done = vi.fn();
    const opening = engine.openConversation(CONV).then(done);
    await vi.waitFor(() => expect(done).toHaveBeenCalled());
    expect(ids(engine)).toEqual(["latest"]);
    profile.resolve();
    await opening;
  });

  it("coalesces button/scroll pagination and merges overlapping pages by ID", async () => {
    const { engine, api } = await setup();
    const older = deferred<ServerHistoryPage>();
    api.mockResolvedValueOnce(page([event("m3", 3), event("m2", 2)], true)).mockImplementationOnce(() => older.promise);
    await engine.openConversation(CONV);
    const a = engine.loadOlder(CONV);
    const b = engine.loadOlder(CONV);
    expect(a).toBe(b);
    expect(api).toHaveBeenCalledTimes(2);
    older.resolve(page([event("m2", 2), event("m1", 1)]));
    await Promise.all([a, b]);
    expect(ids(engine)).toEqual(["m1", "m2", "m3"]);
    expect(engine.state.get().messages[CONV]?.hasMore).toBe(false);
  });

  it("uses the advertised composite cursor so timestamp ties cross page boundaries", async () => {
    const { engine, api } = await setup();
    api
      .mockResolvedValueOnce({ ...page([event("m_c", 1000), event("m_b", 1000)], true), nextCursor: { serverTs: 1000, id: "m_b" } })
      .mockResolvedValueOnce({ ...page([event("m_a", 1000)]), nextCursor: null });
    await engine.openConversation(CONV);
    await engine.loadOlder(CONV);
    expect(api.mock.calls[1]?.[1]).toContain("before=1000&beforeId=m_b");
    expect(ids(engine)).toEqual(["m_a", "m_b", "m_c"]);
  });

  it("keeps a failed page retryable without advancing or emptying the history", async () => {
    const { engine, api } = await setup();
    api
      .mockResolvedValueOnce(page([event("m3", 3)], true))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(page([event("m2", 2)]));
    await engine.openConversation(CONV);
    await engine.loadOlder(CONV);
    expect(ids(engine)).toEqual(["m3"]);
    expect(engine.state.get().messages[CONV]?.hasMore).toBe(true);
    expect(engine.state.get().notices.at(-1)?.text).toContain("Couldn't load earlier");
    await engine.loadOlder(CONV);
    expect(api.mock.calls[1]?.[1]).toBe(api.mock.calls[2]?.[1]);
    expect(ids(engine)).toEqual(["m2", "m3"]);
  });

  it("keeps a distant result contiguous, updates its messages, and returns to latest explicitly", async () => {
    const { engine, store, api } = await setup();
    api
      .mockResolvedValueOnce(page([event("m100", 100), event("m99", 99)], true))
      .mockResolvedValueOnce(page([event("m11", 11), event("m10", 10)], true))
      .mockResolvedValueOnce(page([event("m9", 9)]))
      .mockResolvedValueOnce(page([event("m101", 101), event("m100", 100)], true));
    await engine.openConversation(CONV);
    await engine.loadAround(CONV, "m10");
    expect(ids(engine)).toEqual(["m10", "m11"]);
    expect(engine.state.get().messages[CONV]?.detached).toBe(true);
    const live = message("m101", 101);
    await store.putMessage(live);
    engine.show(live);
    expect(ids(engine)).toEqual(["m10", "m11"]);
    engine.show({ ...message("m10", 10), text: "edited" });
    expect(engine.state.get().messages[CONV]?.items[0]?.text).toBe("edited");
    await engine.loadOlder(CONV);
    expect(ids(engine)).toEqual(["m9", "m10", "m11"]);
    await engine.loadLatest(CONV);
    expect(ids(engine)).toEqual(["m100", "m101"]);
    expect(engine.state.get().messages[CONV]?.detached).toBe(false);
  });

  it("discards an older-page completion after a newer search window takes ownership", async () => {
    const { engine, api } = await setup();
    const older = deferred<ServerHistoryPage>();
    api
      .mockResolvedValueOnce(page([event("m100", 100)], true))
      .mockImplementationOnce(() => older.promise)
      .mockResolvedValueOnce(page([event("m10", 10)], true));
    await engine.openConversation(CONV);
    const pending = engine.loadOlder(CONV);
    await engine.loadAround(CONV, "m10");
    older.resolve(page([event("m90", 90)]));
    await pending;
    expect(ids(engine)).toEqual(["m10"]);
    expect(engine.state.get().messages[CONV]?.hasMore).toBe(true);
  });

  it("publishes the opening unread boundary with the first visible history window", async () => {
    const { engine, api } = await setup();
    engine.state.update((s) => ({
      ...s,
      local: { [CONV]: { id: CONV, unread: 2, mentions: 0, lastMessageId: "m3", lastPreview: null, lastSenderName: null, lastActivityAt: 3, readUpTo: 1, draft: "" } },
    }));
    const boundaries: (number | null | undefined)[] = [];
    const unsubscribe = engine.state.subscribe(() => {
      const loaded = engine.state.get().messages[CONV];
      if (loaded?.items.length) boundaries.push(loaded.unreadAfter);
    });
    api.mockResolvedValueOnce(page([event("m3", 3), event("m2", 2), event("m1", 1)]));
    await engine.openConversation(CONV);
    unsubscribe();
    expect(boundaries.length).toBeGreaterThan(0);
    expect(boundaries.every((n) => n === 1)).toBe(true);
  });

  it("does not mark a slow opening read after the person navigates away", async () => {
    const { engine, api } = await setup();
    const slow = deferred<ServerHistoryPage>();
    const read = vi.spyOn(engine, "markRead").mockResolvedValue();
    api.mockImplementationOnce(() => slow.promise);
    const opening = engine.openConversation(CONV);
    await vi.waitFor(() => expect(api).toHaveBeenCalled());
    await engine.openConversation(null);
    slow.resolve(page([event("m1", 1)]));
    await opening;
    expect(read).not.toHaveBeenCalled();
    expect(engine.viewing()).toBeNull();
  });

  it("acknowledges only a focused latest view, cancelling a pending read on scroll or route change", async () => {
    const { engine, api } = await setup();
    api.mockResolvedValueOnce(page([event("m1", 1)]));
    await engine.openConversation(CONV);
    vi.useFakeTimers();
    const read = vi.spyOn(engine, "markRead").mockResolvedValue();
    engine.setReadingLatest(CONV, true);
    engine.setReadingLatest(CONV, false);
    await vi.advanceTimersByTimeAsync(450);
    expect(read).not.toHaveBeenCalled();
    engine.setReadingLatest(CONV, true);
    engine.setFocused(false);
    await vi.advanceTimersByTimeAsync(450);
    expect(read).not.toHaveBeenCalled();
    engine.setFocused(true);
    await vi.advanceTimersByTimeAsync(450);
    expect(read).toHaveBeenCalledTimes(1);
    engine.setReadingLatest(CONV, true);
    await engine.openConversation(null);
    await vi.advanceTimersByTimeAsync(450);
    expect(read).toHaveBeenCalledTimes(1);
  });
});

describe("canonical message windows", () => {
  it("deduplicates replacements and uses the same tie order locally and on screen", async () => {
    const { store } = await setup();
    const messages = [message("m_c", 1000), message("m_a", 1000), message("m_b", 1000), message("m_older", 999)];
    await store.putMessages(messages);
    const newest = await store.latestMessages(CONV, 2);
    expect(newest.map((m) => m.id)).toEqual(["m_b", "m_c"]);
    expect((await store.latestMessages(CONV, 2, newest[0]!)).map((m) => m.id)).toEqual(["m_older", "m_a"]);
    const state = withMessages(initialState, CONV, [...messages, { ...messages[0]!, text: "updated" }]);
    expect(state.messages[CONV]?.items).toHaveLength(4);
    expect(state.messages[CONV]?.items.at(-1)?.text).toBe("updated");
    const detached = { ...state, messages: { [CONV]: { ...state.messages[CONV]!, detached: true } } };
    expect(upsertLoaded(detached, message("m_new", 2000))).toBe(detached);
  });
});
