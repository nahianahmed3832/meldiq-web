import { z } from "zod";
import { openEnum } from "./enums";

/**
 * A person's and a community's look as the server sends it (API 0.44.0–0.46.0): accent colours, animated avatars,
 * banners, profile and name styles, worn community tags. Unknown or malformed values are dropped, never shown.
 */

const nullableString = z
  .string()
  .nullish()
  .transform((v) => v ?? null);

/** A community's accent colour (API 0.44.0): only "#rrggbb" is kept; anything else is dropped (Meldiq's theme). */
export const zAccent = z
  .unknown()
  .optional()
  .transform((v) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null));

/** Profile style ids the web draws (API 0.45.0, server PROFILE_DECORATIONS / PROFILE_EFFECTS); unknown ones are dropped. */
export const PROFILE_DECORATIONS = ["aurora", "ember", "frost", "neon", "sakura", "pixel"] as const;
export const PROFILE_EFFECTS = ["sparkles", "glow", "stars", "bubbles"] as const;
/**
 * A worn decoration (API 0.60.0, server docs/PROFILE_DECORATIONS.md): one of the classic frames above, which the web
 * draws, or an image by id (Meldiq's own, or an approved community one: "c_" and 16 letters or digits).
 */
export const DECORATION_ID = /^(?:[a-z0-9-]{2,32}|c_[a-z0-9]{16})$/;
export const isClassicDecoration = (id: string): boolean => (PROFILE_DECORATIONS as readonly string[]).includes(id);
export const zAvatarMedia = z
  .object({ kind: z.enum(["gif", "webp", "video"]), rev: z.number().int() })
  .nullish()
  .catch(null)
  .transform((v) => v ?? null);
export const zProfileBanner = z
  .object({ kind: z.enum(["jpeg", "gif", "webp"]), rev: z.number().int() })
  .nullish()
  .catch(null)
  .transform((v) => v ?? null);
/** Name styles (API 0.46.0, server NAME_FONTS / NAME_EFFECTS): fonts the web ships, and effects it draws. */
export const NAME_FONTS = ["pixel", "arcade", "script", "block", "tech", "mono"] as const;
export const NAME_EFFECTS = ["glow", "shimmer"] as const;
export type NameFont = (typeof NAME_FONTS)[number];
export type NameEffect = (typeof NAME_EFFECTS)[number];
const zHexList = z
  .array(z.string().regex(/^#[0-9a-fA-F]{6}$/))
  .min(1)
  .max(3)
  .nullish()
  .catch(null)
  .transform((v) => v ?? null);
/** API 0.65.0 (server SHOWABLE_BADGES): the badges someone can choose to show by their name, and "none". */
export const SHOWN_BADGES = ["mojo", "bug-hunter", "artist", "none"] as const;
export type ShownBadge = (typeof SHOWN_BADGES)[number];
const zThemeColors = z
  .array(z.string().regex(/^#[0-9a-fA-F]{6}$/))
  .min(1)
  .max(2)
  .nullish()
  .catch(null)
  .transform((v) => (v ? v.map((c) => c.toLowerCase()) : null));
export const zProfileStyle = z
  .object({
    decoration: z.string().regex(DECORATION_ID).nullable().catch(null),
    effect: z.enum(PROFILE_EFFECTS).nullable().catch(null),
    accent: zAccent,
    nameFont: z
      .enum(NAME_FONTS)
      .nullish()
      .catch(null)
      .transform((v) => v ?? null),
    nameColors: zHexList,
    nameEffect: z
      .enum(NAME_EFFECTS)
      .nullish()
      .catch(null)
      .transform((v) => v ?? null),
    tagOrgId: nullableString,
    /** API 0.65.0: the profile theme, one colour or two for a gradient (older servers: only [accent]). */
    themeColors: zThemeColors,
    /** API 0.65.0: the badge shown next to the name; "none" shows none, null is the apps' default (the Mojo badge). */
    shownBadge: z
      .enum(SHOWN_BADGES)
      .nullish()
      .catch(null)
      .transform((v) => v ?? null),
  })
  .nullish()
  .catch(null)
  .transform((v) => v ?? null);
export type ProfileStyle = NonNullable<z.infer<typeof zProfileStyle>>;
/** The community tag someone wears by their name (API 0.46.0): its letters, colour and community. */
export const zWornTag = z
  .object({ orgId: z.string(), text: z.string().max(8), color: zAccent })
  .nullish()
  .catch(null)
  .transform((v) => v ?? null);
export type WornTag = NonNullable<z.infer<typeof zWornTag>>;

/** API 0.46.0: About me, links (https only) and badges earned, on profiles. */
export const zAboutMe = nullableString;
export const zProfileLinks = z
  .array(z.object({ label: z.string().max(40), url: z.string().regex(/^https:\/\//) }))
  .max(5)
  .nullish()
  .catch(null)
  .transform((v) => v ?? []);
export const zBadges = z
  .array(z.string())
  .nullish()
  .catch(null)
  .transform((v) => (v ?? []).filter((b): b is "bug-hunter" => b === "bug-hunter"));

/** API 0.64.0: pins on a profile (server docs/PROFILE_PINS.md), Meldiq's for milestones, then communities' own. */
export const zProfilePins = z
  .array(
    z.object({
      id: z.string().regex(/^(?:[a-z0-9-]{2,32}|p_[a-z0-9]{16})$/),
      kind: z.enum(["meldiq", "community"]).catch("community"),
      name: z.string().max(64),
      description: z
        .string()
        .max(200)
        .nullish()
        .transform((v) => v ?? null),
      animated: z.boolean().catch(false),
      community: z
        .object({ id: z.string(), name: z.string() })
        .nullish()
        .transform((v) => v ?? null),
      since: z
        .number()
        .nullish()
        .transform((v) => v ?? null),
    }),
  )
  .max(100)
  .nullish()
  .catch(null)
  .transform((v) => v ?? []);
export type ProfilePin = z.infer<typeof zProfilePins>[number];

/** API 0.54.0: the Mojo badge someone shows (server docs/MOJO.md); "check" is Meldiq Check, a Plus perk, not verification. */
export const zMojoMark = z
  .object({ badge: z.enum(["go", "plus"]), check: z.boolean() })
  .nullish()
  .catch(null)
  .transform((v) => v ?? null);
export type MojoMark = NonNullable<z.infer<typeof zMojoMark>>;

/** API 0.65.0 batch B (connections-v2): the linked accounts a profile shows (sync/linkedAccounts.ts). */
export const PROVIDERS = ["steam", "anilist", "lastfm", "trakt"] as const;
export type Provider = (typeof PROVIDERS)[number];

const zItem = z.object({ title: z.string(), subtitle: z.string().nullable(), url: z.string().nullable() });

/** A connection as profiles show it; unknown providers or kinds (a newer server) are kept out by [visibleConnections]. */
export const zProfileConnection = z.object({
  provider: openEnum(PROVIDERS),
  name: z.string(),
  url: z.string(),
  itemsKind: z.string(),
  items: z.array(zItem).max(10),
  updatedAt: z.number(),
});
export type ProfileConnection = z.infer<typeof zProfileConnection>;

/** On profiles: absent when there are none (and for someone who blocked you). */
export const zProfileConnections = z
  .array(zProfileConnection)
  .max(20)
  .nullish()
  .catch(null)
  .transform((v) => v ?? []);
