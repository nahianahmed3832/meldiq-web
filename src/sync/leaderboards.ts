import { z } from "zod";
import type { Engine } from "./engine";
export const LEADERBOARD_METRICS = ["level", "messages", "voice", "embers", "gifts", "invites"] as const;
export type LeaderboardMetric = (typeof LEADERBOARD_METRICS)[number];
const zPerson = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  avatarColor: z.number().int(),
  photoRev: z.number().nullable(),
  avatarMedia: z.object({ kind: z.enum(["gif", "webp", "video"]), rev: z.number() }).nullable(),
  decoration: z.string().nullable(),
});
const zEntry = z.object({ rank: z.number().int().positive(), user: zPerson, value: z.number().int().positive() });
export const zLeaderboard = z.object({
  metric: z.enum(LEADERBOARD_METRICS),
  period: z.enum(["week", "all"]),
  scope: z.enum(["visible_communities", "meldiq"]),
  generatedAt: z.number(),
  total: z.number().int().nonnegative(),
  entries: z.array(zEntry).max(100),
  me: zEntry.nullable(),
});
export type LeaderboardEntry = z.infer<typeof zEntry>;
export type Leaderboard = z.infer<typeof zLeaderboard>;
export function loadLeaderboard(engine: Engine, metric: LeaderboardMetric) {
  return engine.api.json("GET", `/v2/leaderboards?metric=${metric}`, zLeaderboard);
}
