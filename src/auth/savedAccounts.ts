import { openDB } from "idb";
import type { DeviceRecord } from "../model/types";
import { DB_NAME, LocalStore } from "../store/db";

/** Only account labels and database pointers live here; keys and tokens stay in each account's own database. */
export interface SavedAccount {
  database: string;
  userId: string;
  accountId: string | null;
  username: string;
  displayName: string;
  avatarColor: number;
}
export interface AccountDirectory {
  active: string | null;
  accounts: SavedAccount[];
  pending: { database: string; returnTo: string | null } | null;
}
const DIRECTORY_DB = "meldiq-accounts";
const EMPTY: AccountDirectory = { active: null, accounts: [], pending: null };
const open = () => openDB(DIRECTORY_DB, 1, { upgrade: (db) => db.createObjectStore("kv") });

export async function accountDirectory(): Promise<AccountDirectory> {
  const db = await open();
  try {
    return (await db.get("kv", "directory")) ?? { ...EMPTY };
  } finally {
    db.close();
  }
}

async function change(fn: (directory: AccountDirectory) => void): Promise<AccountDirectory> {
  const db = await open();
  try {
    const tx = db.transaction("kv", "readwrite");
    const directory: AccountDirectory = (await tx.store.get("directory")) ?? { ...EMPTY, accounts: [] };
    fn(directory);
    await tx.store.put(directory, "directory");
    await tx.done;
    return directory;
  } finally {
    db.close();
  }
}

/** Adopt the pre-multiple-account database in place; no credentials are copied or replaced. */
export async function accountStoreForBoot(): Promise<{ directory: AccountDirectory; store: LocalStore }> {
  const directory = await accountDirectory();
  const store = await LocalStore.open(directory.pending?.database ?? directory.active ?? DB_NAME);
  const device = await store.device();
  if (device && !directory.accounts.some((a) => a.database === store.name)) {
    return { directory: await rememberAccount(store.name, device), store };
  }
  return { directory, store };
}

export async function rememberAccount(database: string, device: DeviceRecord, displayName = device.username, avatarColor = 0): Promise<AccountDirectory> {
  return change((d) => {
    const duplicate = d.accounts.find((a) => a.userId === device.userId && a.database !== database);
    if (duplicate) throw new Error("This account is already added. Choose it from Switch account.");
    const account: SavedAccount = { database, userId: device.userId, accountId: device.account?.id ?? null, username: device.username, displayName, avatarColor };
    const index = d.accounts.findIndex((a) => a.database === database);
    if (index < 0) d.accounts.push(account);
    else d.accounts[index] = account;
    if (d.pending?.database === database || !d.active) {
      d.active = database;
      d.pending = null;
    }
  });
}

export async function selectAccount(database: string): Promise<void> {
  const before = await accountDirectory();
  if (!before.accounts.some((a) => a.database === database)) throw new Error("That account is no longer saved on this browser.");
  const store = await LocalStore.open(database);
  try {
    const device = await store.device();
    const account = before.accounts.find((a) => a.database === database)!;
    if (!device || device.userId !== account.userId) {
      await forgetAccount(database);
      throw new Error("This account was removed from this browser. Add it again to sign in.");
    }
  } finally {
    store.close();
  }
  await change((d) => {
    if (!d.accounts.some((a) => a.database === database)) throw new Error("That account is no longer saved on this browser.");
    d.active = database;
    d.pending = null;
  });
  if (before.pending && before.pending.database !== database) await LocalStore.erase(null, before.pending.database);
}

export async function startAddingAccount(): Promise<void> {
  await change((d) => {
    if (!d.pending) d.pending = { database: `orbit-web-account-${crypto.randomUUID()}`, returnTo: d.active };
  });
}

export async function cancelAddingAccount(): Promise<void> {
  const before = await accountDirectory();
  await change((d) => {
    d.pending = null;
  });
  if (before.pending) await LocalStore.erase(null, before.pending.database);
}

/** Removing one account never erases another account's database or tokens. */
export async function forgetAccount(database: string): Promise<AccountDirectory> {
  return change((d) => {
    d.accounts = d.accounts.filter((a) => a.database !== database);
    if (d.active === database) d.active = d.accounts[0]?.database ?? null;
    if (d.pending?.database === database) d.pending = null;
  });
}
