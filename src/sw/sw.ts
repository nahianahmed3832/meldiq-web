import { z } from "zod";
import { ApiClient } from "../api/client";
import { zConversation, zProfile, zQueueItem } from "../api/schemas";
import { installLegacyCurves } from "../crypto/legacyCurves";
import { LocalStore } from "../store/db";
import { type NavPrefs, PERSONAL, workspaceOf, zNavDoc } from "../sync/navPrefs";
import { SessionManager } from "../sync/session";
import { notificationPath, SW_OPEN, SW_WAKE } from "./messages";
import { loadWakePrefs } from "./swPrefs";
import { type WakeNotice, wakeNotices, type WakePrefs } from "./wakeRules";

/**
 * Meldiq's service worker (docs/MELDIQ_WEB_PUSH.md): background notifications. The server's Firebase wake-up carries
 * nothing ({"w":"1"}, the same as the Android app gets). When it arrives:
 *   - a Meldiq page in front: it's told to fetch now, and it notifies as usual;
 *   - otherwise this signs in as this browser (its device key, as the page does), reads what the server holds for it
 *     without acknowledging it, and shows one notification per conversation with new messages and one per ringing call,
 *     following the same settings as the app. Message text is never shown here: it's end-to-end encrypted, and only the
 *     app decrypts it. Pages in the background are told to fetch too; their notifications replace these (same tag).
 * A click focuses Meldiq (or opens it) at that conversation.
 */

interface ExtendableEventLike extends Event {
  waitUntil(p: Promise<unknown>): void;
}
interface NotificationEventLike extends ExtendableEventLike {
  notification: Notification;
}
interface WindowClientLike {
  visibilityState: DocumentVisibilityState;
  focus(): Promise<unknown>;
  postMessage(message: unknown): void;
}
interface ServiceWorkerScopeLike {
  registration: ServiceWorkerRegistration;
  clients: { matchAll(o: { type: "window"; includeUncontrolled: boolean }): Promise<WindowClientLike[]>; openWindow(url: string): Promise<unknown>; claim(): Promise<void> };
  location: { origin: string };
  skipWaiting(): Promise<void>;
  addEventListener(type: "install" | "activate" | "push" | "notificationclick", listener: (e: ExtendableEventLike & NotificationEventLike) => void): void;
}
const sw = self as unknown as ServiceWorkerScopeLike;

const ICON = "/meldiq-192.png";
const BADGE = "/meldiq-mark-128.png";
/** Shown when the server can't be asked (offline, signed out elsewhere): something is waiting, open the app. */
const GENERIC: WakeNotice = { tag: "meldiq-wake", title: "Meldiq", body: "Something new is waiting for you.", url: "/", call: false };

sw.addEventListener("install", () => void sw.skipWaiting());
sw.addEventListener("activate", (e) => e.waitUntil(sw.clients.claim()));
sw.addEventListener("push", (e) => e.waitUntil(onWake()));
sw.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(openApp((e.notification.data as { url?: unknown } | null)?.url));
});

async function onWake(): Promise<void> {
  const pages = await sw.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const p of pages) p.postMessage({ type: SW_WAKE });
  // A page in front shows what's new itself; the browser doesn't ask for a notification then.
  if (pages.some((p) => p.visibilityState === "visible")) return;
  let notices: WakeNotice[];
  try {
    notices = await lookUp();
  } catch {
    notices = [GENERIC];
  }
  for (const n of notices)
    await sw.registration.showNotification(n.title, { body: n.body, tag: n.tag, renotify: true, requireInteraction: n.call, icon: ICON, badge: BADGE, data: { url: n.url } } as NotificationOptions);
}

const zQueue = z.object({ items: z.array(zQueueItem) });
const zConversations = z.object({ conversations: z.array(zConversation) });

/** What's waiting for this browser, as notifications (nothing is acknowledged: the app still fetches it all). */
async function lookUp(): Promise<WakeNotice[]> {
  await installLegacyCurves().catch(() => []); // signing in below needs Ed25519 (Safari before 17: the fallback)
  const store = await LocalStore.open();
  let device;
  try {
    device = await store.device();
  } finally {
    store.close();
  }
  if (!device) return [];
  const session = new SessionManager("", device, () => undefined);
  if (!(await session.reauthenticate())) return [];
  const api = new ApiClient("", session);
  const [{ items }, { conversations }, { user }, saved] = await Promise.all([
    api.json("GET", "/v1/queue?limit=200", zQueue),
    api.json("GET", "/v1/conversations", zConversations),
    api.json("GET", "/v1/users/me", z.object({ user: zProfile })),
    loadWakePrefs().catch(() => null),
  ]);
  const byId = Object.fromEntries(conversations.map((c) => [c.id, c]));
  const docs = [...new Set(items.map((it) => workspaceOf(byId[it.conversationId]?.orgId ?? null)))];
  const nav: Record<string, NavPrefs | undefined> = {};
  await Promise.all(
    docs.map(async (id) => {
      nav[id] = await api
        .json("GET", `/v1/me/preferences/${encodeURIComponent(id)}`, zNavDoc)
        .then((d) => d.prefs)
        .catch(() => undefined);
    }),
  );
  nav[PERSONAL] ??= undefined;
  return wakeNotices({ me: device.userId, now: Date.now(), items, conversations: byId, nav, prefs: saved ?? defaultPrefs(), pausedUntil: user.notificationsPausedUntil ?? null });
}

/** Before the page has copied its choices here: on, as permission was granted for this site. */
const defaultPrefs = (): WakePrefs => ({ notifications: true, groupNotifications: true, notificationText: true });

async function openApp(url: unknown): Promise<void> {
  const target = new URL(typeof url === "string" ? url : "/", sw.location.origin);
  // Only this site, and only its own routes.
  const href = notificationPath(target, sw.location.origin);
  const pages = await sw.clients.matchAll({ type: "window", includeUncontrolled: true });
  const page = pages.find((p) => p.visibilityState === "visible") ?? pages[0];
  if (page) {
    await page.focus().catch(() => undefined);
    if (href) page.postMessage({ type: SW_OPEN, href });
    return;
  }
  await sw.clients.openWindow(`${sw.location.origin}${href ?? "/"}`);
}
