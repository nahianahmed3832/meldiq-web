import type { Engine } from "../sync/engine";
import { zPromotionPreference } from "../api/promotionSchemas";
import { getPrefs, setPrefs } from "./prefs";
import type { MojoState } from "../sync/mojo";

/** Presentation precondition only. Eligibility and frequency are always decided by the backend. */
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

const syncing = new WeakMap<Engine, Promise<void>>();
/** Migrate a legacy local opt-out once, then follow the account-wide value without overwriting another device. */
export function syncPlusReminderPreference(engine: Engine): Promise<void> {
  const pending = syncing.get(engine);
  if (pending) return pending;
  const task = (async () => {
    const key = "plus-reminder-preference-migrated";
    const migrated = await engine.store.getValue<string>(key);
    let preference = await engine.api.json("GET", "/v2/billing/promotions/preference", zPromotionPreference);
    if (migrated !== engine.device.userId && !getPrefs().plusReminders) {
      preference = await engine.api.json("PUT", "/v2/billing/promotions/preference", zPromotionPreference, { body: { optOut: true } });
    }
    await engine.store.setValue(key, engine.device.userId);
    setPrefs({ plusReminders: !preference.optOut });
  })();
  syncing.set(engine, task);
  void task
    .finally(() => {
      if (syncing.get(engine) === task) syncing.delete(engine);
    })
    .catch(() => undefined);
  return task;
}
