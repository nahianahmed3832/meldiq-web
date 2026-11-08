import { z } from "zod";
import { openEnum } from "../api/enums";
import type { Engine } from "./engine";

/**
 * Points, quests and account levels (API 0.65.0, server docs/SETTINGS_PARITY_API.md): earned for a daily visit,
 * chatting, a 7-day streak, invites that stay and quests. The server applies rewards and level thresholds;
 * the client displays the result and checks in once a UTC day.
 */

const zQuest = z.object({
  id: z.string(),
  kind: openEnum(["daily", "once"]),
  reward: z.number().int(),
  progress: z.number().int(),
  goal: z.number().int().positive(),
  state: openEnum(["open", "claimed"]),
});
export type Quest = z.infer<typeof zQuest>;

const zHistoryRow = z.object({
  kind: openEnum(["visit", "streak", "chat", "invite", "quest", "level"]),
  amount: z.number().int(),
  detail: z.string().nullable(),
  at: z.number(),
});
export type PointsHistoryRow = z.infer<typeof zHistoryRow>;

const zAchievement = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  tier: z.enum(["bronze", "silver", "gold", "mythic"]),
  icon: z.string(),
  goal: z.number().positive(),
  progress: z.number().nonnegative(),
  earnedAt: z.number().nullable(),
});
export type Achievement = z.infer<typeof zAchievement>;

export const zPoints = z.object({
  balance: z.number().int(),
  earnedToday: z.number().int(),
  earnedTotal: z.number().int(),
  level: z.number().int().min(1),
  nextLevelCost: z.number().int().positive(),
  multiplier: z.number().positive(),
  streak: z.number().int(),
  chatMinutesToday: z.number().int(),
  chatPointsToday: z.number().int(),
  chatDailyCap: z.number().int(),
  earning: z.boolean(),
  day: z.string(),
  resetsAt: z.number(),
  quests: z.array(zQuest),
  invites: z.object({ pending: z.number().int(), credited: z.number().int(), creditedThisMonth: z.number().int(), monthlyLimit: z.number().int() }),
  history: z.array(zHistoryRow),
  achievements: z.array(zAchievement).default([]),
});
export type Points = z.infer<typeof zPoints>;

export function points(engine: Engine): Promise<Points> {
  return engine.api.json("GET", "/v2/points", zPoints);
}

/** Today's visit (5 points once a UTC day): the app calls it once when a signed-in session opens. */
export async function pointsCheckin(engine: Engine): Promise<Points> {
  return (await engine.api.json("POST", "/v2/points/checkin", z.object({ counted: z.boolean(), points: zPoints }))).points;
}
