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
