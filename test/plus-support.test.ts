import { describe, expect, it } from "vitest";
import { SUPPORT_COOLDOWN_MS, SUPPORT_MIN_ACTIVE_MS, SUPPORT_MIN_VISIT_MS, recordSupportActivity, supportOnSale, supportProgress, supportReminderDue } from "../src/application/plusSupport";
import { initialMojo, type MojoState } from "../src/sync/mojo";
import catalogJson from "./contract-fixtures/http/GET_v2_mojo_catalog.json";
import meJson from "./contract-fixtures/http/GET_v2_mojo_me.json";
import { zMojoCatalog, zMojoMe } from "../src/api/mojoSchemas";

const now = Date.UTC(2026, 10, 1);
const familiar = () => ({ ...supportProgress(null, "alice"), days: ["2026-10-29", "2026-10-30", "2026-11-01"], activeMs: SUPPORT_MIN_ACTIVE_MS });
function sale(): MojoState {
  const catalog = zMojoCatalog.parse(catalogJson);
  catalog.onSale = { ...catalog.onSale, mode: "live", plus: { currency: "USD", amountMinor: 399 } };
  const me = zMojoMe.parse(meJson);
  me.plan = "free";
  return { ...initialMojo, available: true, catalog, me, billing: { available: true, subscription: null, portal: false } };
}

describe("occasional Plus support reminders", () => {
  it("waits for three distinct days, ten active minutes and a settled visit", () => {
    expect(supportReminderDue(supportProgress(null, "alice"), now, SUPPORT_MIN_VISIT_MS)).toBe(false);
    expect(supportReminderDue({ ...familiar(), days: ["2026-11-01", "2026-11-01", "2026-11-01"] }, now, SUPPORT_MIN_VISIT_MS)).toBe(false);
    expect(supportReminderDue({ ...familiar(), activeMs: SUPPORT_MIN_ACTIVE_MS - 1 }, now, SUPPORT_MIN_VISIT_MS)).toBe(false);
    expect(supportReminderDue(familiar(), now, SUPPORT_MIN_VISIT_MS - 1)).toBe(false);
    expect(supportReminderDue(familiar(), now, SUPPORT_MIN_VISIT_MS)).toBe(true);
  });
  it("honors impression cooldowns, future dates and dismissals across reloads", () => {
    expect(supportReminderDue({ ...familiar(), lastShownAt: now }, now + SUPPORT_COOLDOWN_MS - 1, SUPPORT_MIN_VISIT_MS)).toBe(false);
    expect(supportReminderDue({ ...familiar(), lastShownAt: now }, now + SUPPORT_COOLDOWN_MS, SUPPORT_MIN_VISIT_MS)).toBe(true);
    expect(supportReminderDue({ ...familiar(), lastShownAt: now + 1 }, now, SUPPORT_MIN_VISIT_MS)).toBe(false);
    expect(supportReminderDue({ ...familiar(), snoozedUntil: now + 1 }, now, SUPPORT_MIN_VISIT_MS)).toBe(false);
  });
  it("does not count browser sleep as active use or share progress with another account", () => {
    const progress = recordSupportActivity(supportProgress(null, "alice"), now, 86_400_000);
    expect(progress.activeMs).toBe(15_000);
    expect(progress.days).toEqual(["2026-11-01"]);
    expect(recordSupportActivity(progress, now, -1)).toEqual(progress);
    expect(supportProgress(progress, "bob").days).toEqual([]);
    expect(supportProgress({ ...progress, activeMs: Infinity }, "alice").activeMs).toBe(0);
  });
  it("only recommends a live purchasable Plus plan to known free users", () => {
    expect(supportOnSale(sale())).toBe(true);
    expect(supportOnSale(initialMojo)).toBe(false);
    for (const plan of ["go", "plus"] as const) {
      const mojo = sale();
      mojo.me!.plan = plan;
      expect(supportOnSale(mojo)).toBe(false);
    }
    for (const mode of [null, "test"] as const) {
      const mojo = sale();
      mojo.catalog!.onSale.mode = mode;
      expect(supportOnSale(mojo)).toBe(false);
    }
    const unknown = sale();
    unknown.billing = null;
    expect(supportOnSale(unknown)).toBe(false);
    const pending = sale();
    pending.billing!.subscription = {
      plan: { key: "plus", name: "Plus" },
      status: "pending",
      standing: "pending",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      currency: "USD",
      amountMinor: 399,
    };
    expect(supportOnSale(pending)).toBe(false);
    pending.billing!.subscription!.status = "expired";
    expect(supportOnSale(pending)).toBe(true);
    const failed = sale();
    failed.error = "offline";
    expect(supportOnSale(failed)).toBe(false);
  });
});
