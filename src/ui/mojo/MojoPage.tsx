import { billingPlanName } from "../../i18n/billing";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { interfaceLocale } from "../../i18n/format";
import { useT as useLocalization } from "../../i18n";
import { Crown, Gem, Gift, HeartHandshake, Loader2, Sparkles } from "lucide-react";
import { MojoBanner } from "./MojoBanner";
import { useEffect, useState } from "react";
import type { PlanPerks } from "../../api/mojoSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { relative } from "../format";
import { GiftDialog, GiftsReceived } from "./MojoGifts";
import { money, planPrice, screenLabel, size } from "./mojoFormat";
import { CompareTable, type PlanAction, PlanCards, PlusPerks } from "./MojoPlans";
import { selectCheckout } from "../billing/checkoutDraft";
import { navigate } from "../../application/router";
import { MojoBadgeMark } from "./MojoBadge";
/** Where a payment page sends the person back (?checkout= or ?gift=), read once. */
function returnedFrom(): "checkout" | "gift" | "canceled" | null {
  const q = new URLSearchParams(window.location.search);
  if (q.get("checkout") === "success") return "checkout";
  if (q.get("gift") === "success") return "gift";
  if (q.get("checkout") === "canceled" || q.get("gift") === "canceled") return "canceled";
  return null;
}
/**
 * Settings › Meldiq Plus (server docs/MOJO.md): the plans, what each gives, Sparks, gifts and the badge. Every number
 * comes from the server's catalog, and every button asks the server, which asks the payment provider: nothing here
 * grants anything.
 */
export function MojoPage() {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const mojo = useOrbit((s) => s.mojo);
  const online = useOrbit((s) => s.connection === "online");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gifting, setGifting] = useState(false);
  const [confirming, setConfirming] = useState<"checkout" | "gift" | null>(null);
  useEffect(() => {
    const back = returnedFrom();
    if (back) {
      // The query is the payment page's; the plan itself arrives with the provider's signed event.
      window.history.replaceState(window.history.state, "", window.location.pathname);
      if (back === "canceled") engine.notice("info", uiText("billing.interface.checkout_was_closed_check_billing_for_the_latest_payment_status_c8e711e"));
      else {
        setConfirming(back);
        void engine.mojo.afterReturn().finally(() => setConfirming(null));
      }
    } else void engine.mojo.refresh();
  }, [engine]);
  const open = async (what: string, start: () => Promise<string | null>) => {
    setBusy(what);
    setError(null);
    try {
      const url = await start();
      if (url) window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : uiText("billing.interface.couldn_t_open_the_payment_page_nothing_was_charged_679d717"));
    } finally {
      setBusy(null);
    }
  };
  const { catalog, me, billing } = mojo;
  if (!catalog || !me) {
    return (
      <>
        <h1>Meldiq Plus</h1>
        {mojo.error ? (
          <div className="banner danger" role="alert">
            <span className="grow">{mojo.error}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => void engine.mojo.refresh()}>
              {l10n("common.actions.retry")}
            </button>
          </div>
        ) : (
          <div className="mojo-loading" role="status">
            <Localized k="billing.interface.loading_meldiq_plus_0d96dea" slots={[<Loader2 size={18} className="spin" aria-hidden="true" />]} />
          </div>
        )}
      </>
    );
  }
  const paid = billing?.subscription ?? null;
  const offline = !online;
  const plus = catalog.plans.find((p) => p.key === "plus");
  const free = catalog.plans.find((p) => p.key === "free");
  const plusPrice = planPrice(catalog, "plus");
  /** The one button under a plan: buy it, manage it, or say why not. */
  const actionFor = (p: PlanPerks): PlanAction => {
    const price = planPrice(catalog, p.key);
    const current = me.plan === p.key;
    if (p.key === "free") return { label: current ? uiText("billing.interface.your_plan_d9ab76c") : uiText("billing.interface.always_free_0a635c3"), kind: "secondary", disabled: true };
    if (current && paid)
      return {
        get label() {
          return uiText("billing.interface.manage_subscription_9041c6a");
        },
        kind: "secondary",
        disabled: false,
        onClick: () => navigate({ section: "settings", settingsPage: "billing" }),
      };
    if (current && billing?.provider === "paypal" && price.onSale)
      return {
        label: uiText("billing.interface.subscribe_for_value0_month_9513673", { value0: price.label }),
        kind: "mojo",
        disabled: offline || busy !== null,
        onClick: () => {
          selectCheckout(engine.device.userId, { product: "plus" });
          navigate({ section: "settings", settingsPage: "checkout" });
        },
      };
    if (current)
      return {
        get label() {
          return uiText("billing.interface.your_plan_a_free_period_b58c420");
        },
        kind: "secondary",
        disabled: true,
      };
    return {
      label:
        busy === p.key
          ? uiText("organization.interface.opening_c926c2c")
          : !price.onSale
            ? uiText("billing.interface.not_on_sale_yet_b2d293b")
            : paid
              ? uiText("billing.interface.switch_from_the_billing_page_048bfaf")
              : uiText("billing.interface.get_value0_for_value1_month_1baf5cd", { value0: p.name, value1: price.label }),
      kind: p.key === "plus" ? "mojo" : "primary",
      disabled: !price.onSale || busy !== null || offline || (!!paid && me.plan !== "free"),
      onClick: () => {
        if (billing?.provider === "paypal") {
          selectCheckout(engine.device.userId, { product: "plus" });
          navigate({ section: "settings", settingsPage: "checkout" });
        } else void open(p.key, () => engine.mojo.checkout(p.key as "go" | "plus"));
      },
    };
  };
  const heroAction = plus && me.plan !== "plus" && plusPrice.onSale ? actionFor(plus) : null;
  return (
    <div className="mojo">
      <h1>Meldiq Plus</h1>
      {billing?.provider === "paypal" && (
        <button className="btn btn-secondary btn-sm" onClick={() => navigate({ section: "settings", settingsPage: "billing" })}>
          <Localized k="billing.interface.billing_purchases_3a698f7" />
        </button>
      )}
      {confirming && (
        <div className="banner info" role="status">
          <Localized
            k="billing.interface.meldiq_plus_applies_the_moment_the_payment_provider_confirms_it_7b73d82"
            slots={[
              <Loader2 size={16} className="spin" aria-hidden="true" />,
              confirming === "gift" ? uiText("billing.interface.confirming_your_gift_with_the_payment_provider_241a79c") : uiText("billing.interface.confirming_your_payment_a29081a"),
            ]}
          />
        </div>
      )}
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      {!catalog.onSale.go && !catalog.onSale.plus && (
        <div className="banner info" role="note">
          <Localized k="billing.interface.meldiq_plus_isn_t_on_sale_yet_everything_below_is_what_each_plan_80e94c4" />
        </div>
      )}
      {catalog.onSale.mode === "test" && (
        <div className="banner info" role="note">
          <Localized k="billing.interface.payments_are_in_test_mode_no_real_money_is_taken_99df214" />
        </div>
      )}

      {me.plan === "plus" && paid && (
        <div className="banner info" role="note">
          <Localized k="billing.interface.your_existing_billing_agreement_keeps_its_current_price_the_price_5dd571e" />
        </div>
      )}
      <section className="mojo-hero" aria-labelledby="mojo-hero-title">
        <div className="mojo-hero-text">
          <span className="mojo-eyebrow">
            <Sparkles size={15} aria-hidden="true" /> Meldiq Plus
          </span>
          <h2 id="mojo-hero-title">
            <Localized
              k="billing.interface.free_to_talk_8146c75"
              slots={[
                <span className="mojo-glow">
                  <Localized k="billing.interface.meldiq_plus_to_go_further_55d9ead" />
                </span>,
              ]}
            />
          </h2>
          <p>
            <Localized k="billing.interface.talking_calling_sharing_and_communities_are_free_and_stay_free_me_093c5e2" />
          </p>
        </div>
        <div className="mojo-hero-plan" aria-label={uiText("billing.interface.your_plan_d9ab76c")}>
          <span className="faint">
            <Localized k="billing.interface.you_re_on_3a4f400" />
          </span>
          <strong>
            {billingPlanName(me.perks.name)} {me.badge.kind && <MojoBadgeMark badge={me.badge.kind} check={me.badge.check} />}
          </strong>
          <small>
            {paid
              ? paid.cancelAtPeriodEnd
                ? uiText("billing.interface.ends_value0_8bd4ae7", { value0: relative(paid.currentPeriodEnd ?? Date.now()) })
                : uiText("billing.interface.renews_value0_c8ef4eb", { value0: relative(paid.currentPeriodEnd ?? Date.now()) })
              : me.plan === "free"
                ? uiText("billing.interface.free_for_as_long_as_you_like_708defa")
                : uiText("billing.interface.a_free_period_nothing_renews_3fd74ff")}
          </small>
        </div>
      </section>

      {heroAction && (
        <button className="btn btn-lg btn-mojo mojo-cta" disabled={heroAction.disabled} onClick={heroAction.onClick}>
          {heroAction.label}
        </button>
      )}
      <button className="mojo-gift-entry" disabled={!catalog.onSale.gifts || offline} onClick={() => setGifting(true)}>
        <span className="mojo-gift-icon" aria-hidden="true">
          <Gift size={18} />
        </span>
        <span className="lines grow">
          <strong>
            <Localized k="billing.interface.gift_meldiq_plus_to_a_friend_bce5bc8" />
          </strong>
          <small>
            {catalog.onSale.gifts
              ? uiText("billing.interface.one_payment_for_1_3_or_12_months_straight_to_their_account_with_a_1b4c517")
              : uiText("billing.interface.gifts_open_when_meldiq_plus_goes_on_sale_19ff816")}
          </small>
        </span>
      </button>
      <GiftsReceived me={me} />

      <h2 className="mojo-h2">
        <Localized k="billing.interface.choose_your_plan_6029066" />
      </h2>
      <p className="muted">
        <Localized k="billing.interface.meldiq_free_and_meldiq_plus_choose_monthly_3_month_or_yearly_plus_591240b" />
      </p>
      <PlanCards catalog={catalog} me={me} actionFor={actionFor} />
      <p className="mojo-terms muted">
        <Localized k="billing.interface.meldiq_plus_renews_at_the_price_and_interval_chosen_at_checkout_u_49b3440" />
      </p>

      <MojoBanner icon={<Crown size={26} />} title="Meldiq Plus" line={uiText("billing.interface.the_biggest_files_the_sharpest_streams_two_sparks_and_the_pl_4b92f5e")} />
      <h2 className="mojo-h2">
        <Localized k="billing.interface.what_meldiq_plus_adds_05cbaac" />
      </h2>
      <PlusPerks catalog={catalog} />

      <h2 className="mojo-h2">
        <Localized k="billing.interface.compare_plans_30d9abf" />
      </h2>
      <CompareTable catalog={catalog} me={me} />

      <section className="spark-hero spark-link" aria-labelledby="mojo-spark-link">
        <h2 className="mojo-h2" id="mojo-spark-link">
          <Gem size={20} aria-hidden="true" /> {l10n("settings.settings_spark")}
        </h2>
        <p>
          <Localized k="billing.interface.boost_the_servers_you_love_every_spark_helps_a_community_unlock_m_ea6c212" />
        </p>
        <div>
          <button className="btn btn-mojo" onClick={() => navigate({ section: "settings", settingsPage: "spark" })}>
            <Localized k="billing.interface.open_meldiq_spark_1eb51b9" slots={[<Gem size={15} aria-hidden="true" />]} />
          </button>
        </div>
      </section>

      {me.badge.kind && (
        <section className="card setting-card" aria-label={uiText("billing.interface.your_badge_f92308f")}>
          <div className="setting-card-head">
            <span className="lines grow">
              <strong>
                <Localized k="billing.interface.your_badge_578ca03" slots={[<MojoBadgeMark badge={me.badge.kind} check={me.badge.check} />]} />
              </strong>
              <small>
                {me.badge.hidden
                  ? uiText("billing.interface.hidden_people_don_t_see_it_your_plan_doesn_t_change_31421e2")
                  : uiText("billing.interface.shown_next_to_your_name_in_member_lists_and_on_your_profile_836d2ad")}
              </small>
            </span>
            <button className="btn btn-secondary btn-sm" disabled={busy !== null || offline} onClick={() => void open("badge", async () => (await engine.mojo.setBadgeHidden(!me.badge.hidden), null))}>
              {me.badge.hidden ? uiText("billing.interface.show_it_74484e0") : uiText("billing.interface.hide_it_4c3e804")}
            </button>
          </div>
        </section>
      )}

      <section className="mojo-why" aria-labelledby="mojo-why">
        <span className="mojo-perk-icon" aria-hidden="true">
          <HeartHandshake size={20} />
        </span>
        <div className="lines">
          <h2 id="mojo-why">
            <Localized k="billing.interface.why_subscriptions_2585780" />
          </h2>
          <p>
            <Localized k="billing.interface.we_believe_in_a_free_and_open_internet_supporting_meldiq_through_a9250d2" />
          </p>
        </div>
      </section>
      {free && (
        <p className="mojo-free-note muted">
          <Localized
            k="billing.interface.still_free_for_everyone_messages_up_to_characters_files_up_to_voi_a19dd47"
            slots={[free.messageChars.toLocaleString(interfaceLocale()), size(free.uploadBytes), screenLabel(catalog, free.screen), free.customItems]}
          />
        </p>
      )}
      {gifting && (
        <GiftDialog
          catalog={catalog}
          flexible={billing?.provider === "paypal"}
          onClose={() => setGifting(false)}
          onPay={async (input) => {
            if (billing?.provider === "paypal") {
              selectCheckout(engine.device.userId, {
                product: "gift",
                ...(input.recipient ? { recipient: input.recipient } : { recipientUserId: input.recipientUserId }),
                months: input.months as 1 | 3 | 12,
                note: input.note,
              });
              setGifting(false);
              navigate({ section: "settings", settingsPage: "checkout" });
            } else await open("gift", () => engine.mojo.gift(input));
          }}
          busy={busy === "gift"}
        />
      )}
      <p className="muted mojo-footnote">
        <Localized k="billing.interface.meldiq_plus_per_month_sparks_each_paid_once_90b5f45" slots={[money(plus?.listPriceMinor ?? 0, "USD"), money(catalog.spark.listPriceMinor, "USD")]} />
      </p>
    </div>
  );
}
