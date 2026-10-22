/**
 * The launch screen in index.html (docs/MELDIQ_WEB_LAUNCH.md): shown from the first paint, before any script, and
 * dismissed as soon as the app has something to show (sign-in, the app, or an error), never waiting for the animation.
 * Only on a full page load: moving around the app never shows it again.
 */
const MAX_MS = 10_000;
const FADE_MS = 260;

let done = false;

export function hideSplash(): void {
  if (done || typeof document === "undefined") return;
  done = true;
  const el = document.getElementById("splash");
  if (!el) return;
  el.querySelector("video")?.pause();
  el.classList.add("done");
  setTimeout(() => el.remove(), FADE_MS);
}

/** At start: a slow connection or Data Saver keeps the still logo only; whatever happens, the screen goes after 10 s. */
export function startSplash(): void {
  const el = typeof document === "undefined" ? null : document.getElementById("splash");
  if (!el) return;
  const video = el.querySelector("video");
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (video && (connection?.saveData || connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g")) {
    video.removeAttribute("autoplay");
    video.pause();
    video.remove();
  }
  // A video that can't play (unsupported, blocked, out of memory) leaves the still logo.
  video?.addEventListener("error", () => video.remove(), true);
  setTimeout(hideSplash, MAX_MS);
}
