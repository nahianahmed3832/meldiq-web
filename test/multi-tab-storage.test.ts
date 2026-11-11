import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { LocalStore } from "../src/store/db";
import { TabDrafts } from "../src/store/tabDrafts";
import { TokenVault } from "../src/auth/tokenVault";
import { AccountSession } from "../src/auth/accountSession";
import { AccountApi } from "../src/auth/accountApi";
import type { AccountSessionGrant } from "../src/api/accountSchemas";
import { accountStoreForBoot, rememberAccount, selectAccount } from "../src/auth/savedAccounts";
import type { DeviceRecord } from "../src/model/types";

function storage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
}
const stores: LocalStore[] = [];
async function open(name = `tabs-${crypto.randomUUID()}`) {
  const store = await LocalStore.open(name);
  stores.push(store);
  return store;
}
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const store of stores.splice(0)) store.close();
  for (const db of await indexedDB.databases()) if (db.name) await LocalStore.erase(null, db.name);
});

it("concurrent tabs commit one usable non-exportable encryption key", async () => {
  const first = await open();
  const second = await open(first.name);
  for (const name of ["snapshotKey", "accountTokenKey"] as const) {
    const [a, b] = await Promise.all([first.localEncryptionKey(name), second.localEncryptionKey(name)]);
    expect(a.extractable).toBe(false);
    expect(b.extractable).toBe(false);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, a, new TextEncoder().encode("shared key"));
    expect(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, b, sealed))).toBe("shared key");
  }
});

it("keeps each tab's drafts encrypted, independent on reload, and bound to the account/device", async () => {
  const first = await open();
  const second = await open(first.name);
  const a = storage(),
    b = storage();
  await Promise.all([
    new TabDrafts(first, "alice", "device-a", a).save("conversation", "first private draft"),
    new TabDrafts(second, "alice", "device-a", b).save("conversation", "second private draft"),
  ]);
  expect(a.getItem(a.key(0)!)).not.toContain("first private draft");
  expect(await new TabDrafts(first, "alice", "device-a", a).load()).toEqual({ conversation: "first private draft" });
  expect(await new TabDrafts(second, "alice", "device-a", b).load()).toEqual({ conversation: "second private draft" });
  expect(await new TabDrafts(second, "bob", "device-b", b).load()).toEqual({});
  expect(b.length).toBe(0);
});

it("does not recreate a draft after sign-out while its save is queued", async () => {
  const store = await open();
  const session = storage();
  const drafts = new TabDrafts(store, "alice", "device-a", session);
  const pending = drafts.save("conversation", "must be cleared");
  drafts.clear();
  await pending;
  expect(session.length).toBe(0);
});

it("reports draft storage failure, permits retry and replaces corrupt stored drafts", async () => {
  const store = await open();
  const session = storage();
  session.setItem(`meldiq.tab-drafts:${store.name}`, "corrupt");
  const drafts = new TabDrafts(store, "alice", "device-a", session);
  const write = vi.spyOn(session, "setItem").mockImplementationOnce(() => {
    throw new DOMException("full", "QuotaExceededError");
  });
  await expect(drafts.save("conversation", "still here")).rejects.toThrow("full");
  await drafts.save("conversation", "retry saved");
  expect(write).toHaveBeenCalledTimes(2);
  expect(await new TabDrafts(store, "alice", "device-a", session).load()).toEqual({ conversation: "retry saved" });
});

it("invalidates every open store when one tab erases this account", async () => {
  const first = await open();
  const second = await open(first.name);
  const invalidated = vi.fn();
  second.onInvalidated(invalidated);
  await LocalStore.erase(first);
  await vi.waitFor(() => expect(invalidated).toHaveBeenCalledOnce());
  await expect(second.getValue("device")).rejects.toThrow();
});

it("reports unavailable browser storage instead of promising to preserve a draft", async () => {
  const store = await open();
  vi.stubGlobal("window", {});
  const drafts = new TabDrafts(store, "alice", "device-a", null);
  await expect(drafts.save("conversation", "keep this tab open")).rejects.toMatchObject({ name: "SecurityError" });
});

it("keeps a tab on its selected account when another tab switches accounts", async () => {
  const alice = await open(),
    bob = await open();
  const device = (id: string) => ({ userId: id, deviceId: `device-${id}`, username: id, keys: {} }) as DeviceRecord;
  await alice.saveDevice(device("alice"));
  await bob.saveDevice(device("bob"));
  await rememberAccount(alice.name, device("alice"));
  await rememberAccount(bob.name, device("bob"));
  const tabA = storage(),
    tabB = storage();
  vi.stubGlobal("sessionStorage", tabA);
  await selectAccount(alice.name);
  vi.stubGlobal("sessionStorage", tabB);
  await selectAccount(bob.name);
  vi.stubGlobal("sessionStorage", tabA);
  const reopenedA = await accountStoreForBoot();
  stores.push(reopenedA.store);
  expect((await reopenedA.store.device())?.userId).toBe("alice");
  vi.stubGlobal("sessionStorage", tabB);
  const reopenedB = await accountStoreForBoot();
  stores.push(reopenedB.store);
  expect((await reopenedB.store.device())?.userId).toBe("bob");
});

it("rotates one refresh token once when two tabs renew together", async () => {
  const first = await open(),
    second = await open(first.name);
  await new TokenVault(first).save({ accessToken: "expired", refreshToken: "old", accessTokenExpiresAt: 0, refreshTokenExpiresAt: Date.now() + 86400000, sessionId: "same-session" });
  let queue: Promise<unknown> = Promise.resolve();
  vi.stubGlobal("navigator", {
    locks: {
      request: (_name: string, run: () => Promise<unknown>) => {
        const next = queue.then(run);
        queue = next.catch(() => undefined);
        return next;
      },
    },
  });
  const refresh = vi.spyOn(AccountApi.prototype, "refresh").mockResolvedValue({
    accessToken: "new-access",
    refreshToken: "new-refresh",
    accessTokenExpiresAt: Date.now() + 900000,
    refreshTokenExpiresAt: Date.now() + 86400000,
    session: { id: "same-session" },
  } as AccountSessionGrant);
  const ended = vi.fn();
  const a = new AccountSession("", new TokenVault(first), ended),
    b = new AccountSession("", new TokenVault(second), ended);
  expect(await Promise.all([a.reauthenticate(), b.reauthenticate()])).toEqual([true, true]);
  expect(refresh).toHaveBeenCalledOnce();
  expect(refresh).toHaveBeenCalledWith("old");
  expect(a.token()).toBe("new-access");
  expect(b.token()).toBe("new-access");
  expect(ended).not.toHaveBeenCalled();
});
