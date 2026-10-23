import type { Conversation } from "../api/schemas";
import type { UserLite } from "../state/store";
import { getPrefs, type TimeFormat } from "../application/prefs";
import { resolveLanguage, type StringKey, translate } from "../i18n";

/** Dates in the interface's language (English keeps the browser's own English, e.g. day-month or month-day order). */
function locale(): string | undefined {
  const lang = resolveLanguage(getPrefs().language);
  if (lang !== "en") return lang;
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("en") ? undefined : "en";
}
const t = (key: StringKey, vars?: Record<string, string | number>) => translate(resolveLanguage(getPrefs().language), key, vars);

/** The clock as chosen in Settings › Appearance › Time format (android TimeFmt): the language's own, 12- or 24-hour. */
export function hourCycle(choice: TimeFormat): { hourCycle?: "h12" | "h23" } {
  return choice === "12" ? { hourCycle: "h12" } : choice === "24" ? { hourCycle: "h23" } : {};
}

interface Formatters {
  time: Intl.DateTimeFormat;
  full: Intl.DateTimeFormat;
  weekday: Intl.DateTimeFormat;
  weekdayShort: Intl.DateTimeFormat;
  date: Intl.DateTimeFormat;
  fullDate: Intl.DateTimeFormat;
}
const formatters = new Map<string, Formatters>();
function fmt(): Formatters {
  const choice = getPrefs().timeFormat;
  const loc = locale();
  const key = `${loc ?? ""}|${choice}`;
  let f = formatters.get(key);
  if (!f) {
    const cycle = hourCycle(choice);
    f = {
      time: new Intl.DateTimeFormat(loc, { hour: "numeric", minute: "2-digit", ...cycle }),
      // dateStyle and timeStyle can't take an hour cycle: spelled out instead.
      full: new Intl.DateTimeFormat(loc, { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", ...cycle }),
      weekday: new Intl.DateTimeFormat(loc, { weekday: "long" }),
      weekdayShort: new Intl.DateTimeFormat(loc, { weekday: "short" }),
      date: new Intl.DateTimeFormat(loc, { month: "short", day: "numeric" }),
      fullDate: new Intl.DateTimeFormat(loc, { year: "numeric", month: "long", day: "numeric" }),
    };
    formatters.set(key, f);
  }
  return f;
}

export const clock = (at: number): string => fmt().time.format(at);
export const fullTime = (at: number): string => fmt().full.format(at);

function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "Today", "Yesterday", a weekday this week, or the date. */
export function dayLabel(at: number, now = Date.now()): string {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / 86_400_000);
  if (days === 0) return t("time_today");
  if (days === 1) return t("time_yesterday");
  if (days < 7 && days > 1) return fmt().weekday.format(at);
  return new Date(at).getFullYear() === new Date(now).getFullYear() ? fmt().date.format(at) : fmt().fullDate.format(at);
}

export const sameDay = (a: number, b: number): boolean => startOfDay(a) === startOfDay(b);

/** A list timestamp: the time today, the day this week, the date before. */
export function shortWhen(at: number, now = Date.now()): string {
  if (!at) return "";
  const days = Math.round((startOfDay(now) - startOfDay(at)) / 86_400_000);
  if (days === 0) return clock(at);
  if (days < 7) return days === 1 ? t("time_yesterday") : fmt().weekdayShort.format(at);
  return fmt().date.format(at);
}

export function relative(at: number, now = Date.now()): string {
  const s = Math.round((now - at) / 1000);
  if (s < 45) return t("time_just_now");
  if (s < 3600) return t("time_min_ago", { n: Math.round(s / 60) });
  if (s < 86_400) return t("time_h_ago", { n: Math.round(s / 3600) });
  return dayLabel(at, now);
}

/** When something ends: "in 20 min", "in 5 h", "in 3 days", or the date. */
export function untilWhen(at: number, now = Date.now()): string {
  const s = (at - now) / 1000;
  if (s <= 0) return t("time_now");
  if (s < 3600) return t("time_in_min", { n: Math.ceil(s / 60) });
  if (s < 86_400) return t("time_in_h", { n: Math.round(s / 3600) });
  const d = Math.round(s / 86_400);
  return d < 14 ? t(d === 1 ? "time_in_day" : "time_in_days", { n: d }) : t("time_on", { date: fmt().date.format(at) });
}

/** "1 member", "3 members". */
export function members(n: number): string {
  return t(n === 1 ? "members_one" : "members_n", { n });
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
