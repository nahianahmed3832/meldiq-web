import { apiBase, wsUrl } from "./config";
import { liveKitMedia } from "../call/media";
import { Ringtone } from "../call/ringtone";
import { LocalStore } from "../store/db";
import { Engine } from "../sync/engine";
import type { SessionGrant } from "../api/schemas";
import type { DeviceRecord } from "../model/types";
import { getPrefs } from "./prefs";

/** What this browser needs: a secure context, WebCrypto with Ed25519 and X25519, IndexedDB and WebSockets. */
export async function missingCapabilities(): Promise<string[]> {
  const missing: string[] = [];
  if (!window.isSecureContext) missing.push("a secure connection (HTTPS)");
  if (!window.crypto?.subtle) missing.push("the Web Crypto API");
  if (typeof indexedDB === "undefined") missing.push("IndexedDB storage");
  if (typeof WebSocket === "undefined") missing.push("WebSockets");
  if (!CSS.supports("color", "light-dark(#000, #fff)")) missing.push("light and dark colours in CSS (light-dark())");
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

/** System notifications for messages that arrive while this tab isn't looked at. */
function notify(title: string, body: string, conversationId: string): void {
  const p = getPrefs();
  if (!p.notifications || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (document.visibilityState === "visible" && document.hasFocus()) return;
  try {
    const n = new Notification(p.notificationText ? title : "Meldiq", { body: p.notificationText ? body : "New message", tag: conversationId, silent: !p.messageSound });
    n.onclick = () => {
      window.focus();
      location.hash = `#/home/c/${encodeURIComponent(conversationId)}`;
      n.close();
    };
  } catch {
    /* notifications unavailable in this context */
  }
}

/** A reminder that went off (Later): a system notification (when allowed) that opens Later or the saved message. */
function notifyReminder(title: string, body: string, conversationId: string | null): void {
  const p = getPrefs();
  if (!p.notifications || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    // Reminders are private by default: with message text hidden, the notification doesn't say what it's about.
    const n = new Notification(p.notificationText ? title : "Meldiq reminder", { body: p.notificationText ? body : "You have a reminder", tag: `reminder:${title}` });
    n.onclick = () => {
      window.focus();
      location.hash = conversationId ? `#/home/c/${encodeURIComponent(conversationId)}` : "#/later";
      n.close();
    };
  } catch {
    /* notifications unavailable in this context */
  }
}

/** A scheduled meeting starting in ten minutes (round 7): opens its voice room. */
function notifyMeeting(title: string, body: string, roomId: string | null): void {
  const p = getPrefs();
  if (!p.notifications || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const n = new Notification(p.notificationText ? title : "Meldiq meeting", { body: p.notificationText ? body : "A meeting starts soon", tag: `meeting:${title}`, silent: !p.messageSound });
    n.onclick = () => {
      window.focus();
      if (roomId) location.hash = `#/home/c/${encodeURIComponent(roomId)}`;
      n.close();
    };
  } catch {
    /* notifications unavailable in this context */
  }
}

/** A customer inbox notice (round 8): never the customer's name or text, which the event doesn't carry. */
function notifyInbox(text: string, conversationId: string | null): void {
  const p = getPrefs();
  if (!p.notifications || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const n = new Notification("Customer inbox", { body: text, tag: `inbox:${text}:${conversationId ?? ""}`, silent: !p.messageSound });
    n.onclick = () => {
      window.focus();
      location.hash = conversationId ? `#/workspace/inbox/${encodeURIComponent(conversationId)}` : "#/workspace/inbox";
      n.close();
    };
  } catch {
    /* notifications unavailable in this context */
  }
}

/** A ringing call while this tab isn't looked at: a system notification that brings the tab forward. */
function ringAlert(title: string, video: boolean, conversationId: string): void {
  const p = getPrefs();
  if (!p.notifications || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (document.visibilityState === "visible" && document.hasFocus()) return;
  try {
    const n = new Notification(p.notificationText ? title : "Meldiq", { body: video ? "Incoming video call" : "Incoming voice call", tag: `call-${conversationId}`, requireInteraction: true });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* notifications unavailable in this context */
  }
}

export function createEngine(device: DeviceRecord, store: LocalStore): Engine {
  const engine = new Engine(device, store, {
    base: apiBase(),
    wsUrl: wsUrl(),
    notify,
    notifyReminder,
    notifyMeeting,
    notifyInbox,
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
  return engine;
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
