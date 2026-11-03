import { useSyncExternalStore } from "react";
import { getPrefs, setPrefs } from "../application/prefs";
import { isLanguageChoice, resolveLanguage, type LanguageChoice } from "./languages";
import { prepareLocale } from "./runtime";

const GUEST_KEY = "meldiq.locale.guest";
const ACCOUNT_PREFIX = "meldiq.locale.account.";
export type LanguageStatus = "browser" | "syncing" | "saved" | "loading" | "failed";
type CachedChoice = { choice: LanguageChoice; dirty: boolean };
export interface LocaleAccount {
  id: string;
  read(): { supported: boolean; locale: LanguageChoice | null; pending: boolean; revision: number };
  write(choice: LanguageChoice): Promise<void>;
  subscribe(listener: () => void): () => void;
}
const listeners = new Set<() => void>();
let state: { status: LanguageStatus; requested: LanguageChoice | null } = { status: "browser", requested: null };
let active: LocaleAccount | null = null;
let cached: CachedChoice | null = null;
let attempted = "";
let generation = 0;
const emit = (status: LanguageStatus, requested: LanguageChoice | null = null) => {
  if (state.status === status && state.requested === requested) return;
  state = { status, requested };
  for (const listener of listeners) listener();
};
function readStorage(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}
function store(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* In-memory selection still works. */
  }
}
export function guestLanguage(): LanguageChoice | null {
  const stored = readStorage(GUEST_KEY);
  return isLanguageChoice(stored) ? stored : null;
}
function accountChoice(id: string): CachedChoice | null {
  const value = readStorage(ACCOUNT_PREFIX + id) as Partial<CachedChoice> | null;
  return value && isLanguageChoice(value.choice) ? { choice: value.choice, dirty: value.dirty === true } : null;
}
function cacheAccount(choice: LanguageChoice, dirty: boolean): void {
  if (cached?.choice === choice && cached.dirty === dirty) return;
  cached = { choice, dirty };
  if (active) store(ACCOUNT_PREFIX + active.id, cached);
}
async function apply(choice: LanguageChoice): Promise<void> {
  const mine = ++generation;
  await prepareLocale(resolveLanguage(choice));
  if (mine === generation && getPrefs().language !== choice) setPrefs({ language: choice });
}
function synchronize(): void {
  const account = active;
  if (!account) return;
  const remote = account.read();
  if (!remote.supported) {
    emit("browser");
    return;
  }
  if (cached?.dirty) {
    if (!remote.pending && remote.locale === cached.choice) {
      cacheAccount(cached.choice, false);
      emit("saved");
      return;
    }
    emit("syncing");
    const operation = `${remote.revision}/${cached.choice}`;
    if (!remote.pending && attempted !== operation) {
      attempted = operation;
      void account
        .write(cached.choice)
        .then(() => {
          if (active !== account) return;
          const result = account.read();
          if (!result.pending && result.locale !== cached?.choice) emit("browser");
        })
        .catch(() => {
          if (active === account) emit("browser");
        });
    }
    return;
  }
  if (isLanguageChoice(remote.locale)) {
    cacheAccount(remote.locale, false);
    emit("saved");
    if (getPrefs().language !== remote.locale) void apply(remote.locale).catch(() => emit("failed"));
  } else {
    // Migrate an explicit guest choice once, never automatic browser detection.
    const guest = guestLanguage();
    if (guest) {
      cacheAccount(guest, true);
      synchronize();
    } else emit("browser");
  }
}

/** Bind to the existing preference channel; neither this binding nor language selection restarts the engine. */
export function bindLocaleAccount(account: LocaleAccount): () => void {
  // Preserve a pre-existing explicit browser choice when upgrading the former three-language implementation.
  if (!guestLanguage() && getPrefs().language !== "system" && !active) store(GUEST_KEY, getPrefs().language);
  active = account;
  cached = accountChoice(account.id);
  attempted = "";
  const initial = cached?.choice ?? guestLanguage() ?? "system";
  void apply(initial).catch(() => emit("failed"));
  let signature = "";
  const unsubscribe = account.subscribe(() => {
    const next = JSON.stringify(account.read());
    if (next !== signature) {
      signature = next;
      synchronize();
    }
  });
  synchronize();
  return () => {
    unsubscribe();
    if (active === account) {
      active = null;
      cached = null;
      generation++;
      emit("browser");
    }
  };
}

/** Load the visible namespaces first, then commit atomically. Last selection wins if chunk loads race. */
export async function chooseLanguage(choice: LanguageChoice): Promise<boolean> {
  if (!isLanguageChoice(choice)) return false;
  const mine = ++generation;
  const account = active;
  emit("loading", choice);
  try {
    await prepareLocale(resolveLanguage(choice));
    if (mine !== generation || active !== account) return false;
    setPrefs({ language: choice });
    if (account) {
      cacheAccount(choice, true);
      attempted = "";
      synchronize();
    } else {
      store(GUEST_KEY, choice);
      emit("browser");
    }
    return true;
  } catch {
    if (mine === generation) emit("failed");
    return false;
  }
}

export function useLanguageStatus() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
    () => state,
  );
}
