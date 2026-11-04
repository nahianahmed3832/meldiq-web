import { useSyncExternalStore } from "react";

const memory = new Map<string, number>();
const listeners = new Set<() => void>();
const keyFor = (accountId: string) => `meldiq.welcome.v1.${encodeURIComponent(accountId)}`;
const validStage = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= -1 && Number(value) <= 2;

/** Account-scoped presentation progress only. No credentials, keys, profile drafts or permission grants. */
export function welcomeStage(accountId: string | undefined): number | null {
  if (!accountId) return null;
  try {
    const saved = localStorage.getItem(keyFor(accountId));
    if (saved === null) return null;
    const value: unknown = JSON.parse(saved);
    return validStage(value) ? value : null;
  } catch {
    return memory.get(accountId) ?? null;
  }
}
export function saveWelcomeStage(accountId: string, stage: number): void {
  if (!accountId || !validStage(stage)) return;
  memory.set(accountId, stage);
  try {
    localStorage.setItem(keyFor(accountId), JSON.stringify(stage));
  } catch {
    // The current browser session still works when persistent storage is unavailable.
  }
  for (const listener of listeners) listener();
}
export function startWelcome(accountId: string): void {
  if (welcomeStage(accountId) === null) saveWelcomeStage(accountId, 0);
}
export function useWelcomeStage(accountId: string | undefined): number | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      window.addEventListener("storage", listener);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", listener);
      };
    },
    () => welcomeStage(accountId),
    () => null,
  );
}
