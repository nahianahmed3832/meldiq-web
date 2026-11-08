import { text as uiText } from "../i18n";
import { apiBase, wsUrl } from "./config";
import { DEV } from "./env";
import { liveKitMedia } from "../call/media";
import { Ringtone } from "../call/ringtone";
import { LocalStore } from "../store/db";
import { Engine } from "../sync/engine";
import type { SessionGrant } from "../api/schemas";
import type { DeviceRecord } from "../model/types";
import { getPrefs } from "./prefs";
import { refreshPush, startServiceWorker, systemNotify } from "./webPush";
import { armChimeOnInteraction, chimeState, playChime } from "./messageChime";
import { transfersOf } from "../sync/transfers";
import { conversationPath, numericConversationPath } from "./conversationPaths";
/**
 * What this browser needs: a secure context, WebCrypto with Ed25519 and X25519 (natively, or the fallback that main.tsx
 * installs for Safari before 17), IndexedDB and WebSockets. Colours no longer need light-dark(): older browsers get the
 * same palettes through a generated fallback (vite.config.ts, docs/MELDIQ_WEB_BROWSERS.md).
 */
export async function missingCapabilities(): Promise<string[]> {
  const missing: string[] = [];
  if (!window.isSecureContext) missing.push(uiText("workspace.interface.a_secure_connection_https_2dd44a3"));
  if (!window.crypto?.subtle) missing.push(uiText("workspace.interface.the_web_crypto_api_c38bd5f"));
  if (typeof indexedDB === "undefined") missing.push(uiText("workspace.interface.indexeddb_storage_bf96b80"));
  if (typeof WebSocket === "undefined") missing.push("WebSockets");
  if (missing.length) return missing;
  try {
    await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
  } catch {
    missing.push(uiText("workspace.interface.ed25519_signatures_in_web_crypto_6155b5b"));
  }
  try {
    await crypto.subtle.generateKey({ name: "X25519" }, false, ["deriveBits"]);
  } catch {
    missing.push(uiText("workspace.interface.x25519_key_agreement_in_web_crypto_6d7e957"));
  }
  return missing;
}
const allowed = (): boolean => getPrefs().notifications && typeof Notification !== "undefined" && Notification.permission === "granted";
const lookedAt = (): boolean => document.visibilityState === "visible" && document.hasFocus();
/**
 * A message the notification pipeline let through (engine.notifyIncoming): a system notification while this tab isn't
 * looked at (src/application/webPush.ts shows it), and otherwise the in-app chime. Never both: a system notification
 * with sound already makes one.
 */
function notify(title: string, body: string, conversationId: string, database: string, href: string | null): void {
  const p = getPrefs();
  const system = allowed() && !lookedAt();
  // Meldiq's own chime when it can play (the browser's notification is then silent, so there's one sound, and one
  // that doesn't depend on the system's notification sound settings); the system's sound otherwise.
  const chime = p.inAppSound && p.soundVolume > 0 && chimeState() === "ready";
  if (system)
    systemNotify({
      database,
      title: p.notificationText ? title : "Meldiq",
      body: p.notificationText ? body : uiText("workspace.side_new_message"),
      tag: conversationId,
      href,
      silent: chime || !p.messageSound,
    });
  if (!p.inAppSound) return;
  void playChime(p.soundVolume).then((played) => {
    if (!played && !soundHinted && lookedAt()) {
      soundHinted = true;
      onSoundBlocked?.();
    }
  });
}
/** Once per page: sound couldn't play (no click in this tab yet), said once rather than at every message. */
let soundHinted = false;
let onSoundBlocked: (() => void) | null = null;
/** The app shows its notice with this (set at start). */
export function onChimeBlocked(fn: () => void): void {
  onSoundBlocked = fn;
}
/** A reminder that went off (Later): a system notification (when allowed) that opens Later or the saved message. */
function notifyReminder(title: string, body: string, database: string, href: string | null): void {
  if (!allowed()) return;
  const p = getPrefs();
  // Reminders are private by default: with message text hidden, the notification doesn't say what it's about.
  systemNotify({
    database,
    title: p.notificationText ? title : uiText("workspace.interface.meldiq_reminder_08cb2c9"),
    body: p.notificationText ? body : uiText("workspace.interface.you_have_a_reminder_ac22261"),
    tag: `reminder:${title}`,
    href: href ?? "/later",
  });
}
/** A scheduled meeting starting in ten minutes (round 7): opens its voice room. */
function notifyMeeting(title: string, body: string, database: string, href: string | null): void {
  if (!allowed()) return;
  const p = getPrefs();
  systemNotify({
    database,
    title: p.notificationText ? title : uiText("workspace.interface.meldiq_meeting_930f345"),
    body: p.notificationText ? body : uiText("workspace.interface.a_meeting_starts_soon_834f70f"),
    tag: `meeting:${title}`,
    href,
    silent: !p.messageSound,
  });
}
/** A ringing call while this tab isn't looked at: a system notification that brings the tab forward to its conversation. */
function ringAlert(title: string, video: boolean, conversationId: string, database: string, href: string | null): void {
  if (!allowed() || lookedAt()) return;
  const p = getPrefs();
  systemNotify({
    database,
    title: p.notificationText ? title : "Meldiq",
    body: video ? uiText("calls.incomingVideo") : uiText("calls.incomingVoice"),
    tag: `call-${conversationId}`,
    href,
    requireInteraction: true,
  });
}
export function createEngine(device: DeviceRecord, store: LocalStore): Engine {
  // Sound is prepared on the person's first click or key press here, as browsers require; never at load.
  armChimeOnInteraction();
  const destination = (id: string | null): string | null => {
    if (!id) return null;
    const conversation = engine.state.get().conversations[id];
    return conversation ? conversationPath(conversation) : numericConversationPath("home", id);
  };
  const engine = new Engine(device, store, {
    base: apiBase(),
    wsUrl: wsUrl(),
    notify: (title, body, id) => notify(title, body, id, store.name, destination(id)),
    notifyReminder: (title, body, id) => notifyReminder(title, body, store.name, destination(id)),
    notifyMeeting: (title, body, id) => notifyMeeting(title, body, store.name, destination(id)),
    media: liveKitMedia,
    ringtone: new Ringtone(() => getPrefs().callRingtone),
    callPrefs: () => {
      const p = getPrefs();
      return {
        noiseReduction: p.noiseReduction,
        shareQuality: p.shareQuality,
        shareAudio: p.shareAudio,
        echoCancellation: p.echoCancellation,
        autoGain: p.autoGain,
        microphoneId: p.microphoneId,
        speakerId: p.speakerId,
        outputVolume: p.outputVolume,
        joinMuted: p.joinMuted,
        joinDeafened: p.joinDeafened,
        pushToTalk: p.pushToTalk && !!p.pttKey,
      };
    },
    ringAlert: (title, video, id) => ringAlert(title, video, id, store.name, destination(id)),
    prefs: () => {
      const p = getPrefs();
      return { readReceipts: p.readReceipts, typing: p.typing, groupNotifications: p.groupNotifications };
    },
  });
  // Development builds only (removed from production bundles): lets the browser tests and a developer inspect state.
  if (DEV)
    (
      window as unknown as {
        __orbit?: Engine;
      }
    ).__orbit = engine;
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
  onChimeBlocked(() => engine.notice("info", uiText("workspace.interface.message_sounds_start_after_you_click_anywhere_in_meldiq_a_browser_d21537d")));
  // Files whose sending a reload interrupted come back in their conversations, ready to resume.
  void transfersOf(engine).load();
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
