import { z } from "zod";
import type { MojoState } from "../sync/mojo";

export const SUPPORT_TICK_MS = 15_000;
export const SUPPORT_MIN_ACTIVE_MS = 10 * 60_000;
export const SUPPORT_MIN_VISIT_MS = 60_000;
export const SUPPORT_COOLDOWN_MS = 14 * 86_400_000;
export const SUPPORT_SNOOZE_MS = 30 * 86_400_000;
export const SUPPORT_EXPLORE_MS = 90 * 86_400_000;
export const SUPPORT_KEY = "plusSupport";

const zProgress = z.object({
  userId: z.string(),
  days: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(30),
  activeMs: z.number().finite().nonnegative(),
  lastShownAt: z.number().finite().nonnegative().nullable(),
  snoozedUntil: z.number().finite().nonnegative(),
});
export type SupportProgress = z.infer<typeof zProgress>;

/** Only activity counts and reminder dates; no message contents or analytics leave this browser. */
export function supportProgress(raw: unknown, userId: string): SupportProgress {
  const parsed = zProgress.safeParse(raw);
  return parsed.success && parsed.data.userId === userId ? parsed.data : { userId, days: [], activeMs: 0, lastShownAt: null, snoozedUntil: 0 };
}

export function recordSupportActivity(progress: SupportProgress, now: number, elapsedMs: number): SupportProgress {
  const elapsed = Math.max(0, Math.min(SUPPORT_TICK_MS, elapsedMs));
  if (!elapsed) return progress;
  const today = new Date(now).toISOString().slice(0, 10);
  return { ...progress, days: [...new Set([...progress.days, today])].slice(-30), activeMs: Math.min(progress.activeMs + elapsed, 86_400_000) };
}

export function supportOnSale(mojo: MojoState): boolean {
  const price = mojo.catalog?.onSale.plus;
  const subscription = mojo.billing?.subscription;
  return !!(
    mojo.available &&
    !mojo.error &&
    mojo.me?.plan === "free" &&
    mojo.billing?.available &&
    (!subscription || ["canceled", "expired", "incomplete_expired"].includes(subscription.status)) &&
    mojo.catalog?.onSale.mode === "live" &&
    mojo.catalog.plans.some((plan) => plan.key === "plus") &&
    price &&
    price.amountMinor > 0 &&
    /^[A-Z]{3}$/.test(price.currency)
  );
}

/** Familiar users, a settled visit, and at most one reminder every two weeks. */
export function supportReminderDue(progress: SupportProgress, now: number, visitActiveMs: number): boolean {
  return (
    new Set(progress.days).size >= 3 &&
    progress.activeMs >= SUPPORT_MIN_ACTIVE_MS &&
    visitActiveMs >= SUPPORT_MIN_VISIT_MS &&
    now >= progress.snoozedUntil &&
    (progress.lastShownAt === null || now - progress.lastShownAt >= SUPPORT_COOLDOWN_MS)
  );
}
