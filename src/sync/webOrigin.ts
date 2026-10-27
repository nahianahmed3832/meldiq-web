/**
 * Where Meldiq's own links point (invitations, messages): the address this app is served from, so a link always opens
 * a page that exists (web.meldiq.app in production). meldiq.app links from older builds and the phone are still
 * recognised when pasted or clicked.
 */
const FALLBACK = "https://web.meldiq.app";

export function webOrigin(): string {
  const o = typeof location !== "undefined" ? location.origin : "";
  return /^https?:\/\/[^/]+$/.test(o) ? o : FALLBACK;
}

/** The hosts whose /invite/ and /m/ links are Meldiq's: the short domain, the web app's, the former one, and this one. */
export function meldiqHost(host: string): boolean {
  const h = host.toLowerCase();
  if (["meldiq.app", "www.meldiq.app", "web.meldiq.app", "web.griipbuddy.cloud"].includes(h)) return true;
  return typeof location !== "undefined" && h === location.host.toLowerCase();
}

/** The path of [url] when it's an https (or this app's own) link on a Meldiq host; null otherwise. */
export function meldiqPath(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const own = typeof location !== "undefined" && u.origin === location.origin;
    return (u.protocol === "https:" || own) && meldiqHost(u.host) ? u.pathname : null;
  } catch {
    return null;
  }
}
