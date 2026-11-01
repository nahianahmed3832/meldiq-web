import type { PayPalPurchase } from "../../api/paypalSchemas";
import { z } from "zod";

const draftSchema = z.discriminatedUnion("product", [
  z.object({ product: z.literal("plus") }),
  z.object({ product: z.literal("spark"), quantity: z.number().int().min(1).max(20) }),
  z.object({ product: z.literal("bots_plus"), orgId: z.string().min(1).max(150) }),
  z.object({ product: z.literal("gift"), recipientUserId: z.string().min(1).max(128), months: z.union([z.literal(1), z.literal(3), z.literal(12)]), note: z.string().max(500) }),
]);
export type CheckoutDraft = z.infer<typeof draftSchema>;
export const CHECKOUT_DRAFT_EVENT = "meldiq:checkout-draft";
const key = (userId: string) => `meldiq.paypal.sandbox.${userId}`;

/** This tab stores an opaque purchase reference and retry key; no authorization or entitlement is stored here. */
export function readCheckout(userId: string): { draft: CheckoutDraft; requestKey: string; purchaseId: string | null; completed: boolean } {
  try {
    const result = z
      .object({ draft: draftSchema, requestKey: z.string().uuid(), purchaseId: z.string().nullable(), completed: z.boolean().default(false) })
      .safeParse(JSON.parse(sessionStorage.getItem(key(userId)) ?? "null"));
    if (result.success) return result.data;
  } catch {
    /* Storage may be unavailable. The server still verifies every request. */
  }
  return { draft: { product: "plus" }, requestKey: crypto.randomUUID(), purchaseId: null, completed: false };
}
export function writeCheckout(userId: string, value: ReturnType<typeof readCheckout>): void {
  try {
    sessionStorage.setItem(key(userId), JSON.stringify(value));
    if (typeof window !== "undefined") window.dispatchEvent(new Event(CHECKOUT_DRAFT_EVENT));
  } catch {
    /* Checkout remains usable without tab persistence. */
  }
}
export function selectCheckout(userId: string, draft: CheckoutDraft): void {
  const previous = readCheckout(userId);
  // Resume the same purchase on retry or refresh; explicitly selecting a different product gets its own key.
  if (!previous.completed && JSON.stringify(previous.draft) === JSON.stringify(draft)) {
    writeCheckout(userId, previous);
    return;
  }
  writeCheckout(userId, { draft, requestKey: crypto.randomUUID(), purchaseId: null, completed: false });
}

/** Reopen only a server-returned, account-owned quote; approval still requires server verification. */
export function restoreCheckout(userId: string, purchase: PayPalPurchase): void {
  let draft: CheckoutDraft;
  if (purchase.product === "spark" && purchase.quantity) draft = { product: "spark", quantity: purchase.quantity };
  else if (purchase.product === "bots_plus" && purchase.orgId) draft = { product: "bots_plus", orgId: purchase.orgId };
  else if (purchase.product === "plus") draft = { product: "plus" };
  else throw new Error("Open this purchase from its original checkout.");
  writeCheckout(userId, {
    draft,
    purchaseId: purchase.id,
    requestKey: crypto.randomUUID(),
    completed: purchase.confirmed || purchase.approved === true || ["expired", "incomplete_expired", "canceled", "failed", "refunded"].includes(purchase.status),
  });
}
