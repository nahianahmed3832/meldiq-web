import { z } from "zod";

const draftSchema = z.discriminatedUnion("product", [
  z.object({ product: z.literal("plus") }),
  z.object({ product: z.literal("gift"), recipientUserId: z.string().min(1).max(128), months: z.union([z.literal(1), z.literal(3), z.literal(12)]), note: z.string().max(500) }),
]);
export type CheckoutDraft = z.infer<typeof draftSchema>;
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
