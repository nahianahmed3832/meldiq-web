/**
 * Background notifications on the web (docs/MELDIQ_WEB_PUSH.md): what Settings shows, and when this browser registers its
 * Firebase token with the server again. Pure, so the states are tested without a browser.
 */
export type PushState = "unsupported" | "insecure" | "not-offered" | "not-configured" | "denied" | "needs-permission" | "off" | "registering" | "failed" | "needs-registration" | "on";

export interface PushStateInput {
  /** Service workers, the Push API and notifications exist in this browser. */
  supported: boolean;
  /** HTTPS (or localhost): browsers only allow push there. */
  secure: boolean;
  /** The server sends Firebase wake-ups (`push-fcm`). */
  serverOffers: boolean;
  /** This site has its Firebase web settings (config.json `firebase`). */
  configured: boolean;
  permission: NotificationPermission;
  /** The person's Desktop notifications choice. */
  enabled: boolean;
  /** This browser's token is registered with the server. */
  registered: boolean;
  busy: boolean;
  error: string | null;
}

export function pushState(i: PushStateInput): PushState {
  if (!i.supported) return "unsupported";
  if (!i.secure) return "insecure";
  if (!i.serverOffers) return "not-offered";
  if (!i.configured) return "not-configured";
  if (i.permission === "denied") return "denied";
  if (i.permission !== "granted") return "needs-permission";
  if (!i.enabled) return "off";
  if (i.registered) return "on";
  if (i.busy) return "registering";
  if (i.error) return "failed";
  return "needs-registration";
}

/** Registered again at least this often, so a token the server dropped (failing for a week) comes back. */
export const REGISTER_AGAIN_MS = 24 * 3600_000;

export interface SavedRegistration {
  deviceId: string;
  token: string;
  at: number;
}

export function needsRegistration(saved: SavedRegistration | null, deviceId: string, token: string, now: number): boolean {
  return !saved || saved.deviceId !== deviceId || saved.token !== token || now - saved.at > REGISTER_AGAIN_MS;
}
