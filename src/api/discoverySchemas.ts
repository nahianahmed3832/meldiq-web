import { z } from "zod";
import { zDiscovered } from "./communitySchemas";
import { openEnum } from "./enums";

/**
 * Discovery answers (community parity batch E; server docs/COMMUNITY_PARITY_API.md › Discovery, contracts
 * discovery.ts, communityTemplates.ts, botDirectory.ts): Discover's cards, a community's Discovery settings, Promote,
 * templates made from a community, and the community bot directory. Validated at the boundary; unknown fields dropped.
 */

const nullableString = z
  .string()
  .nullish()
  .transform((v) => v ?? null);
const nullableNumber = z
  .number()
  .nullish()
  .transform((v) => v ?? null);

/** The boost tiers, smallest first. */
export const BOOST_TIERS = ["boost", "super", "mega"] as const;
export type BoostTier = (typeof BOOST_TIERS)[number];

/** A card on Discover: the older card plus tags, who's online, its label and whether Meldiq runs it. */
export const zDiscoverCard = zDiscovered.extend({
  tags: z.array(z.string()).default([]),
  onlineCount: z.number().int().default(0),
  label: openEnum(["promoted", ...BOOST_TIERS])
    .nullish()
    .transform((v) => v ?? null),
  official: z.boolean().default(false),
});
export type DiscoverCard = z.infer<typeof zDiscoverCard>;
export type CardLabel = DiscoverCard["label"];

export const zDiscoverListing = z.object({
  promoted: z.array(zDiscoverCard).default([]),
  communities: z.array(zDiscoverCard),
  nextCursor: nullableNumber,
});
export type DiscoverListing = z.infer<typeof zDiscoverListing>;

export const UNLISTED_REASONS = ["private", "turned_off", "too_few_members", "locked", "removed", "name_blocked"] as const;
export const zUnlistedReason = openEnum(UNLISTED_REASONS)
  .nullish()
  .transform((v) => v ?? null);
export type UnlistedReason = z.infer<typeof zUnlistedReason>;

export const zDiscoverySettings = z.object({
  discoverable: z.boolean(),
  description: nullableString,
  tags: z.array(z.string()).default([]),
  listed: z.boolean(),
  reason: zUnlistedReason,
  memberCount: z.number().int().default(0),
  minMembers: z.number().int().default(5),
  communityDescription: nullableString,
  official: z.boolean().default(false),
  updatedAt: nullableNumber,
});
export type DiscoverySettings = z.infer<typeof zDiscoverySettings>;

// ───────────── Promote ─────────────

const zRecordState = openEnum(["pending", "active", "cancelled"]);
const zRecordSource = openEnum(["grant", "purchase"]);

export const zBoostRecord = z.object({ id: z.string(), tier: openEnum(BOOST_TIERS), state: zRecordState, source: zRecordSource, startsAt: z.number(), endsAt: z.number() });
export type BoostRecord = z.infer<typeof zBoostRecord>;

export const zPromotedBooking = z.object({
  id: z.string(),
  state: zRecordState,
  source: zRecordSource,
  startsAt: z.number(),
  endsAt: z.number(),
  views: z.number().int().default(0),
  clicks: z.number().int().default(0),
  joins: z.number().int().default(0),
});
export type PromotedBooking = z.infer<typeof zPromotedBooking>;

export const zPromoteView = z.object({
  billing: z.object({ available: z.boolean(), reason: nullableString }),
  currency: z.string().default("usd"),
  tiers: z.array(z.object({ tier: openEnum(BOOST_TIERS), weeklyCents: z.number().int(), guaranteedTop: nullableNumber })),
  boost: zBoostRecord.nullish().transform((v) => v ?? null),
  boosts: z.array(zBoostRecord).default([]),
  rank: nullableNumber,
  listed: z.boolean(),
  reason: zUnlistedReason,
  promoted: z.object({
    weeklyCents: z.number().int(),
    spotsPerWeek: z.number().int().default(4),
    nextSpot: z
      .object({ startsAt: z.number(), endsAt: z.number(), spotsLeft: z.number().int() })
      .nullish()
      .transform((v) => v ?? null),
    allTaken: z.boolean().default(false),
    bookings: z.array(zPromotedBooking).default([]),
  }),
  visitors: z.object({ weekly: z.number().int().default(0) }),
});
export type PromoteView = z.infer<typeof zPromoteView>;
export type PromoteTier = PromoteView["tiers"][number];

/** A checkout's answer once billing is on: the page to pay on. */
export const zCheckout = z.object({ url: z.string() });

// ───────────── templates from a community ─────────────

const zCounts = z.object({ categories: z.number().int().default(0), channels: z.number().int().default(0), roles: z.number().int().default(0) });

/** The community's own template (its link's code and what it copies). */
export const zOwnTemplate = z.object({
  code: z.string(),
  name: z.string(),
  uses: z.number().int().default(0),
  counts: zCounts,
  outOfDate: z.boolean().default(false),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type OwnTemplate = z.infer<typeof zOwnTemplate>;
export const zOwnTemplateOut = z.object({ template: zOwnTemplate.nullable() });

/** What a template link opens: the channels and roles a new community would start with. */
export const zTemplatePreview = z.object({
  code: z.string(),
  name: z.string(),
  source: z
    .object({ id: z.string(), name: z.string(), photoRev: nullableNumber })
    .nullish()
    .transform((v) => v ?? null),
  uses: z.number().int().default(0),
  counts: zCounts,
  updatedAt: z.number(),
  categories: z.array(
    z.object({
      name: nullableString,
      channels: z.array(z.object({ name: z.string(), kind: z.string().default("PUBLIC"), voice: z.boolean().default(false), format: z.string().default("text"), topic: nullableString })),
    }),
  ),
  roles: z.array(z.object({ name: z.string(), color: nullableString })),
});
export type TemplatePreview = z.infer<typeof zTemplatePreview>;
export const zTemplatePreviewOut = z.object({ template: zTemplatePreview });

// ───────────── community bot directory ─────────────

export const BOT_CATEGORIES = ["moderation", "fun", "games", "utility", "music", "economy", "social", "ai", "other"] as const;
export type BotCategory = (typeof BOT_CATEGORIES)[number];

export const zDirectoryBot = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  description: z.string().default(""),
  category: openEnum(BOT_CATEGORIES),
  installCount: z.number().int().default(0),
  commands: z.array(z.object({ name: z.string(), description: z.string().default("") })).default([]),
  owner: z
    .object({ id: z.string(), username: z.string() })
    .nullish()
    .transform((v) => v ?? null),
  listedAt: z.number(),
});
export type DirectoryBot = z.infer<typeof zDirectoryBot>;
export const zBotDirectoryPage = z.object({ bots: z.array(zDirectoryBot), nextCursor: nullableNumber, categories: z.array(z.string()).default([]) });
export type BotDirectoryPage = z.infer<typeof zBotDirectoryPage>;

export const zBotListing = z.object({
  listed: z.boolean(),
  category: openEnum(BOT_CATEGORIES),
  description: z.string().default(""),
  listedAt: nullableNumber,
  updatedAt: nullableNumber,
  public: z.boolean(),
});
export type BotListing = z.infer<typeof zBotListing>;
export const zBotListingOut = z.object({ listing: zBotListing });
