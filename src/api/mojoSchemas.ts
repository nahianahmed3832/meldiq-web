import { z } from "zod";

/**
 * Meldiq Mojo, Meldiq Spark and gifts (server docs/MOJO.md, API 0.54.0). Every limit comes from the server's catalog
 * (GET /v2/mojo/catalog); what a person has from GET /v2/mojo/me, worked out on the server from verified billing.
 * Read tolerantly: a newer server may add fields.
 */
export const zPlanKey = z.enum(["free", "go", "plus"]);
export type PlanKey = z.infer<typeof zPlanKey>;
export const zPresetId = z.enum(["720p30", "720p60", "1080p30", "1080p60", "1440p30"]);
export type ScreenPresetId = z.infer<typeof zPresetId>;

export const zPlanPerks = z.object({
  key: zPlanKey,
  name: z.string(),
  listPriceMinor: z.number(),
  messageChars: z.number(),
  uploadBytes: z.number(),
  screen: z.array(zPresetId),
  sparks: z.number(),
  badge: z.enum(["go", "plus"]).nullable(),
  check: z.boolean(),
  customItems: z.number(),
  bots: z.number(),
  botReview: z.enum(["regular", "priority"]),
});
export type PlanPerks = z.infer<typeof zPlanPerks>;

export const zSparkLevel = z.object({
  level: z.number(),
  sparks: z.number(),
  emojiSlots: z.number(),
  stickerSlots: z.number(),
  uploadBytes: z.number().nullable(),
  voiceKbps: z.number(),
  screen: z.array(zPresetId),
});
export type SparkLevel = z.infer<typeof zSparkLevel>;

const zPrice = z.object({ currency: z.string(), amountMinor: z.number() }).nullable();

export const zMojoCatalog = z.object({
  version: z.string(),
  units: z.object({ mb: z.number(), gb: z.number() }),
  plans: z.array(zPlanPerks),
  screenPresets: z.array(z.object({ id: zPresetId, label: z.string(), width: z.number(), height: z.number(), fps: z.number() })),
  spark: z.object({ listPriceMinor: z.number(), interval: z.string(), maxPurchase: z.number(), levels: z.array(zSparkLevel) }),
  gifts: z.object({ months: z.array(z.number()), noteMax: z.number() }),
  /** Whether plan limits apply on this server now; false: the server's own limits, as before plans. */
  enforced: z.boolean().default(false),
  onSale: z.object({ mode: z.enum(["test", "live"]).nullable(), go: zPrice, plus: zPrice, spark: zPrice, gifts: z.boolean() }),
});
export type MojoCatalog = z.infer<typeof zMojoCatalog>;

export const zGiftView = z.object({
  id: z.string(),
  planKey: z.enum(["go", "plus"]),
  months: z.number(),
  status: z.enum(["pending", "paid", "redeemed", "refunded", "expired", "failed"]),
  note: z.string().nullable(),
  person: z.object({ userId: z.string().nullable(), name: z.string().nullable() }),
  currency: z.string(),
  amountMinor: z.number(),
  paidAt: z.number().nullable(),
  redeemedAt: z.number().nullable(),
});
export type GiftView = z.infer<typeof zGiftView>;

export const zMojoMe = z.object({
  plan: zPlanKey,
  perks: zPlanPerks,
  sparks: z.object({
    included: z.number(),
    purchased: z.number(),
    total: z.number(),
    free: z.number(),
    assignments: z.array(z.object({ id: z.string(), orgId: z.string(), orgName: z.string().nullable(), assignedAt: z.number(), paused: z.boolean(), member: z.boolean() })),
    subscription: z.object({ quantity: z.number(), status: z.string(), renews: z.boolean(), currentPeriodEnd: z.number().nullable() }).nullable(),
  }),
  badge: z.object({ kind: z.enum(["go", "plus"]).nullable(), check: z.boolean(), hidden: z.boolean() }),
  gifts: z.object({ received: z.array(zGiftView), sent: z.array(zGiftView) }),
});
export type MojoMe = z.infer<typeof zMojoMe>;

export const zOrgSparks = z.object({
  level: z.number(),
  active: z.number(),
  next: z.object({ level: z.number(), needs: z.number() }).nullable(),
  perks: zSparkLevel,
  levels: z.array(zSparkLevel),
  mine: z.array(z.object({ id: z.string(), assignedAt: z.number(), paused: z.boolean() })),
});
export type OrgSparks = z.infer<typeof zOrgSparks>;

export const zCheckoutStarted = z.object({ checkoutId: z.string().optional(), giftId: z.string().optional(), url: z.string().nullable(), expiresAt: z.number() });

/** The account's own billing page (docs/BILLING.md): its plan subscription, for renewal and cancellation wording. */
export const zOwnerBilling = z.object({
  available: z.boolean(),
  subscription: z
    .object({
      plan: z.object({ key: z.string(), name: z.string() }),
      status: z.string(),
      standing: z.string(),
      currentPeriodEnd: z.number().nullable(),
      cancelAtPeriodEnd: z.boolean(),
      currency: z.string(),
      amountMinor: z.number(),
    })
    .nullable(),
  portal: z.boolean(),
});
export type OwnerBilling = z.infer<typeof zOwnerBilling>;

/** A person's Mojo badge in member lists and profiles: "check" is Meldiq Check, a Plus perk, not verification. */
export const zMojoBadge = z.object({ badge: z.enum(["go", "plus"]), check: z.boolean() });
export type MojoBadge = z.infer<typeof zMojoBadge>;
