import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
import type { Conversation } from "../src/api/schemas";
import type { DeviceRecord, StoredMessage } from "../src/model/types";
import { initialState, Store } from "../src/state/store";
import { LocalStore } from "../src/store/db";
import { Engine } from "../src/sync/engine";

it("marks the click's boundary and keeps a message arriving during the local read unread", async () => {
  const store = await LocalStore.open(`mark-read-boundary-${Math.random()}`);
  const id = "c_boundary";
  const conversation = { id, type: "DM", memberCount: 2, canPost: true } as Conversation;
  const engine = new Engine(
    { userId: "u_me", deviceId: "d_web" } as DeviceRecord,
    store,
    { base: "http://meldiq.test", wsUrl: "ws://meldiq.test/v1/ws" },
    new Store({ ...initialState, conversations: { [id]: conversation } }),
  );
  const message = (ts: number) =>
    ({ id: `m${ts}`, conversationId: id, sortTs: ts, serverTs: ts, outgoing: false, kind: "text", threadRootId: null, text: "hello", attachments: [] }) as unknown as StoredMessage;
  // Exercise the real queue and local store; hold its first read to force an arrival between click and commit.
  const first = message(100);
  await store.putMessage(first);
  await engine.bump(first, { unread: true, mention: true });
  const before = await store.conversation(id);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const read = vi.spyOn(store, "conversation").mockImplementationOnce(async () => {
    await held;
    return before;
  });
  // Receipts use the existing sealed-control path. Inspect the payload without sending to any service.
  const compose = (engine as unknown as { compose: { enqueueControl: (id: string, payload: unknown) => Promise<void> } }).compose;
  const receipt = vi.spyOn(compose, "enqueueControl").mockResolvedValue();
  try {
    const marking = engine.markRead(id);
    await vi.waitFor(() => expect(read).toHaveBeenCalled());
    const incoming = message(200);
    await store.putMessage(incoming);
    const bump = engine.bump(incoming, { unread: true, mention: true });
    release();
    await Promise.all([marking, bump]);
    expect(await store.conversation(id)).toMatchObject({ unread: 1, mentions: 1, readUpTo: 100, lastMessageId: "m200" });
    expect(receipt).toHaveBeenCalledExactlyOnceWith(id, { type: "read", upTo: 100 });
    // Retrying while nothing else arrives neither regresses the marker nor repeats the same receipt.
    await engine.markRead(id);
    await engine.markRead(id);
    expect(await store.conversation(id)).toMatchObject({ unread: 0, mentions: 0, readUpTo: 200 });
    expect(receipt).toHaveBeenCalledTimes(2);
  } finally {
    release();
    engine.stop();
    vi.restoreAllMocks();
    await LocalStore.erase(store);
  }
});
