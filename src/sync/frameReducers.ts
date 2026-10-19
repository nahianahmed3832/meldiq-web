import type { Call } from "../api/schemas";
import type { AppState } from "../state/store";

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

export function presenceFrame(s: AppState, userId: string, online: boolean): AppState {
  return s.users[userId] ? { ...s, users: { ...s.users, [userId]: { ...s.users[userId], online } } } : s;
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
