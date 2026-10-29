import type { PointsHistoryRow, Quest } from "../../sync/points";

/**
 * What the points page calls things (API 0.65.0). The server sends quest ids and ledger kinds; the words are Meldiq's
 * own. The base amounts below are the server's rules (docs/SETTINGS_PARITY_API.md), shown before Mojo Plus's 1.5×.
 */

export const EARN = { visit: 5, streak: 30, streakDays: 7, chatPoints: 5, chatMinutes: 5, invite: 100, inviteDays: 7 } as const;

/** Each quest's task: with its goal on the quest list, and as a short name in the history. */
const QUESTS: Record<string, { task: (goal: number) => string; name: string }> = {
  "daily-chats": { task: (n) => `Talk in ${n} different chats`, name: "Talk in different chats" },
  "daily-reactions": { task: (n) => `React to ${n} messages from other people`, name: "React to messages" },
  "daily-reply": { task: () => "Reply to someone else's message", name: "Reply to someone" },
  profile: { task: () => "Add a profile picture and an About me", name: "Profile picture and About me" },
  friend: { task: () => "Make a friend", name: "Make a friend" },
  communities: { task: (n) => `Join ${n} communities`, name: "Join communities" },
  decoration: { task: () => "Wear an avatar decoration", name: "Wear a decoration" },
  "two-step": { task: () => "Turn on two-step sign-in", name: "Two-step sign-in" },
};

/** An id this version doesn't know, read as words ("new-quest" → "New quest"). */
const fromId = (id: string): string => id.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** A quest's task in a few words. */
export function questLabel(q: Pick<Quest, "id" | "goal">): string {
  return QUESTS[q.id]?.task(q.goal) ?? fromId(q.id);
}

/** A history row's line: what earned or spent it. */
export function historyLabel(row: Pick<PointsHistoryRow, "kind" | "detail">): string {
  switch (row.kind) {
    case "visit":
      return "Daily visit";
    case "streak":
      return "7-day streak";
    case "chat":
      return "Chatting";
    case "invite":
      return "Someone you invited stayed";
    case "quest":
      return row.detail ? `Quest: ${QUESTS[row.detail]?.name ?? fromId(row.detail)}` : "Quest";
    case "level":
      return row.detail ? `Reached level ${row.detail}` : "Level up";
    default:
      return "Points";
  }
}

/** "+5", "−100": the sign always shown. */
export const signed = (n: number): string => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);

/** How far towards the next level, 0–1. */
export const levelProgress = (balance: number, cost: number): number => (cost > 0 ? Math.min(1, Math.max(0, balance / cost)) : 0);

/** The days of the current 7-day run already visited (0–7; a full week shows full until the next day starts a new one). */
export function streakInWeek(streak: number): number {
  if (streak <= 0) return 0;
  const r = streak % EARN.streakDays;
  return r === 0 ? EARN.streakDays : r;
}
