import { text as uiText } from "../i18n";
import { z } from "zod";
import type { Engine } from "../sync/engine";
import { isAppPath, SW_OPEN, SW_WAKE } from "../sw/messages";
import { go } from "./router";
import { saveWakePrefs } from "../sw/swPrefs";
import { config, type FirebaseWebConfig } from "./config";
import { getPrefs, subscribePrefs } from "./prefs";
import { needsRegistration, type SavedRegistration } from "./pushRules";
import { prepareLocale, resolveLanguage } from "../i18n";
import { subscribeCatalog } from "../i18n/runtime";
/**
 * This browser's notifications (docs/MELDIQ_WEB_PUSH.md).
 *
 * Foreground: the page shows them itself, through the service worker's registration where there is one (so a click is
 * handled even after the tab was discarded, and Chrome on Android, which has no `new Notification`, works too).
 *
 * Background: Firebase Cloud Messaging, the same project and the same content-free wake-up as the Android app. This
 * browser registers its FCM token for its own device (PUT /v1/devices/current/fcm); the server wakes it when something is
 * queued while its connection is closed, and the service worker (src/sw/sw.ts) shows what's waiting.
 */
const ICON = "/meldling-192.png";
const BADGE = "/meldling-badge-96.png";
const SAVED_KEY = "meldiq.push.v1";
let registration: ServiceWorkerRegistration | null = null;
export const pushSupported = (): boolean =>
  typeof navigator !== "undefined" && "serviceWorker" in navigator && typeof window !== "undefined" && "PushManager" in window && typeof Notification !== "undefined";
/**
 * Registers the service worker (once per page) and listens to it: a wake-up connects again now; a notification click
 * opens that conversation. The choices it needs are copied to it whenever they change.
 */
export async function startServiceWorker(engine: Engine): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.addEventListener("message", (e: MessageEvent) => {
    const d = e.data as {
      type?: unknown;
      href?: unknown;
      database?: unknown;
    } | null;
    if (d?.type === SW_WAKE) engine.reconnect();
    else if (d?.type === SW_OPEN && isAppPath(d.href)) {
      window.focus();
      if (typeof d.database === "string" && d.database !== engine.store.name) {
        void import("./accountSwitch")
          .then(({ switchSavedAccount }) => switchSavedAccount(engine, d.database as string, d.href as string))
          .catch((err: unknown) => engine.notice("error", err instanceof Error ? err.message : uiText("workspace.interface.switch_accounts_to_open_this_notification_139954a")));
      } else go(d.href);
    }
  });
  let mirrorGeneration = 0;
  const mirror = () => {
    const generation = ++mirrorGeneration;
    const p = getPrefs();
    const locale = resolveLanguage(p.language);
    void prepareLocale(locale, ["notifications"])
      .then(() => {
        if (generation !== mirrorGeneration) return;
        return saveWakePrefs({
          notifications: p.notifications,
          groupNotifications: p.groupNotifications,
          notificationText: p.notificationText,
          locale,
          copy: {
            waiting: uiText("notifications.background.waiting"),
            newMessage: uiText("notifications.background.newMessage"),
            newMessages: uiText("notifications.background.newMessages"),
            incomingVideo: uiText("notifications.background.incomingVideo"),
            incomingVoice: uiText("notifications.background.incomingVoice"),
            group: uiText("notifications.background.group"),
            directMessage: uiText("notifications.background.directMessage"),
            channel: uiText("notifications.background.channel"),
          },
        });
      })
      .catch(() => undefined);
  };
  mirror();
  subscribePrefs(mirror);
  subscribeCatalog(mirror);
  try {
    // One classic script at the root (vite.sw.config.ts), in development too (npm run dev builds it into public/).
    registration = await navigator.serviceWorker.register("/sw.js", { type: "classic", scope: "/" });
  } catch {
    registration = null; // notifications fall back to the page's own
  }
}
export interface SystemNotice {
  database?: string;
  title: string;
  body: string;
  /** Same tag: the newer notification replaces the older, and still alerts (renotify). */
  tag: string;
  /** A path of this app opened on click ("/home/c/…"). */
  href: string | null;
  silent?: boolean;
  requireInteraction?: boolean;
}
/** Shows a system notification (permission and preferences are the caller's checks). */
export function systemNotify(n: SystemNotice): void {
  const options = {
    body: n.body,
    tag: n.database ? `${n.database}:${n.tag}` : n.tag,
    renotify: true,
    silent: n.silent ?? false,
    requireInteraction: n.requireInteraction ?? false,
    icon: ICON,
    badge: BADGE,
    data: { url: n.href ?? "/", database: n.database },
  };
  if (registration?.active) {
    void registration.showNotification(n.title, options as NotificationOptions).catch(() => fallback(n));
    return;
  }
  fallback(n);
}
function fallback(n: SystemNotice): void {
  try {
    const shown = new Notification(n.title, { body: n.body, tag: n.tag, silent: n.silent ?? false, requireInteraction: n.requireInteraction ?? false, icon: ICON });
    shown.onclick = () => {
      window.focus();
      if (n.href) go(n.href);
      shown.close();
    };
  } catch {
    /* notifications unavailable in this context */
  }
}
// ───────────── background notifications (Firebase) ─────────────
const zSaved = z.object({ deviceId: z.string(), token: z.string(), at: z.number() });
function saved(): SavedRegistration | null {
  try {
    const r = zSaved.safeParse(JSON.parse(localStorage.getItem(SAVED_KEY) ?? "null"));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
function save(r: SavedRegistration | null): void {
  try {
    if (r) localStorage.setItem(SAVED_KEY, JSON.stringify(r));
    else localStorage.removeItem(SAVED_KEY);
  } catch {
    /* kept for this page only */
  }
}
/** Whether this browser's token is registered for [deviceId] (as far as this browser knows). */
export const pushRegistered = (deviceId: string): boolean => saved()?.deviceId === deviceId;
/** Whether the server and this site can do background notifications at all. */
export function pushAvailable(engine: Engine): FirebaseWebConfig | null {
  const fb = config().firebase;
  return fb && engine.state.get().server?.features.includes("push-fcm") ? fb : null;
}
async function messaging(fb: FirebaseWebConfig) {
  const [{ getApp, getApps, initializeApp }, m] = await Promise.all([import("firebase/app"), import("firebase/messaging")]);
  if (!(await m.isSupported())) throw new PushError(uiText("workspace.interface.this_browser_can_t_receive_firebase_notifications_5a94042"));
  const app = getApps().length ? getApp() : initializeApp({ apiKey: fb.apiKey, projectId: fb.projectId, messagingSenderId: fb.messagingSenderId, appId: fb.appId });
  return { m, messaging: m.getMessaging(app) };
}
export class PushError extends Error {}
/** Why getToken failed, in the words Settings shows. Brave turns Google's push service off unless the person allows it. */
function explain(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  if (/push service|AbortError|registration failed/i.test(text)) return uiText("workspace.interface.the_browser_s_push_service_refused_in_brave_turn_on_settings_priv_b3ab49e");
  if (/permission/i.test(text)) return uiText("workspace.interface.notifications_aren_t_allowed_for_this_site_92e557e");
  if (/network|fetch|Failed to fetch/i.test(text)) return uiText("workspace.interface.couldn_t_reach_google_s_notification_service_check_your_connectio_79ece19");
  return uiText("workspace.interface.background_notifications_couldn_t_be_turned_on_a849bc5");
}
/**
 * Registers this browser for background notifications: its Firebase token for this device. Called from the person's own
 * click in Settings (the permission prompt needs one), and again at start when the token may have changed.
 */
export async function registerPush(
  engine: Engine,
  opts: {
    force?: boolean;
  } = {},
): Promise<void> {
  const fb = pushAvailable(engine);
  if (!fb || !pushSupported() || Notification.permission !== "granted") return;
  const reg = registration ?? (await navigator.serviceWorker.ready);
  let token: string;
  try {
    const { m, messaging: msg } = await messaging(fb);
    token = await m.getToken(msg, { vapidKey: fb.vapidKey, serviceWorkerRegistration: reg });
  } catch (e) {
    throw new PushError(e instanceof PushError ? e.message : explain(e));
  }
  if (!token) throw new PushError(uiText("workspace.interface.no_notification_token_was_issued_try_again_20d0351"));
  if (!opts.force && !needsRegistration(saved(), engine.device.deviceId, token, Date.now())) return;
  await engine.api.call("PUT", "/v1/devices/current/fcm", { body: { token } });
  save({ deviceId: engine.device.deviceId, token, at: Date.now() });
}
/** Turns background notifications off on this browser: the server forgets the token and Firebase deletes it. */
export async function unregisterPush(engine: Engine): Promise<void> {
  save(null);
  await engine.api.call("DELETE", "/v1/devices/current/fcm").catch(() => undefined);
  const fb = pushAvailable(engine);
  if (!fb) return;
  await messaging(fb)
    .then(({ m, messaging: msg }) => m.deleteToken(msg))
    .catch(() => undefined);
}
/** At start: registers again when the token changed or a day passed (never asks for permission). */
export function refreshPush(engine: Engine): void {
  if (!getPrefs().notifications || !pushSupported() || Notification.permission !== "granted") return;
  void registerPush(engine).catch(() => undefined);
}
/**
 * Signing out: this browser stops receiving (the server already removed the token with the device). Call it after the
 * local data is erased: in WebKit, asking the service worker for its push subscription while IndexedDB is being deleted
 * stalls the deletion (found by e2e/cross-device.spec.ts). Only a browser that registered has anything to drop.
 */
export function forgetPush(): void {
  const registered = saved() !== null;
  save(null);
  if (!registered || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  void navigator.serviceWorker
    .getRegistration()
    .then((r) => r?.pushManager?.getSubscription())
    .then((sub) => sub?.unsubscribe())
    .catch(() => undefined);
}
