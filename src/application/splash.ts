/**
 * The launch screen in index.html (docs/MELDIQ_WEB_LAUNCH.md): Meldling from the first paint, before any script, and
 * dismissed as soon as the app has something to show (sign-in, the app, or an error). Only on a full page load: moving
 * around the app never shows it again. A browser that was signed in here last time shows the app's own frame instead,
 * with skeletons where its lists go (public/boot.js picks which before the first paint), as installed apps reopen.
 */
const MAX_MS = 10_000;
const FADE_MS = 260;

let done = false;

export function hideSplash(): void {
  if (done || typeof document === "undefined") return;
  done = true;
  markStartup("frame");
  const el = document.getElementById("splash");
  if (!el) return;
  el.classList.add("done");
  setTimeout(() => el.remove(), FADE_MS);
}

/** At start: whatever happens, the screen goes after 10 s. */
export function startSplash(): void {
  if (typeof document === "undefined" || !document.getElementById("splash")) return;
  setTimeout(hideSplash, MAX_MS);
}

const marked = new Set<string>();

/**
 * Start-up timings as performance marks, once per page: "meldiq:frame" when the launch screen goes (the app's frame is
 * up), "meldiq:view" when the conversation on screen first shows its messages. Read them with
 * performance.getEntriesByType("mark") to measure a reload.
 */
export function markStartup(name: "frame" | "view"): void {
  if (marked.has(name) || typeof performance === "undefined" || typeof performance.mark !== "function") return;
  marked.add(name);
  performance.mark(`meldiq:${name}`);
}

/** Read by public/boot.js before the first paint: "1" when the app was open here last time. */
const RETURNING_KEY = "meldiq.returning";

/** Whether this browser opens straight into the app's frame next time (signed in) or on Meldling (signed out). */
export function rememberReturning(on: boolean): void {
  try {
    if (on) localStorage.setItem(RETURNING_KEY, "1");
    else localStorage.removeItem(RETURNING_KEY);
  } catch {
    /* storage unavailable: the launch screen shows, as before */
  }
}
