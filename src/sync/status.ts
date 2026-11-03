import { text as uiText } from "../i18n";
import { z } from "zod";
import { zProfile } from "../api/schemas";
import type { Engine } from "./engine";
/**
 * Statuses and pausing notifications (round 3; the same rules as android StatusRules, tested in test/status.test.ts).
 * The server keeps the status, its end time and the pause for every device and applies the end time itself.
 */
export type ClearAfter = "never" | "30m" | "1h" | "4h" | "today" | "week";
export type Pause = "30m" | "1h" | "2h" | "tomorrow9";
export interface Preset {
  emoji: string;
  text: string;
  clearAfter: ClearAfter;
}
/** The reference's suggestions, with how long each lasts. */
export const PRESETS: readonly Preset[] = [
  {
    emoji: "📅",
    get text() {
      return uiText("workspace.interface.in_a_meeting_a1749a2");
    },
    clearAfter: "1h",
  },
  {
    emoji: "🚌",
    get text() {
      return uiText("workspace.interface.commuting_9c77737");
    },
    clearAfter: "30m",
  },
  {
    emoji: "🤒",
    get text() {
      return uiText("workspace.interface.out_sick_36a97ad");
    },
    clearAfter: "today",
  },
  {
    emoji: "🌴",
    get text() {
      return uiText("workspace.interface.vacationing_eb76920");
    },
    clearAfter: "never",
  },
  {
    emoji: "🏡",
    get text() {
      return uiText("workspace.interface.working_remotely_2611132");
    },
    clearAfter: "today",
  },
];
export const CLEAR_AFTER_LABEL: Record<ClearAfter, string> = {
  get never() {
    return uiText("workspace.interface.don_t_clear_782c181");
  },
  get "30m"() {
    return uiText("workspace.interface.30_minutes_f01a042");
  },
  get "1h"() {
    return uiText("workspace.interface.1_hour_f8b8883");
  },
  get "4h"() {
    return uiText("workspace.interface.4_hours_e5bc992");
  },
  get today() {
    return uiText("common.time_today");
  },
  get week() {
    return uiText("workspace.interface.this_week_8c4eef5");
  },
};
export const PAUSE_LABEL: Record<Pause, string> = {
  get "30m"() {
    return uiText("workspace.interface.30_minutes_f01a042");
  },
  get "1h"() {
    return uiText("workspace.interface.1_hour_f8b8883");
  },
  get "2h"() {
    return uiText("workspace.interface.2_hours_9808e0e");
  },
  get tomorrow9() {
    return uiText("workspace.interface.until_tomorrow_9_00_ddf27d0");
  },
};
export const STATUS_MAX_LENGTH = 140;
export const EMOJI_MAX_LENGTH = 16;
const MINUTE = 60000;
const HOUR = 60 * MINUTE;
/** Local midnight at the start of the day [days] after [now]'s day. */
function startOfDay(now: number, days: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.getTime();
}
/** When a status chosen at [now] ends (local time): null for "Don't clear"; "This week" ends at the next Monday. */
export function expiresAt(choice: ClearAfter, now: number): number | null {
  switch (choice) {
    case "never":
      return null;
    case "30m":
      return now + 30 * MINUTE;
    case "1h":
      return now + HOUR;
    case "4h":
      return now + 4 * HOUR;
    case "today":
      return startOfDay(now, 1);
    case "week": {
      const day = new Date(now).getDay(); // 0 Sunday … 6 Saturday
      return startOfDay(now, day === 0 ? 1 : 8 - day);
    }
  }
}
/** When notifications paused at [now] come back; "Until tomorrow, 9:00" is local time. */
export function pauseUntil(choice: Pause, now: number): number {
  switch (choice) {
    case "30m":
      return now + 30 * MINUTE;
    case "1h":
      return now + HOUR;
    case "2h":
      return now + 2 * HOUR;
    case "tomorrow9":
      return startOfDay(now, 1) + 9 * HOUR;
  }
}
export function active(expiresAtMs: number | null | undefined, now: number): boolean {
  return expiresAtMs == null || expiresAtMs > now;
}
export function paused(until: number | null | undefined, now: number): boolean {
  return until != null && until > now;
}
/** The one line for a person's status: emoji and text, or null when empty or ended. */
export function statusLine(
  s:
    | {
        statusText?: string | null;
        statusEmoji?: string | null;
        statusExpiresAt?: number | null;
      }
    | null
    | undefined,
  now: number,
): string | null {
  if (!s || !active(s.statusExpiresAt, now)) return null;
  return [s.statusEmoji, s.statusText].filter((x) => !!x).join(" ") || null;
}
const zMe = z.object({ user: zProfile });
/** Sets or clears your status (all null clears it). Nulls are sent, so the server clears what was there. */
export async function setStatus(engine: Engine, text: string | null, emoji: string | null, expires: number | null): Promise<void> {
  await engine.api.json("PATCH", "/v1/users/me", zMe, { body: { statusText: text, statusEmoji: emoji, statusExpiresAt: expires } });
  await engine.refreshAll();
}
/** Pauses notifications on every device until [until], or resumes them (null). */
export async function setNotificationsPaused(engine: Engine, until: number | null): Promise<void> {
  await engine.api.json("PATCH", "/v1/users/me", zMe, { body: { notificationsPausedUntil: until } });
  await engine.refreshAll();
}
