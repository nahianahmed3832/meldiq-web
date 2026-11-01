import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Conversation } from "../src/api/schemas";
import { AccountSession } from "../src/auth/accountSession";
import { TokenVault } from "../src/auth/tokenVault";
import type { StoredMessage } from "../src/model/types";
import { type AppState, initialState } from "../src/state/store";
import { LocalStore } from "../src/store/db";
import { fitSnapshot, SNAPSHOT_CONVERSATIONS, SNAPSHOT_CRYPTO_KEY, SNAPSHOT_KEY, SNAPSHOT_MESSAGES, SnapshotKeeper, snapshotOf, SnapshotVault, withSnapshot } from "../src/sync/snapshot";

/**
 * The owner (2026-10-30): "Yes, keep snapshot". A reload draws the last view from a sealed snapshot on this computer
 * before the server answers; it's this account's only, erased with the sign-in, and dropped quietly when it can't be read.
 */
const ME = "u_alice";
const open = () => LocalStore.open(`snapshot-${Math.random()}`);

const conv = (id: string): Conversation => ({ id, type: "CHANNEL", orgId: "o_1", name: id }) as unknown as Conversation;
const msg = (conversationId: string, i: number, text = `message ${i}`): StoredMessage =>
  ({ id: `${conversationId}-m${i}`, conversationId, sortTs: i, serverTs: i, text, attachments: [], outgoing: false, kind: "text" }) as unknown as StoredMessage;

/** A signed-in state with [n] conversations, each with [per] messages loaded. */
function stateWith(n: number, per = 3, extra: Partial<AppState> = {}): AppState {
  const ids = Array.from({ length: n }, (_, i) => `c_${i}`);
  return {
    ...initialState,
    phase: "ready",
    synced: true,
    me: { userId: ME, deviceId: "d_1", username: "alice", displayName: "Alice", identityKey: "k", avatarColor: 3, statusText: null, deviceFingerprint: "f", deviceName: "Chrome" },
    orgs: [{ id: "o_1", name: "Bot test" }] as AppState["orgs"],
    conversations: Object.fromEntries(ids.map((id) => [id, conv(id)])),
    users: { u_bob: { id: "u_bob", username: "bob", displayName: "Bob", avatarColor: 1, statusText: null, online: null, photoRev: 4 } },
    local: Object.fromEntries(ids.map((id) => [id, { id, unread: 2, mentions: 1 } as unknown as AppState["local"][string]])),
    messages: Object.fromEntries(ids.map((id) => [id, { items: Array.from({ length: per }, (_, i) => msg(id, i)), hasMore: false }])),
    ...extra,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the snapshot on this computer", () => {
  it("excludes distant search windows so a return never presents them as the latest messages", () => {
    const s = stateWith(2);
    s.messages.c_0 = { ...s.messages.c_0!, detached: true };
    const saved = snapshotOf(s, ["c_0", "c_1"]);
    expect(saved.recent).toEqual(["c_1"]);
    expect(saved.messages.c_0).toBeUndefined();
  });
  it("is kept sealed and comes back as it was, the newest messages of the conversations opened last", async () => {
    const store = await open();
    const vault = new SnapshotVault(store, ME);
    const s = stateWith(3, 80);
    await vault.save(snapshotOf(s, ["c_2", "c_0"]));

    // On disk it's ciphertext: no conversation name or message text in it.
    const sealed = await store.getValue<{ data: Uint8Array }>(SNAPSHOT_KEY);
    expect(new TextDecoder().decode(sealed!.data)).not.toContain("message 1");
    expect(await store.getValue(SNAPSHOT_CRYPTO_KEY)).toBeInstanceOf(CryptoKey);
    expect((await store.getValue<CryptoKey>(SNAPSHOT_CRYPTO_KEY))!.extractable).toBe(false);

    const back = await new SnapshotVault(store, ME).load();
    expect(back!.recent).toEqual(["c_2", "c_0"]);
    expect(Object.keys(back!.messages)).toEqual(["c_2", "c_0"]);
    expect(back!.messages.c_2).toHaveLength(SNAPSHOT_MESSAGES);
    expect(back!.messages.c_2.at(-1)!.id).toBe("c_2-m79"); // the newest
    expect(back!.conversations.map((c) => c.id).sort()).toEqual(["c_0", "c_1", "c_2"]);
    expect(back!.users[0]).toMatchObject({ displayName: "Bob", photoRev: 4 });
    expect(back!.local.find((l) => l.id === "c_1")).toMatchObject({ unread: 2, mentions: 1 });
    await LocalStore.erase(store);
  });

  it("draws before the server answers, and never over what the server already sent", () => {
    const kept = snapshotOf(stateWith(2), ["c_0"]);
    const drawn = withSnapshot(initialState, kept);
    expect(Object.keys(drawn.conversations)).toEqual(["c_0", "c_1"]);
    expect(drawn.messages.c_0!.items).toHaveLength(3);
    expect(drawn.messages.c_0!.hasMore).toBe(true);
    expect(drawn.me?.displayName).toBe("Alice");

    const fresh = { ...initialState, conversations: { c_9: conv("c_9") }, messages: { c_0: { items: [msg("c_0", 9, "fresh")], hasMore: false } } };
    const merged = withSnapshot(fresh, kept);
    expect(Object.keys(merged.conversations)).toEqual(["c_9"]);
    expect(merged.messages.c_0!.items.map((m) => m.id)).toEqual(["c_0-m9"]);
  });

  it("keeps at most the 12 conversations opened last", () => {
    const s = stateWith(20);
    const d = snapshotOf(
      s,
      Array.from({ length: 20 }, (_, i) => `c_${i}`),
    );
    expect(d.recent).toHaveLength(SNAPSHOT_CONVERSATIONS);
    expect(Object.keys(d.messages)).toHaveLength(SNAPSHOT_CONVERSATIONS);
  });

  it("goes with everything else when this browser signs out, is removed, or the account is deleted", async () => {
    const store = await open();
    await new SnapshotVault(store, ME).save(snapshotOf(stateWith(1), ["c_0"]));
    await LocalStore.erase(store); // signOut, deleteAccount and a revoked device all end here
    const again = await LocalStore.open(store.name);
    expect(await again.getValue(SNAPSHOT_KEY)).toBeUndefined();
    expect(await again.getValue(SNAPSHOT_CRYPTO_KEY)).toBeUndefined();
    expect(await new SnapshotVault(again, ME).load()).toBeNull();
    await LocalStore.erase(again);
  });

  it("never opens another account's snapshot, and erases it", async () => {
    const store = await open();
    await new SnapshotVault(store, ME).save(snapshotOf(stateWith(1), ["c_0"]));
    expect(await new SnapshotVault(store, "u_mallory").load()).toBeNull();
    expect(await store.getValue(SNAPSHOT_KEY)).toBeUndefined();
    await LocalStore.erase(store);
  });

  it("binds the account into the seal: relabelling one for another account doesn't open", async () => {
    const store = await open();
    await new SnapshotVault(store, ME).save(snapshotOf(stateWith(1), ["c_0"]));
    const sealed = await store.getValue<Record<string, unknown>>(SNAPSHOT_KEY);
    await store.setValue(SNAPSHOT_KEY, { ...sealed, userId: "u_bob" });
    expect(await new SnapshotVault(store, "u_bob").load()).toBeNull();
    expect(await store.getValue(SNAPSHOT_KEY)).toBeUndefined();
    await LocalStore.erase(store);
  });

  it("drops one of another version", async () => {
    const store = await open();
    await new SnapshotVault(store, ME).save(snapshotOf(stateWith(1), ["c_0"]));
    const sealed = await store.getValue<Record<string, unknown>>(SNAPSHOT_KEY);
    await store.setValue(SNAPSHOT_KEY, { ...sealed, v: 0 });
    expect(await new SnapshotVault(store, ME).load()).toBeNull();
    expect(await store.getValue(SNAPSHOT_KEY)).toBeUndefined();
    await LocalStore.erase(store);
  });

  it("drops one sealed with another key, or tampered with, without a fuss", async () => {
    const store = await open();
    const vault = new SnapshotVault(store, ME);
    await vault.save(snapshotOf(stateWith(1), ["c_0"]));
    await store.setValue(SNAPSHOT_CRYPTO_KEY, await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]));
    await expect(vault.load()).resolves.toBeNull();
    expect(await store.getValue(SNAPSHOT_KEY)).toBeUndefined();

    await vault.save(snapshotOf(stateWith(1), ["c_0"]));
    const sealed = await store.getValue<{ data: Uint8Array }>(SNAPSHOT_KEY);
    const data = new Uint8Array(sealed!.data);
    data[5] ^= 0xff;
    await store.setValue(SNAPSHOT_KEY, { ...sealed, data });
    await expect(vault.load()).resolves.toBeNull();
    expect(await store.getValue(SNAPSHOT_KEY)).toBeUndefined();

    await store.setValue(SNAPSHOT_KEY, "garbage");
    await expect(vault.load()).resolves.toBeNull();
    await LocalStore.erase(store);
  });

  it("stays within its size limit by dropping the oldest conversations' messages first", () => {
    const d = snapshotOf(stateWith(4, 50), ["c_0", "c_1", "c_2", "c_3"]);
    const whole = fitSnapshot(d)!.bytes.length;
    const fit = fitSnapshot(d, whole - 1000)!;
    expect(fit.data.recent).toEqual(["c_0", "c_1", "c_2"]);
    expect(fitSnapshot(d, 10)).toBeNull();
  });

  it("drops the oldest conversations when the browser's storage is full, instead of failing", async () => {
    const store = await open();
    const limit = 9000;
    const quota = Object.create(store) as LocalStore;
    quota.setValue = async (key: string, value: unknown) => {
      const size = (value as { data?: Uint8Array })?.data?.length ?? 0;
      if (key === SNAPSHOT_KEY && size > limit) throw new DOMException("full", "QuotaExceededError");
      return store.setValue(key, value);
    };
    const vault = new SnapshotVault(quota, ME);
    await vault.save(snapshotOf(stateWith(4, 20), ["c_0", "c_1", "c_2", "c_3"]));
    const back = await vault.load();
    expect(back).not.toBeNull();
    expect(back!.recent.length).toBeLessThan(4);
    expect(back!.recent[0]).toBe("c_0"); // the most recently opened stays
    await LocalStore.erase(store);
  });
});

describe("keeping it current", () => {
  it("serializes overlapping draft and background saves so the newest state wins", async () => {
    let state = stateWith(1, 3);
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const saved: string[] = [];
    const vault = {
      save: vi.fn(async (data: ReturnType<typeof snapshotOf>) => {
        saved.push(data.me!.displayName);
        if (saved.length === 1) await held;
      }),
    } as unknown as SnapshotVault;
    const keeper = new SnapshotKeeper(vault, { get: () => state, subscribe: () => () => undefined });
    keeper.start();
    const first = keeper.flush();
    await vi.waitFor(() => expect(vault.save).toHaveBeenCalledTimes(1));
    state = { ...state, me: { ...state.me!, displayName: "Newer state" } };
    const second = keeper.flush();
    expect(vault.save).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    expect(saved).toEqual(["Alice", "Newer state"]);
    keeper.stop();
  });

  it("writes once changes settle for about 4 s, only after the server answered, and not while signed out of the session", async () => {
    vi.useFakeTimers();
    let state = stateWith(1, 3, { synced: false });
    const listeners = new Set<() => void>();
    const host = { get: () => state, subscribe: (l: () => void) => (listeners.add(l), () => listeners.delete(l)) };
    const vault = { save: vi.fn(async () => undefined) } as unknown as SnapshotVault;
    const keeper = new SnapshotKeeper(vault, host, 4000);
    keeper.start();
    const change = (s: AppState) => {
      state = s;
      listeners.forEach((l) => l());
    };

    change({ ...state, orgs: [...state.orgs] });
    await vi.advanceTimersByTimeAsync(4000);
    expect(vault.save).not.toHaveBeenCalled(); // not synced yet: nothing worth keeping

    change({ ...state, synced: true });
    await vi.advanceTimersByTimeAsync(3000);
    change({ ...state, users: { ...state.users } });
    await vi.advanceTimersByTimeAsync(3000);
    expect(vault.save).toHaveBeenCalledTimes(1); // continuous updates must not postpone every snapshot
    await vi.advanceTimersByTimeAsync(1000);
    expect(vault.save).toHaveBeenCalledTimes(1);

    change({ ...state, phase: "reauth" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(vault.save).toHaveBeenCalledTimes(1); // the session asks for the password: nothing written

    keeper.stop();
    change({ ...state, phase: "ready", orgs: [] });
    await vi.advanceTimersByTimeAsync(5000);
    expect(vault.save).toHaveBeenCalledTimes(1);
  });
});

describe("a session that needs the person", () => {
  it("draws nothing kept until it's unlocked: no tokens, or a refresh token that ran out", async () => {
    const store = await open();
    const vault = new TokenVault(store);
    const session = () => new AccountSession("", vault, () => undefined);
    expect(await session().restorable()).toBe(false);
    const tokens = { accessToken: "a", accessTokenExpiresAt: Date.now() - 1, refreshToken: "r", refreshTokenExpiresAt: Date.now() - 1, sessionId: "s" };
    await vault.save(tokens);
    expect(await session().restorable()).toBe(false);
    await vault.save({ ...tokens, refreshTokenExpiresAt: Date.now() + 86_400_000 });
    expect(await session().restorable()).toBe(true);
    await LocalStore.erase(store);
  });
});
