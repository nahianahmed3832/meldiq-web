import { ENGLISH } from "./english";
import { text } from "./index";
import { formatUnit } from "./format";

/** Localize audited state identifiers; future server states retain their original display fallback. */
export function billingState(value: string): string {
  return Object.hasOwn(ENGLISH.billing.commerce.status, value) ? text(`billing.commerce.status.${value as keyof typeof ENGLISH.billing.commerce.status}`) : value.replaceAll("_", " ");
}

/** Recognize only the existing server's built-in receipt descriptions. No user-supplied text is rewritten. */
export function billingProduct(value: string): string {
  const sparks = /^(\d+) Meldiq Sparks? · one-time$/.exec(value);
  if (sparks) return text("billing.commerce.sparkPurchase", { quantity: Number(sparks[1]) });
  const gift = /^Plus gift · (\d+) months?$/.exec(value);
  if (gift) return text("billing.commerce.plusGift", { duration: formatUnit(Number(gift[1]), "month") });
  if (value === "Meldiq payment") return text("billing.commerce.payment");
  if (value === "Meldiq subscription") return text("billing.commerce.subscription");
  return value;
}

/** Built-in tier labels only; named products retain their original branding. */
export function billingPlanName(value: string): string {
  return value === "Free" ? text("billing.commerce.status.free") : value === "Legacy Go" ? text("billing.interface.legacy_go_5f17a0c") : value;
}

/** Static operations states; subjects, decisions and purchase identifiers remain original data. */
export function operationState(value: string): string {
  switch (value) {
    case "open":
      return text("settings.interface.waiting_for_review_a61935d");
    case "accepted":
      return text("billing.commerce.status.approved");
    case "rejected":
      return text("admin.states.rejected");
    case "escalated":
      return text("admin.states.escalated");
    case "disputed":
      return text("admin.states.disputed");
    case "complete":
    case "completed":
      return text("workspace.interface.completed_22a970d");
    default:
      return billingState(value);
  }
}
