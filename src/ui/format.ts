import type { Conversation } from "../api/schemas";
import type { UserLite } from "../state/store";
import { getPrefs, type TimeFormat } from "../application/prefs";

const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long" });
const date = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const fullDate = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" });

/** The clock as chosen in Settings › Appearance › Time format (android TimeFmt): the language's own, 12- or 24-hour. */
export function hourCycle(choice: TimeFormat): { hourCycle?: "h12" | "h23" } {
  return choice === "12" ? { hourCycle: "h12" } : choice === "24" ? { hourCycle: "h23" } : {};
}

const formatters = new Map<TimeFormat, { time: Intl.DateTimeFormat; full: Intl.DateTimeFormat }>();
function timeFormatters(): { time: Intl.DateTimeFormat; full: Intl.DateTimeFormat } {
  const choice = getPrefs().timeFormat;
  let f = formatters.get(choice);
  if (!f) {
    const cycle = hourCycle(choice);
    f = {
      time: new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", ...cycle }),
      // dateStyle and timeStyle can't take an hour cycle: spelled out instead.
      full: new Intl.DateTimeFormat(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", ...cycle }),
    };
    formatters.set(choice, f);
  }
  return f;
}

export const clock = (t: number): string => timeFormatters().time.format(t);
export const fullTime = (t: number): string => timeFormatters().full.format(t);

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "Today", "Yesterday", a weekday this week, or the date. */
export function dayLabel(t: number, now = Date.now()): string {
  const days = Math.round((startOfDay(now) - startOfDay(t)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7 && days > 1) return weekday.format(t);
  return new Date(t).getFullYear() === new Date(now).getFullYear() ? date.format(t) : fullDate.format(t);
}

export const sameDay = (a: number, b: number): boolean => startOfDay(a) === startOfDay(b);

/** A list timestamp: the time today, the day this week, the date before. */
export function shortWhen(t: number, now = Date.now()): string {
  if (!t) return "";
  const days = Math.round((startOfDay(now) - startOfDay(t)) / 86_400_000);
  if (days === 0) return clock(t);
  if (days < 7) return days === 1 ? "Yesterday" : weekday.format(t).slice(0, 3);
  return date.format(t);
}

export function relative(t: number, now = Date.now()): string {
  const s = Math.round((now - t) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return dayLabel(t, now);
}

/** When something ends: "in 20 min", "in 5 h", "in 3 days", or the date. */
export function untilWhen(t: number, now = Date.now()): string {
  const s = (t - now) / 1000;
  if (s <= 0) return "now";
  if (s < 3600) return `in ${Math.ceil(s / 60)} min`;
  if (s < 86_400) return `in ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86_400);
  return d < 14 ? `in ${d} ${d === 1 ? "day" : "days"}` : `on ${date.format(t)}`;
}

/** "1 member", "3 members". */
export function members(n: number): string {
  return `${n} ${n === 1 ? "member" : "members"}`;
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** The other person in a DM, from its member list. */
export function dmPeer(c: Conversation, me: string): { id: string; displayName: string; username: string; avatarColor: number } | null {
  return c.members?.find((m) => m.id !== me) ?? null;
}

export function conversationTitle(c: Conversation, me: string, users: Record<string, UserLite>): string {
  if (c.type === "CHANNEL") return c.name ?? "channel";
  if (c.type === "GROUP") return c.name ?? "Group";
  const peer = dmPeer(c, me);
  return (peer && (users[peer.id]?.displayName ?? peer.displayName)) || "Direct message";
}
