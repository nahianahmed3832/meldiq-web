import { apiBase, wsUrl } from "./config";
import { liveKitMedia } from "../call/media";
import { Ringtone } from "../call/ringtone";
import { LocalStore } from "../store/db";
import { Engine } from "../sync/engine";
import type { SessionGrant } from "../api/schemas";
import type { DeviceRecord } from "../model/types";
import { getPrefs } from "./prefs";
import { refreshPush, startServiceWorker, systemNotify } from "./webPush";

/**
 * What this browser needs: a secure context, WebCrypto with Ed25519 and X25519 (natively, or the fallback that main.tsx
 * installs for Safari before 17), IndexedDB and WebSockets. Colours no longer need light-dark(): older browsers get the
 * same palettes through a generated fallback (vite.config.ts, docs/MELDIQ_WEB_BROWSERS.md).
 */
export async function missingCapabilities(): Promise<string[]> {
  const missing: string[] = [];
  if (!window.isSecureContext) missing.push("a secure connection (HTTPS)");
  if (!window.crypto?.subtle) missing.push("the Web Crypto API");
  if (typeof indexedDB === "undefined") missing.push("IndexedDB storage");
  if (typeof WebSocket === "undefined") missing.push("WebSockets");
  if (missing.length) return missing;
  try {
    await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
  } catch {
    missing.push("Ed25519 signatures in Web Crypto");
  }
  try {
    await crypto.subtle.generateKey({ name: "X25519" }, false, ["deriveBits"]);
  } catch {
    missing.push("X25519 key agreement in Web Crypto");
  }
  return missing;
}

const allowed = (): boolean => getPrefs().notifications && typeof Notification !== "undefined" && Notification.permission === "granted";
const lookedAt = (): boolean => document.visibilityState === "visible" && document.hasFocus();
const room = (id: string | null): string | null => (id ? `#/home/c/${encodeURIComponent(id)}` : null);

/** System notifications for messages that arrive while this tab isn't looked at (src/app/webPush.ts shows them). */
function notify(title: string, body: string, conversationId: string): void {
  if (!allowed() || lookedAt()) return;
  const p = getPrefs();
  systemNotify({ title: p.notificationText ? title : "Meldiq", body: p.notificationText ? body : "New message", tag: conversationId, hash: room(conversationId), silent: !p.messageSound });
}

/** A reminder that went off (Later): a system notification (when allowed) that opens Later or the saved message. */
function notifyReminder(title: string, body: string, conversationId: string | null): void {
  if (!allowed()) return;
  const p = getPrefs();
  // Reminders are private by default: with message text hidden, the notification doesn't say what it's about.
  systemNotify({ title: p.notificationText ? title : "Meldiq reminder", body: p.notificationText ? body : "You have a reminder", tag: `reminder:${title}`, hash: room(conversationId) ?? "#/later" });
}

/** A scheduled meeting starting in ten minutes (round 7): opens its voice room. */
function notifyMeeting(title: string, body: string, roomId: string | null): void {
  if (!allowed()) return;
  const p = getPrefs();
  systemNotify({
    title: p.notificationText ? title : "Meldiq meeting",
    body: p.notificationText ? body : "A meeting starts soon",
    tag: `meeting:${title}`,
    hash: room(roomId),
    silent: !p.messageSound,
  });
}

/** A ringing call while this tab isn't looked at: a system notification that brings the tab forward to its conversation. */
function ringAlert(title: string, video: boolean, conversationId: string): void {
  if (!allowed() || lookedAt()) return;
  const p = getPrefs();
  systemNotify({
    title: p.notificationText ? title : "Meldiq",
    body: video ? "Incoming video call" : "Incoming voice call",
    tag: `call-${conversationId}`,
    hash: room(conversationId),
    requireInteraction: true,
  });
}

export function createEngine(device: DeviceRecord, store: LocalStore): Engine {
  const engine = new Engine(device, store, {
    base: apiBase(),
    wsUrl: wsUrl(),
    notify,
    notifyReminder,
    notifyMeeting,
    media: liveKitMedia,
    ringtone: new Ringtone(() => getPrefs().callRingtone),
    callPrefs: () => {
      const p = getPrefs();
      return { noiseReduction: p.noiseReduction, shareMode: p.shareMode, shareAudio: p.shareAudio };
    },
    ringAlert,
    prefs: () => {
      const p = getPrefs();
      return { readReceipts: p.readReceipts, typing: p.typing, groupNotifications: p.groupNotifications };
    },
  });
  // Development builds only (removed from production bundles): lets the browser tests and a developer inspect state.
  if (import.meta.env.DEV) (window as unknown as { __orbit?: Engine }).__orbit = engine;
  return engine;
}

export async function startEngine(device: DeviceRecord, store: LocalStore, grant?: SessionGrant): Promise<Engine> {
  const engine = createEngine(device, store);
  await engine.start(grant);
  startNotifications(engine);
  return engine;
}

/** After the engine started: notifications through the service worker, and the background-notification token kept current. */
export function startNotifications(engine: Engine): void {
  void startServiceWorker(engine).then(() => refreshPush(engine));
}

const LOCK = "orbit-web-device";
let held: Promise<boolean> | null = null;

/**
 * One tab per browser holds this device's connection (two would acknowledge the same deliveries twice). Resolves true
 * while this tab holds it; [onLost] runs if another tab takes over with "Use here". Idempotent within a tab: asking again
 * returns the same answer, and [steal] only takes the lock from another tab, never from this one.
 */
export function holdDeviceLock(steal: boolean, onLost: () => void): Promise<boolean> {
  if (!("locks" in navigator)) return Promise.resolve(true);
  if (held && !steal) return held;
  if (held && steal) {
    const current = held;
    return current.then((mine) => (mine ? true : request(true, onLost)));
  }
  return request(steal, onLost);
}

/** A page being reloaded can still hold the lock for a moment: ask again a few times before deciding it's another tab. */
const LOCK_ATTEMPTS = 6;
const LOCK_RETRY_MS = 250;

function request(steal: boolean, onLost: () => void): Promise<boolean> {
  held = (async () => {
    for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt++) {
      if (await tryLock(steal, onLost)) return true;
      if (steal) return false;
      await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
    }
    return false;
  })();
  return held;
}

function tryLock(steal: boolean, onLost: () => void): Promise<boolean> {
  return new Promise((resolve) => {
    navigator.locks
      .request(LOCK, steal ? { steal: true } : { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(false);
          return undefined;
        }
        resolve(true);
        return new Promise<void>(() => undefined); // held until the tab closes or another takes it
      })
      .catch(() => {
        held = null;
        onLost();
      });
  });
}
