import { AccountApi } from "../src/auth/accountApi";
import type { AccountSessionGrant } from "../src/api/accountSchemas";
import { AccountSession } from "../src/auth/accountSession";
import { blocksAccountSwitch, switchSavedAccount } from "../src/application/accountSwitch";
import type { Engine } from "../src/sync/engine";
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accountDirectory, accountStoreForBoot, cancelAddingAccount, forgetAccount, rememberAccount, selectAccount, startAddingAccount } from "../src/auth/savedAccounts";
import { TokenVault } from "../src/auth/tokenVault";
import type { DeviceRecord } from "../src/model/types";
import { DB_NAME, LocalStore } from "../src/store/db";

const device = (id: string): DeviceRecord => ({ userId: id, deviceId: `device-${id}`, username: id, keys: {}, account: { id: `account-${id}`, email: `${id}@example.test` } }) as DeviceRecord;
const tokens = (id: string) => ({
  accessToken: `access-${id}`,
  refreshToken: `refresh-${id}`,
  accessTokenExpiresAt: Date.now() + 60000,
  refreshTokenExpiresAt: Date.now() + 86400000,
  sessionId: `session-${id}`,
});
async function add(database: string, id: string) {
  const store = await LocalStore.open(database);
  await store.saveDevice(device(id));
  await new TokenVault(store).save(tokens(id));
  await rememberAccount(database, device(id), id);
  return store;
}
beforeEach(async () => {
  for (const name of (await indexedDB.databases()).flatMap((d) => (d.name ? [d.name] : []))) await LocalStore.erase(null, name);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("saved accounts", () => {
  it("adopts the existing account without moving its database, keys or sealed tokens", async () => {
    const original = await LocalStore.open();
    await original.saveDevice(device("alice"));
    await new TokenVault(original).save(tokens("alice"));
    original.close();
    const { directory, store } = await accountStoreForBoot();
    expect(directory.active).toBe(DB_NAME);
    expect(directory.accounts.map((a) => a.userId)).toEqual(["alice"]);
    expect((await new TokenVault(store).load())?.refreshToken).toBe("refresh-alice");
    store.close();
  });
  it("keeps sessions isolated across add, switch and reopen; removing one leaves the other usable", async () => {
    const a = await add(DB_NAME, "alice");
    await startAddingAccount();
    const pending = (await accountDirectory()).pending!;
    expect((await accountDirectory()).active).toBe(DB_NAME);
    const b = await add(pending.database, "bob");
    expect((await accountDirectory()).active).toBe(b.name);
    const keyA = await a.getValue<CryptoKey>("accountTokenKey");
    const keyB = await b.getValue<CryptoKey>("accountTokenKey");
    expect(keyA?.extractable).toBe(false);
    expect(keyB?.extractable).toBe(false);
    const sealedA = await a.getValue<{ data: Uint8Array }>("accountTokens");
    expect(new TextDecoder().decode(sealedA!.data)).not.toContain("refresh-alice");
    await selectAccount(a.name);
    expect((await new TokenVault(b).load())?.refreshToken).toBe("refresh-bob");
    const { store } = await accountStoreForBoot();
    expect((await store.device())?.userId).toBe("alice");
    store.close();
    await LocalStore.erase(a);
    await forgetAccount(a.name);
    expect((await accountDirectory()).active).toBe(b.name);
    expect((await new TokenVault(b).load())?.refreshToken).toBe("refresh-bob");
    b.close();
  });
  it("canceling add discards only the unfinished account and returns to the original session", async () => {
    const a = await add(DB_NAME, "alice");
    await startAddingAccount();
    const pending = (await accountDirectory()).pending!;
    const { store } = await accountStoreForBoot();
    expect(store.name).toBe(pending.database);
    store.close();
    await cancelAddingAccount();
    expect((await accountDirectory()).pending).toBeNull();
    expect((await accountDirectory()).active).toBe(a.name);
    expect((await new TokenVault(a).load())?.refreshToken).toBe("refresh-alice");
    a.close();
  });
  it("does not replace a saved account with a duplicate identity or a missing device", async () => {
    const a = await add(DB_NAME, "alice");
    await expect(rememberAccount("duplicate", device("alice"))).rejects.toThrow("already added");
    expect((await accountDirectory()).accounts).toHaveLength(1);
    await LocalStore.erase(a);
    await expect(selectAccount(DB_NAME)).rejects.toThrow("removed");
    expect((await accountDirectory()).accounts).toHaveLength(0);
  });
  it("an expired session clears only that account's vault", async () => {
    const a = await add(DB_NAME, "alice");
    await startAddingAccount();
    const b = await add((await accountDirectory()).pending!.database, "bob");
    await new TokenVault(a).save({ ...tokens("alice"), accessTokenExpiresAt: 0 });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "session_ended", message: "Session ended" }), { status: 401, headers: { "content-type": "application/json" } })),
    );
    const ended = vi.fn();
    expect(await new AccountSession("https://example.test", new TokenVault(a), ended).reauthenticate()).toBe(false);
    expect(ended).toHaveBeenCalledWith("session_ended");
    expect(await new TokenVault(a).load()).toBeNull();
    expect((await new TokenVault(b).load())?.refreshToken).toBe("refresh-bob");
    expect((await accountDirectory()).accounts).toHaveLength(2);
    a.close();
    b.close();
  });
  it("a pending send prevents a switch before the active account changes", async () => {
    const a = await add(DB_NAME, "alice");
    const flush = vi.fn();
    const engine = { store: { name: a.name, outbox: async () => [{ cls: "message" }] }, state: { get: () => ({ call: { phase: "idle" } }) }, snapshots: { flush } } as unknown as Engine;
    await expect(switchSavedAccount(engine, "another-account")).rejects.toThrow("pending messages");
    expect((await accountDirectory()).active).toBe(a.name);
    expect(flush).not.toHaveBeenCalled();
    a.close();
  });
  it("finishes a rotating token refresh before a switch can unload the page", async () => {
    const a = await add(DB_NAME, "alice");
    await new TokenVault(a).save({ ...tokens("alice"), accessTokenExpiresAt: 0 });
    let complete!: (grant: AccountSessionGrant) => void;
    const refresh = vi.spyOn(AccountApi.prototype, "refresh").mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const session = new AccountSession("https://example.test", new TokenVault(a), vi.fn());
    const renewing = session.reauthenticate();
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    let finished = false;
    const leaving = session.suspend().then(() => {
      finished = true;
    });
    expect(await session.reauthenticate()).toBe(false);
    expect(finished).toBe(false);
    complete({
      ...tokens("rotated"),
      session: { id: "rotated-session", deviceId: "device-alice", createdAt: Date.now() },
      account: { id: "account-alice", email: "alice@example.test", name: "Alice", createdAt: 1, legacyLinkedAt: null, selectedWorkspaceId: null, identity: null },
    });
    await Promise.all([renewing, leaving]);
    expect(finished).toBe(true);
    expect(refresh).toHaveBeenCalledOnce();
    expect((await new TokenVault(a).load())?.refreshToken).toBe("refresh-rotated");
    session.resume();
    a.close();
  });
  it("read receipts do not block switching; pending messages and user changes still do", () => {
    const item = (type: string, cls: "message" | "control" = "control") => ({ cls, payloadJson: JSON.stringify({ type }) }) as import("../src/model/types").OutboxItem;
    expect(blocksAccountSwitch(item("read"))).toBe(false);
    for (const type of ["reaction", "edit", "delete", "vote", "pin"]) expect(blocksAccountSwitch(item(type))).toBe(true);
    expect(blocksAccountSwitch(item("text", "message"))).toBe(true);
    expect(blocksAccountSwitch({ cls: "control", payloadJson: "broken" } as import("../src/model/types").OutboxItem)).toBe(true);
  });
});
