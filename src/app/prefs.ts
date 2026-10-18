import { useSyncExternalStore } from "react";

/**
 * Per-browser preferences. They hold no account data, so they live in localStorage, and every read and write tolerates
 * storage being unavailable (private windows, blocked site data): the defaults apply then.
 */
export interface Prefs {
  theme: "system" | "light" | "dark";
  notifications: boolean;
  /** Show the sender and message text in system notifications (off: "New message"). */
  notificationText: boolean;
  readReceipts: boolean;
  typing: boolean;
  enterToSend: boolean;
  /** The selected workspace; null: none chosen yet. */
  orgId: string | null;
  /** Collapsed sidebar sections. */
  collapsed: string[];
}

const KEY = "orbit.prefs.v1";
const defaults: Prefs = { theme: "system", notifications: false, notificationText: true, readReceipts: true, typing: true, enterToSend: true, orgId: null, collapsed: [] };

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<Prefs>) } : defaults;
  } catch {
    return defaults;
  }
}

let current: Prefs = load();
const listeners = new Set<() => void>();

export function getPrefs(): Prefs {
  return current;
}

export function setPrefs(change: Partial<Prefs>): void {
  current = { ...current, ...change };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* kept for this page only */
  }
  applyTheme(current.theme);
  for (const l of [...listeners]) l();
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

export function applyTheme(theme: Prefs["theme"]): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function resetPrefs(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing stored */
  }
  current = defaults;
  applyTheme(current.theme);
  for (const l of [...listeners]) l();
}
