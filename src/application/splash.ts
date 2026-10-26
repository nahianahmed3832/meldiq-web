/**
 * The launch screen in index.html (docs/MELDIQ_WEB_LAUNCH.md): Meldling from the first paint, before any script, and
 * dismissed as soon as the app has something to show (sign-in, the app, or an error). Only on a full page load: moving
 * around the app never shows it again.
 */
const MAX_MS = 10_000;
const FADE_MS = 260;

let done = false;

export function hideSplash(): void {
  if (done || typeof document === "undefined") return;
  done = true;
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
