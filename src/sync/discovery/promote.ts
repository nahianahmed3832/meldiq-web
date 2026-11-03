import { text as uiText } from "../../i18n";
import { ApiError } from "../../api/client";
import type { BoostRecord, BoostTier, PromotedBooking, PromoteTier } from "../../api/discoverySchemas";
/**
 * Promote's rules on the web (community parity E, feature discovery-promote; docs/MELDIQ_COMMUNITY_PARITY.md §1
 * Promote; server docs/COMMUNITY_PARITY_API.md › Promote): prices, the three boosts, the guarantee, Discovery rank, the
 * Promoted row's weeks and bookings, and the answer while Meldiq takes no payments (503 billing_unavailable).
 */
/** A weekly price: "$3.99" for USD, else the amount and currency code. */
export function price(cents: number, currency = "usd"): string {
  const amount = (cents / 100).toFixed(2);
  return currency.toLowerCase() === "usd" ? `$${amount}` : `${amount} ${currency.toUpperCase()}`;
}
/** Each tier's name, label and one-line pitch (Meldiq's words). */
export const TIER_TEXT: Record<
  BoostTier,
  {
    name: string;
    label: string;
    pitch: string;
  }
> = {
  boost: {
    name: "Boost",
    get label() {
      return uiText("workspace.discover_label_boost");
    },
    get pitch() {
      return uiText("workspace.interface.a_boosted_label_and_a_place_above_every_community_that_isn_t_boos_b39c819");
    },
  },
  super: {
    name: "Super Boost",
    get label() {
      return uiText("workspace.discover_label_super");
    },
    get pitch() {
      return uiText("workspace.interface.above_every_boost_with_a_super_boosted_label_11fc88e");
    },
  },
  mega: {
    name: "Mega Boost",
    get label() {
      return uiText("workspace.discover_label_mega");
    },
    get pitch() {
      return uiText("workspace.interface.above_everything_else_with_a_gold_label_and_a_guaranteed_place_577bcf4");
    },
  },
};
/** The tier the reference marks "Most popular". */
export const POPULAR_TIER: BoostTier = "mega";
/** The tiers Meldiq knows, smallest first (an unknown one from a newer server is left out). */
export function knownTiers(tiers: readonly PromoteTier[]): (PromoteTier & {
  tier: BoostTier;
})[] {
  return tiers.filter(
    (
      t,
    ): t is PromoteTier & {
      tier: BoostTier;
    } => t.tier in TIER_TEXT,
  );
}
/** Mega's guarantee for this community (top 100, or 50 from 100 members, or 20 from 1,000). */
export function guaranteeText(guaranteedTop: number | null): string | null {
  return guaranteedTop ? uiText("workspace.interface.guaranteed_a_place_in_the_top_value0_0674c04", { value0: guaranteedTop }) : null;
}
/** Discovery rank as shown on Promote: "#3" when listed. */
export function rankText(rank: number | null, listed: boolean): string {
  if (listed && rank !== null) return `#${rank}`;
  return listed ? uiText("workspace.interface.listed_78797af") : uiText("workspace.interface.not_listed_e2dcbd0");
}
/** True for the server's "billing is off" answer: the buttons stay, with a note that payments aren't set up yet. */
export function isBillingUnavailable(e: unknown): boolean {
  return e instanceof ApiError && e.code === "billing_unavailable";
}
/** A checkout page Meldiq may send people to: https only (http on this computer while developing), no credentials. */
export function safeCheckoutUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.username || u.password) return null;
    if (u.protocol === "https:") return u.toString();
    return u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}
const DAY_MS = 86400000;
/** A Promoted week, Monday to Sunday in UTC (the server's weeks): "Mon 2 Nov – Sun 8 Nov". */
export function weekText(startsAt: number, endsAt: number, locale?: string): string {
  const f = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return `${f.format(startsAt)} – ${f.format(Math.max(startsAt, endsAt - DAY_MS))}`;
}
/** The last day a boost runs, in UTC: "8 Nov". */
export function dayText(at: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(at);
}
export type RecordPhase = "running" | "upcoming" | "ended" | "pending" | "cancelled";
/** Where a boost or booking stands: waiting for payment, cancelled, or by its dates. */
export function recordPhase(r: Pick<BoostRecord | PromotedBooking, "state" | "startsAt" | "endsAt">, now = Date.now()): RecordPhase {
  if (r.state === "cancelled") return "cancelled";
  if (r.state === "pending") return "pending";
  if (now >= r.endsAt) return "ended";
  return now >= r.startsAt ? "running" : "upcoming";
}
export const PHASE_TEXT: Record<RecordPhase, string> = {
  get running() {
    return uiText("workspace.interface.running_f4ccae2");
  },
  get upcoming() {
    return uiText("workspace.interface.coming_up_b743c76");
  },
  get ended() {
    return uiText("workspace.interface.ended_7cdc804");
  },
  get pending() {
    return uiText("workspace.interface.waiting_for_payment_50f6b0a");
  },
  get cancelled() {
    return uiText("messaging.interface.cancelled_d353a99");
  },
};
/** The boost of [tier] running or coming up, if any (to show on its card). */
export function boostOfTier(boosts: readonly BoostRecord[], tier: BoostTier, now = Date.now()): BoostRecord | null {
  return boosts.find((b) => b.tier === tier && ["running", "upcoming"].includes(recordPhase(b, now))) ?? null;
}
