import type { Call } from "../api/schemas";
import type { AppState } from "../state/store";
import type { BotReply } from "./bots";

/**
 * How realtime frames that only change what's shown update the state (server hub.ts frames). Pure, so the engine's frame
 * handler stays a dispatcher and these are testable on their own.
 */
const TYPING_SHOWN_MS = 6000;

export function typingFrame(s: AppState, conversationId: string, userId: string, on: boolean, now = Date.now()): AppState {
  const cur = { ...(s.typing[conversationId] ?? {}) };
  if (on) cur[userId] = now + TYPING_SHOWN_MS;
  else delete cur[userId];
  return { ...s, typing: { ...s.typing, [conversationId]: cur } };
}

const SHOWN = ["online", "idle", "dnd", "offline"] as const;

/** Someone's presence changed: online or not, and (batch B6b) idle or do not disturb. */
export function presenceFrame(s: AppState, userId: string, online: boolean, presence: string | null = null): AppState {
  const shown = (SHOWN as readonly string[]).includes(presence ?? "") ? (presence as (typeof SHOWN)[number]) : online ? "online" : "offline";
  return s.users[userId] ? { ...s, users: { ...s.users, [userId]: { ...s.users[userId], online, presence: shown } } } : s;
}

/** A workspace was deleted: it and its conversations disappear. */
export function orgDeletedFrame(s: AppState, orgId: string): AppState {
  return { ...s, orgs: s.orgs.filter((o) => o.id !== orgId), conversations: Object.fromEntries(Object.entries(s.conversations).filter(([, c]) => c.orgId !== orgId)) };
}

/** A call's new state: ended calls leave the live list. */
export function callFrame(s: AppState, call: Call): AppState {
  const calls = { ...s.calls };
  if (call.state === "ENDED") delete calls[call.conversationId];
  else calls[call.conversationId] = call;
  return { ...s, calls };
}

/** At most this many bot answers are kept per conversation (oldest go first). */
const BOT_REPLIES_KEPT = 20;

/** A bot answered a command only for you (API 0.65.0 batch B): kept with its conversation, once per interaction. */
export function botReplyFrame(s: AppState, reply: BotReply): AppState {
  const cur = s.botReplies[reply.conversationId] ?? [];
  if (cur.some((r) => r.interactionId === reply.interactionId)) return s;
  return { ...s, botReplies: { ...s.botReplies, [reply.conversationId]: [...cur, reply].slice(-BOT_REPLIES_KEPT) } };
}

/** Dismissed from the conversation. */
export function dismissBotReply(s: AppState, conversationId: string, interactionId: string): AppState {
  const cur = s.botReplies[conversationId];
  if (!cur) return s;
  return { ...s, botReplies: { ...s.botReplies, [conversationId]: cur.filter((r) => r.interactionId !== interactionId) } };
}
