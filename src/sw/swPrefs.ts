import { openDB } from "idb";
import type { WakePrefs } from "./wakeRules";

/**
 * The few notification choices the service worker needs, copied here by the page whenever they change: a service worker
 * can't read the page's localStorage. A database of its own, so it never waits on the app's (orbit-web) upgrades.
 */
const DB = "meldiq-sw";
const KEY = "prefs";

const open = () => openDB(DB, 1, { upgrade: (db) => void db.createObjectStore("kv") });

export async function saveWakePrefs(p: WakePrefs): Promise<void> {
  const db = await open();
  try {
    await db.put("kv", p, KEY);
  } finally {
    db.close();
  }
}

export async function loadWakePrefs(): Promise<WakePrefs | null> {
  const db = await open();
  try {
    return ((await db.get("kv", KEY)) as WakePrefs | undefined) ?? null;
  } finally {
    db.close();
  }
}

let noticeTail: Promise<void> = Promise.resolve();
const digest = async (value: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map((v) => v.toString(16).padStart(2, "0")).join("");
/** Persist only hashes of device/tag/event ids. Failed displays remain retryable; repeated pushes do not re-alert. */
export function showWakeNoticeOnce(deviceId: string, tag: string, identity: string, show: () => Promise<void>): Promise<void> {
  const run = noticeTail
    .catch(() => undefined)
    .then(async () => {
      const key = `notice:${await digest(JSON.stringify([deviceId, tag]))}`;
      const value = await digest(identity);
      const db = await open().catch(() => null);
      try {
        const prior = db ? ((await db.get("kv", key).catch(() => null)) as { value: string } | null) : null;
        if (prior?.value === value) return;
        await show();
        if (db) {
          try {
            const tx = db.transaction("kv", "readwrite");
            const keys = await tx.store.getAllKeys();
            const stored = await tx.store.getAll();
            const entries = keys.flatMap((k, i) => (typeof k === "string" && k.startsWith("notice:") ? [{ key: k, at: (stored[i] as { at?: number })?.at ?? 0 }] : []));
            entries.sort((a, b) => b.at - a.at);
            for (const item of entries.filter((item, i) => i >= 999 || item.at < Date.now() - 7 * 86400000)) await tx.store.delete(item.key);
            await tx.store.put({ value, at: Date.now() }, key);
            await tx.done;
          } catch {
            /* Notification still shows when browser storage is unavailable. */
          }
        }
      } finally {
        db?.close();
      }
    });
  noticeTail = run;
  return run;
}
