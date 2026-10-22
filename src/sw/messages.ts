/** What the service worker and the page tell each other (src/sw/sw.ts, src/application/webPush.ts). */
export const SW_WAKE = "meldiq-wake";
export const SW_OPEN = "meldiq-open";

/** A wake-up arrived: an open page fetches what's new now (its own connection may have been asleep). */
export interface WakeMessage {
  type: typeof SW_WAKE;
}

/** A notification was clicked: the page goes to [href] (a path of this app, e.g. "/dms/c/<id>"). */
export interface OpenMessage {
  type: typeof SW_OPEN;
  href: string;
}

const APP_PATH = /^\/(home|dms|activity|later|settings|workspace)(\/[A-Za-z0-9_%-]{1,128}){0,4}$/;

/** Only this app's own routes, so a notification can never send the page anywhere else. */
export const isAppPath = (href: unknown): href is string => typeof href === "string" && APP_PATH.test(href);

/**
 * The app path a notification opens: its URL's path, or the hash route of a notification shown before the move to
 * paths ("/#/dms/c/<id>"). Null for anything that isn't one of this app's routes.
 */
export function notificationPath(url: URL, origin: string): string | null {
  if (url.origin !== origin) return null;
  const where = url.hash.startsWith("#/") && url.pathname === "/" ? url.hash.slice(1) : url.pathname;
  return isAppPath(where) ? where : null;
}
