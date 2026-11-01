import { z } from "zod";
export const COLLECTION_CATEGORIES = ["avatar-frame", "avatar-effect", "background", "banner", "profile-theme", "name-effect", "badge", "particles"] as const;
export type CollectionCategory = (typeof COLLECTION_CATEGORIES)[number];
export const CATEGORY_LABELS: Record<CollectionCategory, string> = {
  "avatar-frame": "Avatar frames",
  "avatar-effect": "Avatar effects",
  background: "Backgrounds",
  banner: "Banners",
  "profile-theme": "Card themes",
  "name-effect": "Name effects",
  badge: "Collectible badges",
  particles: "Ambient effects",
};
/** Keep the public domain type shallow: this schema is nested throughout profile, member and message models. */
export interface CollectibleLook {
  id: string;
  name: string;
  category: CollectionCategory;
  version: number;
  recipe: {
    colors: string[];
    pattern: "solid" | "orbit" | "grid" | "prism";
    frame?: "aurora" | "ember" | "frost" | "neon" | "sakura" | "pixel";
    effect?: "sparkles" | "glow" | "stars" | "bubbles";
    nameEffect?: "glow" | "shimmer";
    assetId?: string;
  };
}
export interface Collectible extends CollectibleLook {
  description: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  acquisitionType: "free" | "premium" | "event" | "purchase";
  price: number;
  currency: "USD" | "EMBERS";
  isActive: boolean;
  isFeatured: boolean;
  availableFrom: number | null;
  availableUntil: number | null;
  supportedPlatforms: string[];
}
const lookSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{2,63}$/),
  name: z.string().max(80),
  category: z.enum(COLLECTION_CATEGORIES),
  version: z.number().int().positive(),
  recipe: z.object({
    colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).length(2),
    pattern: z.enum(["solid", "orbit", "grid", "prism"]),
    frame: z.enum(["aurora", "ember", "frost", "neon", "sakura", "pixel"]).optional(),
    effect: z.enum(["sparkles", "glow", "stars", "bubbles"]).optional(),
    nameEffect: z.enum(["glow", "shimmer"]).optional(),
    assetId: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  }),
});
export const zCollectibleLook: z.ZodType<CollectibleLook> = lookSchema;
export const zCollectible: z.ZodType<Collectible> = lookSchema.extend({
  description: z.string(),
  rarity: z.enum(["common", "rare", "epic", "legendary"]),
  acquisitionType: z.enum(["free", "premium", "event", "purchase"]),
  price: z.number().int().nonnegative(),
  currency: z.enum(["USD", "EMBERS"]),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  availableFrom: z.number().nullable(),
  availableUntil: z.number().nullable(),
  supportedPlatforms: z.array(z.string()),
});
export const zCollectionPage = z.object({ items: z.array(zCollectible), next: z.string().nullable() });
export const zCollectionInventory = z.object({ inventory: z.array(z.object({ decoration_id: z.string(), acquired_at: z.number(), acquisition_source: z.string(), is_favorite: z.number() })) });
