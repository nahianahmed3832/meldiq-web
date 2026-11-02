import { z } from "zod";

export const zPromotion = z.object({
  id: z.string(),
  campaignId: z.string(),
  presentation: z.enum(["banner", "card", "modal"]),
  heading: z.string(),
  description: z.string(),
  image: z.string().nullable(),
  cta: z.string(),
  destination: z.literal("/settings/mojo"),
  amountMinor: z.number().int().positive(),
  currency: z.literal("USD"),
  interval: z.literal("month"),
  expiresAt: z.number(),
});
export type Promotion = z.infer<typeof zPromotion>;
export const zPromotionClaim = z.object({ promotion: zPromotion.nullable() });
export const zPromotionCurrent = z.object({ active: z.boolean(), expiresAt: z.number().optional() });

export const zPromotionPreference = z.object({ optOut: z.boolean() });
