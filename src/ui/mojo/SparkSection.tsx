import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Gem, Minus, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { money } from "./mojoFormat";
import { SparkLevelCards, SparkTrack } from "./SparkTrack";
/**
 * Meldiq Spark on the Meldiq Plus page (server docs/MOJO.md › Meldiq Spark): what the three levels unlock, the person's Sparks
 * and where each one is, and buying more. Giving one to a community is also on the community's menu (SparkDialog).
 */
export function SparkSection({ onBuy, busy, offline }: { onBuy: (quantity: number) => void; busy: boolean; offline: boolean }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const { catalog, me } = useOrbit((s) => s.mojo);
  const orgs = useOrbit((s) => s.orgs);
  const [quantity, setQuantity] = useState(1);
  const [giveTo, setGiveTo] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!catalog || !me) return null;
  const sparks = me.sparks;
  const price = catalog.onSale.spark;
  const act = async (key: string, fn: () => Promise<void>) => {
    setWorking(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : uiText("billing.interface.couldn_t_change_that_spark_811b0bf"));
    } finally {
      setWorking(null);
    }
  };
  const levels = catalog.spark.levels.filter((l) => l.level > 0);
  return (
    <section className="mojo-sparks" aria-labelledby="mojo-sparks-title">
      <div className="spark-hero">
        <span className="mojo-banner-icon" aria-hidden="true">
          <Gem size={26} />
        </span>
        <h2 className="mojo-h2" id="mojo-sparks-title">
          {l10n("settings.settings_spark")}
        </h2>
        <p>
          <Localized k="billing.interface.give_a_spark_to_a_server_you_love_every_spark_helps_unlock_more_e_2063c49" />
        </p>
        <SparkTrack levels={levels} level={null} active={null} />
      </div>
      <SparkLevelCards catalog={catalog} levels={levels} level={null} />
      <p className="muted spark-note">
        <Localized k="billing.interface.a_server_s_benefits_never_lower_anyone_s_own_plan_level_1_takes_s_d659820" slots={[levels[0]?.sparks ?? 2, levels[1]?.sparks ?? 5, levels[2]?.sparks ?? 8]} />
      </p>

      <div className="card setting-card spark-mine">
        <div className="setting-card-head">
          <span className="spark-count" aria-hidden="true">
            {formatUiNumber(sparks.total)}
          </span>
          <span className="lines grow">
            <strong>
              <Localized k="billing.interface.your_sparks_ac4e63d" />
            </strong>
            <small>
              {sparks.total === 0
                ? uiText("billing.interface.you_have_no_sparks_yet_6448e50")
                : uiText("billing.interface.value0_with_your_plan_value1_value2_free_to_give_304c5e9", {
                    value0: sparks.included,
                    value1: sparks.purchased ? uiText("billing.interface.and_bought_d840afa", { value0: sparks.purchased }) : "",
                    value2: sparks.free,
                  })}
            </small>
          </span>
        </div>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        {sparks.assignments.length > 0 && (
          <ul className="spark-list">
            {sparks.assignments.map((a) => (
              <li key={a.id}>
                <Sparkles size={15} aria-hidden="true" />
                <span className="grow">
                  {a.orgName ?? uiText("billing.interface.a_community_72c1676")}
                  {a.paused && (
                    <span className="tag">
                      <Localized k="billing.interface.paused_your_plan_has_fewer_sparks_now_3f21ea9" />
                    </span>
                  )}
                  {!a.member && (
                    <span className="tag">
                      <Localized k="billing.interface.you_left_this_community_it_doesn_t_count_there_16b2609" />
                    </span>
                  )}
                </span>
                <select
                  className="input input-sm"
                  aria-label={uiText("billing.interface.move_the_spark_in_value0_5c0f2db", { value0: a.orgName ?? uiText("billing.interface.this_community_7a0984f") })}
                  value=""
                  disabled={working !== null || offline}
                  onChange={(e) => e.target.value && void act(a.id, () => engine.mojo.moveSpark(a.id, e.target.value))}
                >
                  <option value="">
                    <Localized k="organization.interface.move_to_5af2f53" />
                  </option>
                  {orgs
                    .filter((o) => o.id !== a.orgId)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                </select>
                <button className="btn btn-ghost btn-sm" disabled={working !== null || offline} onClick={() => void act(a.id, () => engine.mojo.removeSpark(a.id))}>
                  {working === a.id ? "…" : uiText("billing.interface.take_back_7d2a64f")}
                </button>
              </li>
            ))}
          </ul>
        )}
        {sparks.free > 0 && orgs.length > 0 && (
          <div className="row spark-give">
            <select className="input" aria-label={uiText("billing.interface.community_to_give_a_spark_to_107b80f")} value={giveTo} onChange={(e) => setGiveTo(e.target.value)}>
              <option value="">
                <Localized k="billing.interface.choose_a_community_863ad20" />
              </option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" disabled={!giveTo || working !== null || offline} onClick={() => void act("give", () => engine.mojo.giveSpark(giveTo))}>
              {working === "give" ? uiText("billing.interface.giving_2dc14f5") : uiText("billing.interface.give_a_spark_ec29de8")}
            </button>
          </div>
        )}
        <div className="row spark-buy">
          <span className="grow">
            <strong>
              <Localized k="billing.interface.get_more_sparks_a53e0ef" />
            </strong>
            <small className="muted" style={{ display: "block" }}>
              {price
                ? uiText("billing.interface.value0_per_spark_paid_once_no_meldiq_plus_subscription_or_automat_8804a34", { value0: money(price.amountMinor, price.currency) })
                : uiText("billing.interface.sparks_are_purchased_separately_from_meldiq_plus_8c36b73")}
              {sparks.subscription ? uiText("billing.interface.existing_subscription_value0_sparks_manage_it_in_billing_9a3b27e", { value0: sparks.subscription.quantity }) : ""}
            </small>
          </span>
          {
            <>
              <div className="stepper" role="group" aria-label={uiText("billing.interface.how_many_sparks_385c3b0")}>
                <button className="icon-btn" aria-label={uiText("billing.interface.one_fewer_49e8ab6")} disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                  <Minus size={14} />
                </button>
                <span aria-live="polite">{formatUiNumber(quantity)}</span>
                <button
                  className="icon-btn"
                  aria-label={uiText("billing.interface.one_more_08c3eb6")}
                  disabled={quantity >= catalog.spark.maxPurchase}
                  onClick={() => setQuantity((q) => Math.min(catalog.spark.maxPurchase, q + 1))}
                >
                  <Plus size={14} />
                </button>
              </div>
              <button className="btn btn-mojo" disabled={!price || busy || offline} onClick={() => onBuy(quantity)}>
                {busy
                  ? uiText("organization.interface.opening_c926c2c")
                  : price
                    ? uiText("billing.interface.buy_for_value0_once_ddfb4d7", { value0: money(price.amountMinor * quantity, price.currency) })
                    : uiText("billing.interface.not_on_sale_yet_b2d293b")}
              </button>
            </>
          }
        </div>
      </div>
    </section>
  );
}
