import { z } from "zod";
import { ApiError } from "../api/client";
import type { Engine } from "./engine";

/**
 * Official bots (community parity batch D, feature community-bots; docs/COMMUNITY_PARITY_API.md › Official bots):
 * Meldiq's own bots a community turns on from Settings › Bots. Each one on is a bot member of the community with the
 * community's own name and picture for it. Bots+ (granted per community) unlocks every bot's Plus extras. The server
 * checks every rule again; these calls carry what the screens chose.
 */
export const OFFICIAL_BOTS_FEATURE = "community-bots";

/** Every official bot, in the order the Bots page lists them. */
export const OFFICIAL_BOT_KEYS = ["welcomer", "helper", "levels", "logger", "starboard", "giveaways", "tickets", "alerts", "wordy"] as const;
export type OfficialBotKey = (typeof OFFICIAL_BOT_KEYS)[number];

const enc = encodeURIComponent;
const nullableString = z
  .string()
  .nullish()
  .transform((v) => v ?? null);
const nullableTime = z
  .number()
  .nullish()
  .transform((v) => v ?? null);

const zCatalogBot = z.object({
  key: z.string(),
  name: z.string(),
  tagline: z.string(),
  description: z.string(),
  /** The detail window's header colour, "#rrggbb". */
  color: z.string(),
  /** An emoji standing in for the bot's picture until the community picks one. */
  icon: z.string(),
  features: z.array(z.string()).default([]),
  /** What the bot says, for the window's preview. */
  sample: z.string().default(""),
  commands: z.array(z.object({ usage: z.string(), description: z.string() })).default([]),
  /** The Free vs Plus table. */
  limits: z.array(z.object({ what: z.string(), free: z.string(), plus: z.string() })).default([]),
  available: z.boolean(),
  /** Why it can't be turned on here (e.g. Alerts without a YouTube key), null when it can. */
  unavailableReason: nullableString,
});
export type CatalogBot = z.infer<typeof zCatalogBot>;

const zBotsPlus = z.object({ name: z.string(), description: z.string(), perks: z.array(z.string()).default([]) });
export type BotsPlusInfo = z.infer<typeof zBotsPlus>;

const zCatalog = z.object({ bots: z.array(zCatalogBot), botsPlus: zBotsPlus });
export type OfficialBotsCatalog = z.infer<typeof zCatalog>;

const zOfficialBot = z.object({
  key: z.string(),
  name: z.string(),
  available: z.boolean(),
  unavailableReason: nullableString,
  enabled: z.boolean(),
  /** The bot's account in this community (null before it was first turned on or given a look). */
  userId: nullableString,
  look: z.object({
    /** The community's own name for it (null: the bot's standard name). */
    name: nullableString,
    displayName: z.string(),
    /** Its picture: GET /v1/users/:userId/photo; null: the standard one (the catalog's emoji). */
    photoRev: nullableTime,
  }),
  /** Its settings, for people who can edit the community; null for everyone else and bots not available yet. */
  settings: z
    .record(z.string(), z.unknown())
    .nullish()
    .transform((v) => v ?? null),
  /** Plus settings stored but not applied because the community has no Bots+ (field names). */
  plusPaused: z.array(z.string()).default([]),
  updatedAt: nullableTime,
});
export type OfficialBot = z.infer<typeof zOfficialBot>;

const zCommunityBots = z.object({
  botsPlus: z.boolean(),
  /** When Bots+ ends (null: no end, or none). */
  botsPlusUntil: nullableTime,
  /** Edit community: may turn bots on and change them. */
  canEdit: z.boolean(),
  bots: z.array(zOfficialBot),
});
export type CommunityOfficialBots = z.infer<typeof zCommunityBots>;

const zBotOne = z.object({ bot: zOfficialBot });
const zWelcomeTest = z.object({ messageId: z.string(), channelId: z.string() });

/** The catalog: what each bot does, its commands and its Free vs Plus table, and Bots+'s perks. */
export function officialBotsCatalog(engine: Engine): Promise<OfficialBotsCatalog> {
  return engine.api.json("GET", "/v1/official-bots", zCatalog);
}

/** A community's official bots: on or off, their look here, settings (editors) and Bots+. */
export function communityOfficialBots(engine: Engine, orgId: string): Promise<CommunityOfficialBots> {
  return engine.api.json("GET", `/v1/orgs/${enc(orgId)}/official-bots`, zCommunityBots);
}

export interface OfficialBotChange {
  enabled?: boolean;
  /** Some or all of the bot's settings; the rest stay. */
  settings?: Record<string, unknown>;
  /** null: back to the bot's own name. */
  look?: { name: string | null };
}

/** Turns a bot on or off, changes its settings or its name here (people who can edit the community). */
export async function updateOfficialBot(engine: Engine, orgId: string, key: string, change: OfficialBotChange): Promise<OfficialBot> {
  return (await engine.api.json("PUT", `/v1/orgs/${enc(orgId)}/official-bots/${enc(key)}`, zBotOne, { body: change })).bot;
}

/** The bot's picture in this community: a square JPEG of at most 512 KB. */
export async function setOfficialBotAvatar(engine: Engine, orgId: string, key: string, jpeg: Uint8Array): Promise<OfficialBot> {
  return (await engine.api.json("PUT", `/v1/orgs/${enc(orgId)}/official-bots/${enc(key)}/avatar`, zBotOne, { raw: jpeg })).bot;
}

/** Back to the bot's standard picture. */
export async function removeOfficialBotAvatar(engine: Engine, orgId: string, key: string): Promise<OfficialBot> {
  return (await engine.api.json("DELETE", `/v1/orgs/${enc(orgId)}/official-bots/${enc(key)}/avatar`, zBotOne)).bot;
}

/** Welcomer greets the caller in its channel, as it would a newcomer. */
export function testWelcomer(engine: Engine, orgId: string): Promise<z.infer<typeof zWelcomeTest>> {
  return engine.api.json("POST", `/v1/orgs/${enc(orgId)}/official-bots/welcomer/test`, zWelcomeTest);
}

const detailOf = (e: ApiError): Record<string, unknown> => (e.details && typeof e.details === "object" ? (e.details as Record<string, unknown>) : {});

/** Whether the server refused because the bot can't run yet (it is listed for later). */
export function isUnavailable(e: unknown): boolean {
  return e instanceof ApiError && e.code === "official_bot_unavailable";
}

/** A refusal from the official bot routes, in words. */
export function officialBotError(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error && e.message ? e.message : "That didn't work. Try again.";
  const d = detailOf(e);
  switch (e.code) {
    case "bots_plus_required": {
      const fields = Array.isArray(d.settings) ? d.settings.join(", ") : null;
      return `That needs Bots+${fields ? ` (${fields})` : ""}. Take those changes out to save the rest.`;
    }
    case "bot_role_not_givable":
      return "One of the reward roles can't be given by a bot: pick a role without admin powers that you can give yourself.";
    case "official_bot_channel_invalid":
      return "One of the channels can't be used: pick a text channel of this community that you can see.";
    case "official_bot_off":
      return "Turn the bot on first.";
    case "official_bot_unavailable":
      return e.message || "This bot isn't ready yet.";
    case "alerts_unconfigured":
      return "Alerts needs a YouTube API key on this server, so it can't follow channels yet.";
    case "alerts_source_unknown":
      return "YouTube doesn't know that channel. Paste its link (youtube.com/@name) or its @handle.";
    case "conflict":
      return "That YouTube channel already posts in that channel.";
    case "wordy_not_a_word":
      return "That isn't in the word list. It didn't use a try.";
    case "wordy_finished":
      return "You've played today's word. A new one comes at 00:00 UTC.";
    case "limit_reached":
      return "This community is full, so the bot can't join it.";
    case "banned":
      return "This bot is banned here. Unban it from the member list first.";
    case "too_large":
      return "That picture is too big: 512 KB at most.";
    default:
      return e.message;
  }
}
