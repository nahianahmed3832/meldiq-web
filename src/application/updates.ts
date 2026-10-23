import { useSyncExternalStore } from "react";

/**
 * New releases reach open tabs (reported 2026-10-23: a deploy showed only after a manual refresh, like a website, not an
 * app). Each release has its own Next.js build id, in the page as __NEXT_DATA__. The page asks the server for the current
 * page now and then (every few minutes, and when the tab is looked at again) and compares. A newer release is offered
 * with a Reload button, as Discord does, and applied by itself while the tab isn't being looked at and nothing would be
 * cut short (holdUpdates: calls, uploads). Drafts are saved as they're typed, so a reload loses none.
 */
const CHECK_EVERY_MS = 5 * 60_000;
/** Coming back to the tab checks again, but not more often than this. */
const MIN_GAP_MS = 30_000;

/** The build id in a page of this app, or null (a development server, or a page that isn't this app's). */
export function buildIdOf(html: string): string | null {
  const id = /"buildId"\s*:\s*"([^"]{1,100})"/.exec(html)?.[1] ?? null;
  return id && id !== "development" ? id : null;
}

/** This page's own build id. */
export function runningBuild(): string | null {
  const data = (globalThis as { __NEXT_DATA__?: { buildId?: unknown } }).__NEXT_DATA__;
  const id = typeof data?.buildId === "string" ? data.buildId : null;
  return id && id !== "development" ? id : null;
}

let ready = false;
const listeners = new Set<() => void>();
/** Things a reload would cut short (a call, an upload): while any holds, the update waits for the Reload button. */
let holds = 0;

/** Keeps the tab from reloading by itself until the returned release is called (calls and uploads). */
export function holdUpdates(): () => void {
  holds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds--;
  };
}

export function useUpdateReady(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => ready,
    () => false,
  );
}

/** Reloads into the new release. */
export function applyUpdate(): void {
  location.reload();
}

/**
 * A screen of the release this tab started with, which the server no longer has (a release replaces the files): the
 * tab can only continue on the new release.
 */
export function isStaleChunkError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return e.name === "ChunkLoadError" || /Loading (CSS )?chunk .* failed|dynamically imported module/i.test(e.message);
}

const STALE_RELOAD_KEY = "meldiq.staleReloadAt";
/** One reload for a missing screen per this long, so a real outage doesn't reload in a loop. */
const STALE_RELOAD_GAP_MS = 60_000;

function reloadForStaleChunk(): void {
  try {
    const at = Number(sessionStorage.getItem(STALE_RELOAD_KEY) ?? 0);
    if (Date.now() - at < STALE_RELOAD_GAP_MS) return;
    sessionStorage.setItem(STALE_RELOAD_KEY, String(Date.now()));
  } catch {
    return; // can't remember the reload: don't risk a loop
  }
  applyUpdate();
}

/** Starts watching for new releases; returns the stop. */
export function watchForUpdates(): () => void {
  const running = runningBuild();
  if (!running || typeof window === "undefined") return () => undefined;
  let last = 0;
  let stopped = false;
  const maybeApply = () => {
    if (ready && document.visibilityState === "hidden" && holds === 0) applyUpdate();
  };
  const check = async () => {
    if (stopped || ready || Date.now() - last < MIN_GAP_MS) return maybeApply();
    last = Date.now();
    try {
      const res = await fetch("/", { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) return;
      const latest = buildIdOf(await res.text());
      if (latest && latest !== running && !stopped) {
        ready = true;
        listeners.forEach((l) => l());
        maybeApply();
      }
    } catch {
      /* offline: checked again later */
    }
  };
  const timer = setInterval(() => void check(), CHECK_EVERY_MS);
  const onVisible = () => (document.visibilityState === "visible" ? void check() : maybeApply());
  const onRejection = (e: PromiseRejectionEvent) => isStaleChunkError(e.reason) && reloadForStaleChunk();
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onVisible);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    stopped = true;
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", onVisible);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
