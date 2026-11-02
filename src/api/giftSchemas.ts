import { z } from "zod";
export const zGift = z.object({
  id: z.string(),
  product: z.string(),
  months: z.number().int(),
  note: z.string().nullable(),
  status: z.string(),
  currency: z.string(),
  amountMinor: z.number().int(),
  sender: z.string().nullable(),
  recipientUserId: z.string().nullable(),
  recipientKind: z.enum(["user", "email", "link"]),
  recipientEmail: z.string().nullable(),
  createdAt: z.number(),
  paidAt: z.number().nullable(),
  redeemedAt: z.number().nullable(),
  expiresAt: z.number().nullable(),
  credited: z.boolean(),
});
export type GiftView = z.infer<typeof zGift>;
export const zGifts = z.object({ sent: z.array(zGift), received: z.array(zGift) });
export const zGiftRedemption = z.object({ credited: z.boolean(), startsAt: z.number().nullable(), endsAt: z.number().nullable() });
export const zGiftLink = z.object({ giftId: z.string(), url: z.string().url(), expiresAt: z.number().nullable() });
export const zGiftPreview = z.object({
  id: z.string(),
  product: z.string(),
  months: z.number(),
  note: z.string().nullable(),
  sender: z.string().nullable(),
  status: z.string(),
  requiresVerifiedEmail: z.boolean(),
  expiresAt: z.number().nullable(),
});
export const giftTokenFromLocation = () =>
  typeof location !== "undefined" && location.pathname === "/settings/gifts" ? validGiftToken(new URLSearchParams(location.hash.slice(1)).get("gift")) : null;

function validGiftToken(value: string | null) {
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
