import type { Conversation, QueueItem } from "../api/schemas";
import { countsEveryone, levelOf, type NavPrefs, shouldNotify, workspaceOf } from "../sync/navPrefs";
import { paused } from "../sync/status";
import { conversationTitle } from "../ui/format";

/** A call rings for about this long; an older RINGING call is a leftover, not someone calling now. */
export const RING_WINDOW_MS = 60_000;
/** The caller's invite may be stored a moment before the call itself. */
const INVITE_SLACK_MS = 5_000;

/** This browser's notification choices, mirrored for the service worker (it can't read the page's storage). */
export interface WakePrefs {
  notifications: boolean;
  groupNotifications: boolean;
  notificationText: boolean;
}

export interface WakeInput {
  me: string;
  now: number;
  /** What the server is holding for this browser (read, not acknowledged: the app still fetches it when it opens). */
  items: readonly QueueItem[];
  conversations: Readonly<Record<string, Conversation>>;
  /** The synced notification settings, by workspace document (personal, or a community's id). */
  nav: Readonly<Record<string, NavPrefs | undefined>>;
  prefs: WakePrefs;
  /** Notifications paused from the profile menu until then. */
  pausedUntil: number | null;
}

export interface WakeNotice {
  /** One per conversation (a call has its own), so later wake-ups replace rather than pile up. */
  tag: string;
  title: string;
  body: string;
  /** Where a click opens the app, on this site only. */
  url: string;
  call: boolean;
}

const urlOf = (c: Conversation): string => `/#/${c.type === "CHANNEL" ? "home" : "dms"}/c/${encodeURIComponent(c.id)}`;
const titleOf = (c: Conversation, me: string): string => {
  const t = conversationTitle(c, me, {});
  return c.type === "CHANNEL" ? `#${t}` : t;
};

/**
 * What a background wake-up shows when no Meldiq tab is open (the service worker; docs/MELDIQ_WEB_PUSH.md). The server's
 * wake-up carries nothing, and messages are end-to-end encrypted, so this works only from what the server holds in the
 * clear: which conversations have new messages from others (not reactions, edits or receipts), and which call is ringing.
 * The same rules as the page's own notifications apply: levels, timed mutes, Ignore @everyone, paused notifications,
 * group notifications and message requests. A mention by name can't be seen here, so "mentions only" lets @everyone through
 * and waits for the app for the rest.
 */
export function wakeNotices(i: WakeInput): WakeNotice[] {
  if (!i.prefs.notifications) return [];
  const calls = incomingCalls(i);
  const ringing = new Set(calls.map((n) => n.tag.slice("call-".length)));
  const counts = new Map<string, number>();
  if (!paused(i.pausedUntil, i.now))
    for (const it of i.items) {
      if (it.kind !== "envelope" || it.senderUserId === i.me || (it.payload.cls ?? "message") !== "message") continue;
      const c = i.conversations[it.conversationId];
      if (!c || c.request?.incoming || ringing.has(c.id)) continue;
      const prefs = i.nav[workspaceOf(c.orgId)];
      const mention = it.payload.mentionAll && (!c.orgId || countsEveryone(prefs)) ? "all" : null;
      if (!shouldNotify(levelOf(prefs, c.id, c.categoryId, i.now), mention)) continue;
      if (c.type !== "DM" && !mention && !i.prefs.groupNotifications) continue;
      counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
    }
  const messages = [...counts].map(([id, n]): WakeNotice => {
    const c = i.conversations[id];
    return i.prefs.notificationText
      ? { tag: id, title: titleOf(c, i.me), body: n === 1 ? "New message" : `${n} new messages`, url: urlOf(c), call: false }
      : { tag: id, title: "Meldiq", body: "New message", url: urlOf(c), call: false };
  });
  return [...calls, ...messages];
}

/** Calls ringing for this person: a call still RINGING, started recently, whose invite came from someone else. */
function incomingCalls(i: WakeInput): WakeNotice[] {
  const out: WakeNotice[] = [];
  for (const c of Object.values(i.conversations)) {
    const call = c.activeCall;
    if (!call || c.voice || call.state !== "RINGING" || call.startedAt < i.now - RING_WINDOW_MS) continue;
    const invited = i.items.some(
      (it) => it.kind === "envelope" && it.conversationId === c.id && it.senderUserId !== i.me && it.payload.cls === "control" && it.createdAt >= call.startedAt - INVITE_SLACK_MS,
    );
    if (!invited) continue;
    out.push({ tag: `call-${c.id}`, title: i.prefs.notificationText ? titleOf(c, i.me) : "Meldiq", body: call.video ? "Incoming video call" : "Incoming voice call", url: urlOf(c), call: true });
  }
  return out;
}
