import { z } from "zod";
export const zCommerceOrder = z.object({
  id: z.string(),
  product: z.string(),
  subtotalMinor: z.number(),
  discountMinor: z.number(),
  taxMinor: z.number(),
  totalMinor: z.number(),
  currency: z.string(),
  taxStatus: z.string(),
  provider: z.string(),
  status: z.string(),
  entitlementStatus: z.string(),
  createdAt: z.number(),
  completedAt: z.number().nullable(),
  providerReference: z.string().nullable(),
  refundStatus: z.string(),
});
export const zCommerceOrders = z.object({ orders: z.array(zCommerceOrder) });
export const zCommerceReceipt = zCommerceOrder.extend({ receiptNumber: z.string(), paid: z.boolean(), seller: z.string(), statement: z.string() });
