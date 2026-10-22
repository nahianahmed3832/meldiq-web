/** What the service worker and the page tell each other (src/sw/sw.ts, src/application/webPush.ts). */
export const SW_WAKE = "meldiq-wake";
export const SW_OPEN = "meldiq-open";

/** A wake-up arrived: an open page fetches what's new now (its own connection may have been asleep). */
export interface WakeMessage {
  type: typeof SW_WAKE;
}

/** A notification was clicked: the page goes to [hash] (a route of this app, e.g. "#/dms/c/<id>"). */
export interface OpenMessage {
  type: typeof SW_OPEN;
  hash: string;
}

/** Only this app's own routes, so a notification can never send the page anywhere else. */
export const isAppHash = (hash: unknown): hash is string => typeof hash === "string" && /^#\/[A-Za-z0-9/_%-]{0,300}$/.test(hash);
