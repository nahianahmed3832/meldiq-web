import { z } from "zod";

/**
 * Reminders kept and fired by the server (server docs/REMINDERS.md; android data/model/Reminders.kt `ReminderRules`).
 * Pure rules, unit-tested in test/reminder-rules.test.ts.
 */
export const RECURRENCES = ["daily", "weekdays", "weekly", "monthly"] as const;
export type Recurrence = (typeof RECURRENCES)[number];
export type ReminderState = "scheduled" | "fired" | "done" | "dismissed";

export const TITLE_MAX = 200;
export const NOTE_MAX = 1000;
/** The sealed title of a saved message's reminder; the notification shows the message itself. */
export const TITLE_SAVED = "Saved message";
/** Reminders that went off longer ago than this aren't shown as new notifications (they're in Overdue). */
export const CATCH_UP_MS = 24 * 60 * 60_000;
/** A saved item due less than this long ago is still bridged (it may be firing right now). */
export const BRIDGE_GRACE_MS = 60_000;

const MINUTE = 60_000;
const EVENING_HOUR = 18;
const MORNING_HOUR = 9;

/** What a reminder says, sealed before it leaves the device (android ReminderContent). */
export const zReminderContent = z.object({
  v: z.number().default(1),
  title: z.string(),
  note: z.string().nullable().optional(),
  ref: z.object({ kind: z.string(), conversationId: z.string().nullable().optional(), messageId: z.string().nullable().optional() }).nullable().optional(),
  source: z.string().default("personal"),
});
export type ReminderContent = z.infer<typeof zReminderContent>;

export const zReminderDto = z.object({
  id: z.string(),
  sealed: z.string(),
  dueAt: z.number(),
  timeZone: z.string(),
  repeat: z.object({ recurrence: z.string(), localTime: z.string(), anchorDate: z.string() }).nullable().optional(),
  state: z.string(),
  firedAt: z.number().nullable().optional(),
  delivery: z.string().nullable().optional(),
  rev: z.number(),
  completedAt: z.number().nullable().optional(),
});
export type ReminderDto = z.infer<typeof zReminderDto>;

/** A reminder as the app shows it: its decrypted content (null when this browser can't read it) and the schedule. */
export interface Reminder {
  id: string;
  content: ReminderContent | null;
  dueAt: number;
  timeZone: string;
  recurrence: Recurrence | null;
  state: ReminderState;
  firedAt: number | null;
  deliveryFailed: boolean;
  rev: number;
  completedAt: number | null;
}

export const stateOf = (wire: string): ReminderState => (["fired", "done", "dismissed"].includes(wire) ? (wire as ReminderState) : "scheduled");
export const recurrenceOf = (wire: string | null | undefined): Recurrence | null => ((RECURRENCES as readonly string[]).includes(wire ?? "") ? (wire as Recurrence) : null);

/** Upcoming (soonest first), overdue (went off, not dealt with; latest first), done (latest first). */
export function groupReminders(all: readonly Reminder[]): { upcoming: Reminder[]; overdue: Reminder[]; done: Reminder[] } {
  return {
    upcoming: all.filter((r) => r.state === "scheduled").sort((a, b) => a.dueAt - b.dueAt),
    overdue: all.filter((r) => r.state === "fired").sort((a, b) => (b.firedAt ?? b.dueAt) - (a.firedAt ?? a.dueAt)),
    done: all.filter((r) => r.state === "done" || r.state === "dismissed").sort((a, b) => (b.completedAt ?? b.dueAt) - (a.completedAt ?? a.dueAt)),
  };
}

export type Snooze = "10m" | "1h" | "evening" | "tomorrow";

/** 10 minutes, 1 hour, this evening (18:00, if still ahead, else tomorrow's), tomorrow 09:00: in this browser's zone. */
export function snoozeUntil(choice: Snooze, now: number): number {
  const at = (days: number, hour: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  };
  switch (choice) {
    case "10m":
      return now + 10 * MINUTE;
    case "1h":
      return now + 60 * MINUTE;
    case "evening":
      return at(0, EVENING_HOUR) > now ? at(0, EVENING_HOUR) : at(1, EVENING_HOUR);
    case "tomorrow":
      return at(1, MORNING_HOUR);
  }
}

/** The first time a new reminder can be set for: the next quarter hour at least 5 minutes ahead. */
export function defaultTime(now: number): number {
  const d = new Date(now + 5 * MINUTE);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + ((15 - (d.getMinutes() % 15)) % 15));
  return d.getTime();
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The local wall-clock time and first date a repeating reminder is sent with ("HH:MM", "YYYY-MM-DD"), in this browser's zone. */
export function repeatRule(dueAt: number): { localTime: string; anchorDate: string } {
  const d = new Date(dueAt);
  return { localTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`, anchorDate: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` };
}

export function browserZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** The id of a saved message's reminder: the same on every device of the person ("later_" + 16 bytes of SHA-256). */
export async function laterId(messageId: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`later|${messageId}`)));
  return `later_${[...digest.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function newReminderId(): string {
  return `rem_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function validTitle(title: string): boolean {
  return title.trim().length > 0 && title.length <= TITLE_MAX;
}
