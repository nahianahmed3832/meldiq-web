import { z } from "zod";

export const zPayPalConfig = z.object({
  provider: z.literal("paypal"),
  environment: z.enum(["sandbox", "live"]),
  clientId: z.string().min(1),
  billingStartAt: z.number().nullable().optional(),
  subscriptions: z.boolean(),
  // Direct card fields are disabled. Hosted guest card buttons check buyer eligibility separately in PayPal's SDK.
  cards: z.literal(false),
  sparks: z.boolean().optional(),
  botsPlus: z.boolean().optional(),
});
export type PayPalConfig = z.infer<typeof zPayPalConfig>;
export const zPayPalCheckout = z.object({
  id: z.string(),
  product: z.enum(["plus", "gift", "spark", "bots_plus"]),
  quantity: z.number().int().positive().optional(),
  orgId: z.string().nullable().optional(),
  providerRef: z.string().nullable(),
  status: z.string(),
  confirmed: z.boolean(),
  approved: z.boolean().optional(),
  currency: z.literal("USD"),
  amountMinor: z.number().int().nonnegative(),
  interval: z.enum(["month", "one_time"]),
  expiresAt: z.number(),
});
export type PayPalPurchase = z.infer<typeof zPayPalCheckout>;
export const zPayPalCancellation = z.object({
  confirmed: z.boolean(),
  accessUntil: z.number().nullable(),
  status: z.string(),
  approvalPending: z.boolean().optional(),
  checkoutExpired: z.boolean().optional(),
});
const zTransaction = z.object({
  id: z.string(),
  product: z.string(),
  currency: z.string(),
  amountMinor: z.number(),
  provider: z.string(),
  providerRef: z.string().nullable(),
  status: z.string(),
  refundStatus: z.string(),
  createdAt: z.number(),
  completedAt: z.number().nullable(),
});
export const zPayPalHistory = z.object({
  transactions: z.array(zTransaction),
  subscriptions: z.array(
    z.object({
      id: z.string(),
      product: z.string().optional(),
      orgId: z.string().nullable().optional(),
      providerRef: z.string(),
      status: z.string(),
      approvalPending: z.boolean().optional(),
      billingStartAt: z.number().nullable().optional(),
      currentPeriodEnd: z.number().nullable(),
      cancelAtPeriodEnd: z.boolean(),
      createdAt: z.number(),
    }),
  ),
  history: z.array(z.object({ subscriptionId: z.string(), at: z.number(), from: z.string().nullable(), to: z.string(), source: z.string() })),
});
export type PayPalHistory = z.infer<typeof zPayPalHistory>;
