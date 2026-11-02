import { z } from "zod";
import type { Engine } from "./engine";

/**
 * Official bots with something of their own besides settings (community parity D part 2; docs/COMMUNITY_PARITY_API.md
 * › Official bots): the YouTube channels Alerts follows, and a member's Wordy game of the day, played privately so the
 * guesses aren't shown to the channel.
 */

const enc = encodeURIComponent;
const nullableString = z
  .string()
  .nullish()
  .transform((v) => v ?? null);

// ───────────── Alerts ─────────────

const zAlertWatch = z.object({
  id: z.string(),
  /** What was pasted: a channel link or @handle. */
  source: z.string(),
  youtubeChannelId: z.string(),
  /** The YouTube channel's name ({creator}). */
  creator: z.string(),
  /** Where new uploads are posted. */
  channelId: z.string(),
  roleId: nullableString,
  /** The community's own line; null: Meldiq's. */
  message: nullableString,
  checkedAt: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  createdAt: z.number(),
  /** false: beyond the free 3 while the community has no Bots+ (kept, not checked). */
  active: z.boolean(),
});
export type AlertWatch = z.infer<typeof zAlertWatch>;

const zAlertWatches = z.object({ watches: z.array(zAlertWatch), limit: z.number().int(), defaultMessage: z.string() });
export type AlertWatches = z.infer<typeof zAlertWatches>;
const zWatchOne = z.object({ watch: zAlertWatch });

const watches = (orgId: string) => `/v1/orgs/${enc(orgId)}/official-bots/alerts/watches`;

export function alertWatches(engine: Engine, orgId: string): Promise<AlertWatches> {
  return engine.api.json("GET", watches(orgId), zAlertWatches);
}

export interface AlertWatchInput {
  /** A YouTube channel link (youtube.com/@handle, /channel/UC…, /user/name) or an @handle. */
  source: string;
  channelId: string;
  roleId?: string | null;
  message?: string | null;
}

export async function addAlertWatch(engine: Engine, orgId: string, input: AlertWatchInput): Promise<AlertWatch> {
  return (await engine.api.json("POST", watches(orgId), zWatchOne, { body: input })).watch;
}

export async function changeAlertWatch(engine: Engine, orgId: string, watchId: string, change: Partial<Omit<AlertWatchInput, "source">>): Promise<AlertWatch> {
  return (await engine.api.json("PATCH", `${watches(orgId)}/${enc(watchId)}`, zWatchOne, { body: change })).watch;
}

export async function removeAlertWatch(engine: Engine, orgId: string, watchId: string): Promise<void> {
  await engine.api.call("DELETE", `${watches(orgId)}/${enc(watchId)}`);
}

// ───────────── Wordy ─────────────

const zWordyGame = z.object({
  /** The UTC day, "YYYY-MM-DD", and the puzzle's number. */
  day: z.string(),
  number: z.number().int(),
  /** Only the player sees their own guesses; marks are five of 🟩 🟨 ⬛. */
  rows: z.array(z.object({ guess: z.string(), marks: z.string() })),
  maxTries: z.number().int(),
  finished: z.boolean(),
  solved: z.boolean(),
  /** Where it's played and the recap goes (null: none picked yet). */
  channelId: nullableString,
  stats: z.object({
    played: z.number().int(),
    won: z.number().int(),
    streak: z.number().int(),
    bestStreak: z.number().int(),
    /** Wins in 1, 2 … 6 tries. */
    distribution: z.array(z.number().int()),
  }),
});
export type WordyGame = z.infer<typeof zWordyGame>;

const game = (orgId: string) => `/v1/orgs/${enc(orgId)}/official-bots/wordy/game`;

/** Today's game for the viewer (empty until the first guess). */
export function wordyGame(engine: Engine, orgId: string): Promise<WordyGame> {
  return engine.api.json("GET", game(orgId), zWordyGame);
}

/** A guess: a word that isn't five letters or isn't in the list doesn't use a try (400 wordy_not_a_word). */
export function wordyGuess(engine: Engine, orgId: string, guess: string): Promise<WordyGame> {
  return engine.api.json("POST", game(orgId), zWordyGame, { body: { guess } });
}
