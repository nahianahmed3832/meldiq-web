import { useSyncExternalStore } from "react";
import type { Engine } from "../../sync/engine";
import { type Connections, connections } from "../../sync/social";

/**
 * Connection requests for this account, kept for the whole page (reported 2026-10-23: a request reached nobody, since
 * the lists were only loaded inside the Connections dialog and the server's `connections.updated` frame refreshed
 * nothing on screen). The shell refreshes them on start and on every frame (ConnectionRequestWatcher).
 */
let lists: Connections | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function refreshConnections(engine: Engine): Promise<Connections> {
  const next = await connections(engine);
  lists = next;
  emit();
  return next;
}

export function forgetConnections(): void {
  lists = null;
  emit();
}

export function useConnectionLists(): Connections | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => lists,
    () => null,
  );
}

/** How many people asked to connect with you and are waiting for an answer. */
export function useIncomingRequestCount(): number {
  return useConnectionLists()?.incoming.length ?? 0;
}

type Incoming = Connections["incoming"];

/**
 * The requests to tell the person about: ones that weren't there at the last check; on the first check of a page (no
 * earlier list), the ones newer than the last request already told about in this browser, so a reload doesn't repeat them.
 */
export function newRequests(before: Incoming | null, now: Incoming, toldUntil: number): Incoming {
  if (before) {
    const known = new Set(before.map((e) => e.user.id));
    return now.filter((e) => !known.has(e.user.id));
  }
  return now.filter((e) => e.at > toldUntil);
}

const TOLD_KEY = "meldiq.connectionRequests.toldUntil";

export function toldUntil(): number {
  try {
    const v = Number(localStorage.getItem(TOLD_KEY));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

export function rememberTold(incoming: Incoming): void {
  const latest = Math.max(toldUntil(), ...incoming.map((e) => e.at));
  try {
    localStorage.setItem(TOLD_KEY, String(latest));
  } catch {
    /* told again after a reload */
  }
}
