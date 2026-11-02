import { z } from "zod";
export const zCardMethod = z.object({ id: z.string(), brand: z.string(), lastFour: z.string(), expiry: z.string().nullable(), createdAt: z.number() });
export const zCardMethods = z.object({ available: z.boolean(), methods: z.array(zCardMethod) });
export const zCardMandate = z.object({
  id: z.string(),
  orgId: z.string().nullable(),
  product: z.enum(["plus", "bots_plus"]),
  paymentMethodId: z.string(),
  status: z.string(),
  currency: z.string(),
  amountMinor: z.number(),
  nextBillingAt: z.number().nullable(),
  paidThrough: z.number().nullable(),
  cancelAt: z.number().nullable(),
  processing: z.boolean(),
});
export const zCardMandates = z.object({ subscriptions: z.array(zCardMandate) });
export const zCardQuote = z.object({ consentVersion: z.string(), amountMinor: z.number(), currency: z.string(), firstBillingAt: z.number() });
