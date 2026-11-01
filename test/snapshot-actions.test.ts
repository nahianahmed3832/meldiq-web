import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Conversation, ServerHistoryPage, StoredEvent } from "../src/api/schemas";
import type { DeviceRecord, StoredMessage } from "../src/model/types";
import { initialState } from "../src/state/store";
import { LocalStore } from "../src/store/db";
import { Engine, MESSAGE_CHANGED, UNREACHABLE } from "../src/sync/engine";
import { snapshotOf, SnapshotVault } from "../src/sync/snapshot";

/**
 * The owner (2026-10-30): actions on messages drawn from the snapshot never fail without a word. Until the conversation's
 * first server page replaces them they wait (at most a few seconds), then run against the server's copy of the message,
 * or say why they can't.
 */
const ME = "u_alice";
const CONV = "c_general";

const device = {
  userId: ME,
  deviceId: "d_1",
  username: "alice",
  identityKey: "aWRlbnRpdHk=",
  keys: { signingPublic: "c2lnbmluZw==" },
  history: null,
  linkedAt: 0,
  deviceName: "Test",
} as unknown as DeviceRecord;

const msg = (id: string, text: string, extra: Partial<StoredMessage> = {}): StoredMessage =>
  ({ id, conversationId: CONV, sortTs: 1, serverTs: 1, text, attachments: [], reactions: {}, outgoing: false, kind: "text", senderUserId: "u_bob", ...extra }) as unknown as StoredMessage;

interface Page {
  resolve(): void;
  fail(): void;
}

/** An engine opened on a snapshot that shows [shown] in #general, its first server page held until the test lets it in. */
async function openOnSnapshot(shown: StoredMessage[], server: StoredMessage[], opts: { liveWaitMs?: number } = {}) {
  const store = await LocalStore.open(`snapshot-actions-${Math.random()}`);
  const conv = { id: CONV, type: "CHANNEL", orgId: null, name: "general", canPost: true } as unknown as Conversation;
  const before = { ...initialState, phase: "ready" as const, synced: true, conversations: { [CONV]: conv }, messages: { [CONV]: { items: shown, hasMore: false } } };
  await new SnapshotVault(store, ME).save(snapshotOf(before, [CONV]));

  const engine = new Engine(device, store, { base: "http://meldiq.test", wsUrl: "ws://meldiq.test/v1/ws", liveWaitMs: opts.liveWaitMs });
  vi.spyOn(engine, "syncSummaries").mockResolvedValue();
  vi.spyOn(engine, "syncCalls").mockResolvedValue();
  let page: Page = { resolve: () => undefined, fail: () => undefined };
  const fetches = vi.spyOn(engine as unknown as { fetchHistory(id: string): Promise<ServerHistoryPage> }, "fetchHistory").mockImplementation(
    () =>
      new Promise<ServerHistoryPage>((resolve, reject) => {
        page = {
          resolve: () =>
            void store
              .putMessages(server)
              .then(() => resolve({ messages: [...server].reverse().map((m) => ({ id: m.id, serverTs: m.serverTs ?? m.sortTs }) as StoredEvent), changes: [], more: false })),
          fail: () => reject(new Error("offline")),
        };
      }),
  );
  await engine.open();
  const opening = engine.openConversation(CONV); // as Shell does: its first page is now on its way
  await vi.waitFor(() => expect(fetches).toHaveBeenCalled());
  return { engine, store, page: () => page, fetches, opening };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("actions on messages drawn from the snapshot", () => {
  it("keeps the saved window visible and guarded when the fresh page fails", async () => {
    const { engine, store, page, opening } = await openOnSnapshot([msg("m1", "saved while online")], []);
    const read = vi.spyOn(engine, "markRead").mockResolvedValue();
    expect(engine.state.get().messages[CONV]).toMatchObject({ preview: true, historyReady: false });
    engine.setReadingLatest(CONV, true);
    page().fail();
    await opening;
    expect(engine.state.get().messages[CONV]?.items.map((m) => m.text)).toEqual(["saved while online"]);
    expect(engine.waitsForServer({ conversationId: CONV })).toBe(true);
    expect(read).not.toHaveBeenCalled();
    engine.stop();
    await LocalStore.erase(store);
  });
  it("persists drafts through the existing encrypted snapshot before the save resolves", async () => {
    const { engine, store } = await openOnSnapshot([msg("m1", "shown")], [msg("m1", "server")]);
    engine.state.update((s) => ({ ...s, synced: true }));
    engine.snapshots.start();
    await engine.saveDraft(CONV, "Draft before navigation");
    expect((await new SnapshotVault(store, ME).load())?.local.find((local) => local.id === CONV)?.draft).toBe("Draft before navigation");
    await engine.saveDraft(CONV, "");
    expect((await new SnapshotVault(store, ME).load())?.local.find((local) => local.id === CONV)?.draft).toBe("");
    engine.snapshots.stop();
    await LocalStore.erase(store);
  });

  it("shows the snapshot's messages before the server answers", async () => {
    const { engine, store } = await openOnSnapshot([msg("m1", "from last time")], [msg("m1", "from the server")]);
    expect(engine.state.get().messages[CONV]?.items.map((m) => m.text)).toEqual(["from last time"]);
    expect(engine.waitsForServer({ conversationId: CONV })).toBe(true);
    await LocalStore.erase(store);
  });

  it("a reaction made in the gap waits, then is applied to the server's copy once its page arrives", async () => {
    const { engine, store, page } = await openOnSnapshot([msg("m1", "old")], [msg("m1", "edited on the phone")]);
    const reacted = vi.spyOn((engine as unknown as { compose: { react(m: StoredMessage, e: string): Promise<void> } }).compose, "react").mockResolvedValue();
    const shown = engine.state.get().messages[CONV]!.items[0]!;

    const done = engine.react(shown, "👍");
    await new Promise((r) => setTimeout(r, 350));
    expect(reacted).not.toHaveBeenCalled(); // still waiting
    expect(engine.state.get().waiting.m1).toBe(true); // past 300 ms: the message shows as waiting

    page().resolve();
    await done;
    expect(reacted).toHaveBeenCalledTimes(1);
    expect(reacted.mock.calls[0]![0].text).toBe("edited on the phone"); // the server's copy, matched by id
    expect(engine.state.get().waiting.m1).toBeUndefined();
    expect(engine.state.get().messages[CONV]?.items.map((m) => m.text)).toEqual(["edited on the phone"]);
    expect(engine.waitsForServer({ conversationId: CONV })).toBe(false);
    expect(engine.state.get().notices).toEqual([]);
    await LocalStore.erase(store);
  });

  it("a quick page shows nothing waiting", async () => {
    const { engine, store, page } = await openOnSnapshot([msg("m1", "old")], [msg("m1", "new")]);
    vi.spyOn((engine as unknown as { compose: { setPinned(m: StoredMessage, p: boolean): Promise<void> } }).compose, "setPinned").mockResolvedValue();
    const seen: boolean[] = [];
    const off = engine.state.subscribe(() => seen.push(!!engine.state.get().waiting.m1));
    const done = engine.setPinned(engine.state.get().messages[CONV]!.items[0]!, true);
    page().resolve();
    await done;
    off();
    expect(seen.some(Boolean)).toBe(false);
    await LocalStore.erase(store);
  });

  it("says the message changed when the server's page no longer has it, and doesn't act", async () => {
    const { engine, store, page } = await openOnSnapshot([msg("m1", "deleted since")], [msg("m2", "something else")]);
    const deleted = vi.spyOn((engine as unknown as { compose: { deleteForEveryone(m: StoredMessage): Promise<void> } }).compose, "deleteForEveryone").mockResolvedValue();
    const done = engine.deleteForEveryone(engine.state.get().messages[CONV]!.items[0]!);
    page().resolve();
    await done;
    expect(deleted).not.toHaveBeenCalled();
    expect(engine.state.get().notices.map((n) => n.text)).toEqual([MESSAGE_CHANGED]);
    await LocalStore.erase(store);
  });

  it("says it couldn't reach Meldiq when the page fails, or doesn't come in time", async () => {
    const failing = await openOnSnapshot([msg("m1", "old")], []);
    const done = failing.engine.vote(failing.engine.state.get().messages[CONV]!.items[0]!, ["a"]);
    failing.page().fail();
    await done;
    expect(failing.engine.state.get().notices.map((n) => n.text)).toEqual([UNREACHABLE]);
    await LocalStore.erase(failing.store);

    const slow = await openOnSnapshot([msg("m1", "old")], [msg("m1", "new")], { liveWaitMs: 200 });
    const edited = vi.spyOn((slow.engine as unknown as { compose: { edit(m: StoredMessage, t: string): Promise<void> } }).compose, "edit").mockResolvedValue();
    await slow.engine.edit(slow.engine.state.get().messages[CONV]!.items[0]!, "changed"); // the page never comes
    expect(edited).not.toHaveBeenCalled();
    expect(slow.engine.state.get().notices.map((n) => n.text)).toEqual([UNREACHABLE]);
    expect(slow.engine.state.get().waiting.m1).toBeUndefined();
    // The messages drawn from the snapshot stay on screen rather than emptying.
    expect(slow.engine.state.get().messages[CONV]?.items.map((m) => m.text)).toEqual(["old"]);
    await LocalStore.erase(slow.store);
  });

  it("a reply to a snapshot message waits for it; a new message doesn't wait at all", async () => {
    const { engine, store, page } = await openOnSnapshot([msg("m1", "old")], [msg("m1", "new")]);
    const sent = vi.spyOn((engine as unknown as { compose: { sendText(c: string, t: string, o: object): Promise<string> } }).compose, "sendText").mockResolvedValue("x");
    await engine.sendText(CONV, "hello"); // no reply: straight away, the page still out
    expect(sent).toHaveBeenCalledTimes(1);
    const reply = engine.sendText(CONV, "re", { replyTo: "m1" });
    await new Promise((r) => setTimeout(r, 20));
    expect(sent).toHaveBeenCalledTimes(1);
    page().resolve();
    await reply;
    expect(sent).toHaveBeenCalledTimes(2);
    await LocalStore.erase(store);
  });

  it("a reply to a message that's gone is refused with the reason, so the composer keeps the text", async () => {
    const { engine, store, page } = await openOnSnapshot([msg("m1", "old")], [msg("m2", "other")]);
    vi.spyOn((engine as unknown as { compose: { sendText(c: string, t: string, o: object): Promise<string> } }).compose, "sendText").mockResolvedValue("x");
    const reply = engine.sendText(CONV, "re", { replyTo: "m1" });
    page().resolve();
    await expect(reply).rejects.toThrow(MESSAGE_CHANGED);
    await LocalStore.erase(store);
  });
});
