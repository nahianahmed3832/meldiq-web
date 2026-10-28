import { z } from "zod";

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
export const zProfileStyle = z
  .object({
    decoration: z.enum(PROFILE_DECORATIONS).nullable().catch(null),
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

/** API 0.54.0: the Mojo badge someone shows (server docs/MOJO.md); "check" is Meldiq Check, a Plus perk, not verification. */
export const zMojoMark = z
  .object({ badge: z.enum(["go", "plus"]), check: z.boolean() })
  .nullish()
  .catch(null)
  .transform((v) => v ?? null);
export type MojoMark = NonNullable<z.infer<typeof zMojoMark>>;
