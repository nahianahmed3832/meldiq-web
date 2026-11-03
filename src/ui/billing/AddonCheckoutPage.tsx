import { LanguagePicker } from "../components/LanguagePicker";
import { countLabel } from "../../i18n/counts";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, CheckCircle2, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { useEngine, useOrbit } from "../../application/orbit";
import { setPrefs } from "../../application/prefs";
import { navigate } from "../../application/router";
import { type PayPalConfig, type PayPalPurchase, zPayPalCheckout, zPayPalConfig } from "../../api/paypalSchemas";
import { BrandMark } from "../components/BrandMark";
import { money } from "../mojo/mojoFormat";
import { type CheckoutDraft, readCheckout, selectCheckout, writeCheckout } from "./checkoutDraft";
import { usePayPalCardSdk } from "./PayPalCardButton";
import { CheckoutPaymentButton } from "./CheckoutPaymentButton";
import { PaymentMethods, type PaymentMethod } from "./PaymentMethods";
type Addon = Extract<
  CheckoutDraft,
  {
    product: "spark" | "bots_plus";
  }
>;
export function AddonCheckoutPage({ draft, initial }: { draft: Addon; initial: ReturnType<typeof readCheckout> }) {
  useLocaleRender();

  const engine = useEngine();
  const online = useOrbit((s) => s.connection === "online");
  const catalog = useOrbit((s) => s.mojo.catalog);
  const community = useOrbit((s) => (draft.product === "bots_plus" ? (s.orgs.find((org) => org.id === draft.orgId)?.name ?? uiText("billing.interface.this_community_7a0984f")) : null));
  const saved = useRef(initial);
  const [config, setConfig] = useState<PayPalConfig | null>(null);
  const [purchase, setPurchase] = useState<PayPalPurchase | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("paypal");
  const [checking, setChecking] = useState(false);
  const [awaiting, setAwaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const spark = draft.product === "spark";
  const cards = usePayPalCardSdk(config, !spark, attempt);
  const quantity = spark ? draft.quantity : 1;
  const price = spark ? catalog?.onSale.spark : catalog?.onSale.botsPlus;
  const amount = (price?.amountMinor ?? (spark ? 99 : 399)) * quantity;
  const title = spark ? countLabel(quantity, "meldiqSparks") : "Meldiq Bots+";
  const product = draft.product;
  const orgId = draft.product === "bots_plus" ? draft.orgId : null;
  const remember = useCallback(
    (p: PayPalPurchase) => {
      saved.current = { ...saved.current, purchaseId: p.id, completed: p.confirmed || ["expired", "failed", "refunded", "canceled", "incomplete_expired"].includes(p.status) };
      writeCheckout(engine.device.userId, saved.current);
      setPurchase(p);
    },
    [engine],
  );
  const validate = useCallback(
    (p: PayPalPurchase) => {
      if (
        p.product !== product ||
        p.currency !== "USD" ||
        p.interval !== (product === "spark" ? "one_time" : "month") ||
        p.amountMinor !== amount ||
        (product === "spark" && p.quantity !== quantity) ||
        (product === "bots_plus" && p.orgId !== orgId)
      ) {
        throw new Error(uiText("billing.interface.the_order_changed_return_to_the_product_page_and_review_a_new_che_41eef4f"));
      }
      return p;
    },
    [product, amount, quantity, orgId],
  );
  useEffect(() => {
    let active = true;
    void engine.api
      .json("GET", "/v2/billing/paypal/config", zPayPalConfig)
      .then((value) => active && setConfig(value))
      .catch(() => active && setError(uiText("billing.interface.secure_checkout_could_not_load_try_again_9832920")));
    return () => {
      active = false;
    };
  }, [engine, attempt]);
  useEffect(() => {
    let active = true;
    if (saved.current.purchaseId)
      void engine.api
        .json("GET", `/v2/billing/paypal/checkouts/${encodeURIComponent(saved.current.purchaseId)}`, zPayPalCheckout)
        .then((value) => {
          if (active) remember(validate(value));
        })
        .catch(() => active && setError(uiText("billing.interface.this_checkout_could_not_be_resumed_review_its_status_in_billing_fe9d668")));
    return () => {
      active = false;
    };
  }, [engine, attempt, remember, validate]);
  const check = useCallback(
    async (capture: boolean) => {
      const id = saved.current.purchaseId;
      if (!id) return;
      setChecking(true);
      setError(null);
      try {
        const result = validate(await engine.api.json(capture ? "POST" : "GET", `/v2/billing/paypal/checkouts/${encodeURIComponent(id)}${capture ? "/confirm" : ""}`, zPayPalCheckout));
        remember(result);
        if (result.confirmed) {
          setAwaiting(false);
          await engine.mojo.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : uiText("billing.interface.payment_confirmation_could_not_be_checked_0f3db0f"));
      } finally {
        setChecking(false);
      }
    },
    [engine, remember, validate],
  );
  useEffect(() => {
    if (!awaiting || purchase?.confirmed) return;
    let stopped = false;
    let count = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (stopped) return;
      await check(false);
      if (!stopped && ++count < 6) timer = setTimeout(() => void poll(), 5000);
      else if (!stopped) setAwaiting(false);
    };
    // Six checks over 30 seconds leave room for refreshes within the API's 10/minute limit.
    timer = setTimeout(() => void poll(), 5000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [awaiting, purchase?.confirmed, check]);
  const create = async () => {
    setError(null);
    if (!accepted || !online || !price || price.currency !== "USD") throw new Error(uiText("billing.interface.review_the_order_before_paying_1787d31"));
    const current = saved.current;
    const result = validate(
      current.purchaseId
        ? await engine.api.json("GET", `/v2/billing/paypal/checkouts/${encodeURIComponent(current.purchaseId)}`, zPayPalCheckout)
        : await engine.api.json("POST", "/v2/billing/paypal/checkouts", zPayPalCheckout, { body: { ...draft, requestKey: current.requestKey } }),
    );
    remember(result);
    if (["expired", "failed", "refunded", "canceled", "incomplete_expired"].includes(result.status) && !result.confirmed)
      throw new Error(uiText("billing.interface.this_checkout_has_ended_start_a_new_checkout_to_continue_4331837"));
    if (result.confirmed) throw new Error(uiText("billing.interface.this_purchase_is_already_confirmed_open_billing_to_view_it_389c118"));
    return result;
  };
  const closed = purchase && !purchase.confirmed && ["expired", "failed", "refunded", "canceled", "incomplete_expired"].includes(purchase.status);
  const enabled = config && (spark ? config.sparks : config.botsPlus) && price?.currency === "USD";
  const back = () => {
    if (draft.product === "bots_plus") {
      setPrefs({ orgId: draft.orgId });
      navigate({ section: "workspace", workspacePage: "bots" });
    } else navigate({ section: "settings", settingsPage: "spark" });
  };
  return (
    <div className="meldiq-checkout">
      <header className="checkout-brand">
        <div className="checkout-logo">
          <BrandMark size={34} />
          <strong>Meldiq</strong>
        </div>
        <span>
          <Localized k="billing.interface.secure_checkout_074e5f6" slots={[<LockKeyhole size={14} aria-hidden="true" />]} />
        </span>
        <LanguagePicker />
      </header>
      <button className="btn btn-ghost btn-sm checkout-back" onClick={back}>
        <ArrowLeft size={15} aria-hidden="true" /> {spark ? uiText("billing.interface.back_to_sparks_f909467") : uiText("billing.interface.back_to_community_bots_2aedfb4")}
      </button>
      {purchase?.confirmed ? (
        <section className="checkout-success" role="status">
          <CheckCircle2 size={52} aria-hidden="true" />
          <span className="checkout-kicker">
            <Localized k="billing.interface.all_set_78b4588" />
          </span>
          <h1>{spark ? uiText("billing.interface.your_sparks_are_ready_11373a3") : uiText("billing.interface.bots_is_active_a8ecf5e")}</h1>
          <p>
            {spark
              ? uiText("billing.interface.choose_a_community_to_boost_your_purchased_sparks_do_not_renew_or_1c4d3fd")
              : uiText("billing.interface.premium_bot_features_are_now_available_for_value0_4f08dda", { value0: community })}
          </p>
          <p className="muted">
            <Localized
              k="billing.interface.paypal_reference_3ebc893"
              slots={[
                money(purchase.amountMinor, purchase.currency),
                purchase.currency,
                spark ? uiText("billing.interface.one_time_payment_784a8ce") : uiText("billing.interface.monthly_9169e3c"),
                <br />,
                <code>{purchase.providerRef}</code>,
              ]}
            />
          </p>
          <button className="btn btn-mojo" onClick={back}>
            {spark ? uiText("billing.interface.use_your_sparks_4b04ce5") : uiText("billing.interface.open_community_bots_113cba2")}
          </button>
        </section>
      ) : (
        <>
          <div className="checkout-title">
            <span className="checkout-kicker">
              <Localized k="billing.interface.more_for_your_community_84c22c2" slots={[<Sparkles size={14} aria-hidden="true" />]} />
            </span>
            <h1>{title}</h1>
            <p>
              {spark
                ? uiText("billing.interface.boost_communities_with_a_one_time_purchase_no_meldiq_plus_subscri_09a3973")
                : uiText("billing.interface.premium_community_bots_for_value0_purchased_separately_from_meldi_8088202", { value0: community })}
            </p>
          </div>
          <div className="checkout-layout">
            <div className="checkout-payment">
              <section className="checkout-card" aria-labelledby="addon-payment-title">
                <div className="checkout-card-heading">
                  <span className="checkout-step">1</span>
                  <h2 id="addon-payment-title">
                    <Localized k="billing.interface.your_payment_96cd398" />
                  </h2>
                  {config?.environment === "sandbox" && (
                    <span className="checkout-sandbox">
                      <Localized k="billing.interface.sandbox_67fc624" />
                    </span>
                  )}
                </div>
                {config?.environment === "sandbox" && (
                  <p className="muted">
                    <Localized k="billing.interface.this_is_a_test_purchase_no_real_money_is_taken_3939868" />
                  </p>
                )}
                <div className="checkout-account">
                  <ShieldCheck size={21} aria-hidden="true" />
                  <div>
                    <strong>
                      <Localized k="billing.interface.your_meldiq_account_c8c5e0c" />
                    </strong>
                    <p>
                      {spark
                        ? uiText("billing.interface.your_purchased_sparks_stay_with_your_account_5b573fd")
                        : uiText("billing.interface.this_subscription_covers_value0_ef99aa2", { value0: community })}
                    </p>
                  </div>
                </div>
                <h3>
                  <Localized k="billing.interface.payment_method_b948ac0" />
                </h3>
                <PaymentMethods
                  value={method}
                  cardStatus={cards.status}
                  retry={() => setAttempt((value) => value + 1)}
                  onChange={(value) => {
                    setMethod(value);
                    setError(null);
                  }}
                />
                <p className="checkout-security">
                  <LockKeyhole size={15} aria-hidden="true" />
                  <span>
                    <Localized k="billing.interface.paypal_handles_your_payment_authorization_meldiq_never_sees_your_753e77f" />
                  </span>
                </p>
                <label className="checkout-agreement">
                  <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
                  <span>
                    <Localized
                      k="billing.interface.and_agree_to_the_and_and_have_read_the_ecba6c2"
                      slots={[
                        spark
                          ? uiText("billing.interface.i_understand_this_is_a_one_time_payment_a3a3ad8")
                          : uiText("billing.interface.i_agree_to_the_monthly_subscription_and_cancellation_terms_368d68d"),
                        <a href="https://meldiq.app/legal/terms" target="_blank" rel="noopener noreferrer">
                          <Localized k="billing.interface.terms_of_service_4afa55b" />
                        </a>,
                        <a href="https://meldiq.app/legal/billing" target="_blank" rel="noopener noreferrer">
                          <Localized k="billing.interface.payment_terms_37281b4" />
                        </a>,
                        <a href="https://meldiq.app/legal/privacy" target="_blank" rel="noopener noreferrer">
                          <Localized k="billing.interface.privacy_policy_506ff39" />
                        </a>,
                      ]}
                    />
                  </span>
                </label>
                {error && (
                  <p className="banner danger" role="alert">
                    {error}
                  </p>
                )}
                {!online && (
                  <p className="muted" role="status">
                    <Localized k="billing.interface.reconnect_to_continue_checkout_54f308e" />
                  </p>
                )}
                {catalog && !price && (
                  <p className="muted" role="status">
                    <Localized k="billing.interface.this_product_is_not_available_for_checkout_yet_446bcaa" />
                  </p>
                )}
                {config && price && !enabled && (
                  <p className="muted" role="status">
                    <Localized k="billing.interface.paypal_is_not_available_for_this_product_yet_a74cf6d" />
                  </p>
                )}
                {!accepted && (
                  <p className="checkout-hint">
                    <Localized k="billing.interface.agree_to_the_terms_to_continue_to_payment_4eaafb7" />
                  </p>
                )}
                {enabled && accepted && online && !closed && (
                  <CheckoutPaymentButton
                    key={attempt}
                    config={config}
                    method={method}
                    cardSdk={cards.sdk}
                    cardStatus={cards.status}
                    subscription={!spark}
                    cardProduct="bots_plus"
                    cardOrgId={orgId ?? undefined}
                    create={create}
                    approve={async () => {
                      setAwaiting(true);
                      await check(true);
                    }}
                    cancel={() => setError(uiText("billing.interface.checkout_was_canceled_nothing_is_granted_until_payment_is_confirm_9dae3f7"))}
                    fail={setError}
                  />
                )}
                {purchase && !closed && (
                  <p role="status" className="muted">
                    {awaiting
                      ? uiText("billing.interface.waiting_for_payment_confirmation_7442693")
                      : uiText("billing.interface.your_payment_is_awaiting_confirmation_you_can_safely_check_its_st_0e79b87")}
                  </p>
                )}
                {saved.current.purchaseId && (
                  <button className="btn btn-secondary checkout-check" disabled={checking || !online} onClick={() => void check(false)}>
                    {checking ? uiText("common.common_checking") : uiText("billing.interface.check_payment_status_ae1b6f5")}
                  </button>
                )}
                {closed && (
                  <button className="btn btn-secondary" onClick={() => selectCheckout(engine.device.userId, draft)}>
                    <Localized k="billing.interface.start_a_new_checkout_0b5e45e" />
                  </button>
                )}
                {error && !closed && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setError(null);
                      setAwaiting(false);
                      setAttempt((value) => value + 1);
                    }}
                  >
                    <Localized k="billing.interface.retry_checkout_432aaf4" />
                  </button>
                )}
              </section>
              <div className="checkout-trust">
                <ShieldCheck size={18} aria-hidden="true" />
                <p>
                  <Localized
                    k="billing.interface.securely_processed_by_paypal_f2f8fea"
                    slots={[
                      <br />,
                      <span>
                        <Localized k="billing.interface.benefits_begin_after_payment_is_verified_2b4861b" />
                      </span>,
                    ]}
                  />
                </p>
              </div>
            </div>
            <aside className="checkout-card checkout-summary" aria-labelledby="addon-summary-title">
              <div className="checkout-card-heading">
                <span className="checkout-step">2</span>
                <h2 id="addon-summary-title">
                  <Localized k="billing.interface.order_summary_6c200a8" />
                </h2>
              </div>
              <div className="checkout-plan-art">
                <span>{spark ? <Sparkles size={30} aria-hidden="true" /> : <Bot size={30} aria-hidden="true" />}</span>
                <span className="checkout-kicker">{spark ? uiText("billing.interface.meldiq_spark_ec1690b") : uiText("billing.interface.community_bots_aaae633")}</span>
                <h3>{spark ? countLabel(quantity, "sparks") : uiText("billing.interface.bots_475bc2f")}</h3>
                <p>{spark ? uiText("billing.interface.more_for_the_communities_you_love_1cec053") : community}</p>
              </div>
              <dl className="checkout-breakdown">
                <div>
                  <dt>{spark ? uiText("billing.interface.per_spark_33b63eb") : uiText("billing.interface.monthly_subscription_619b767")}</dt>
                  <dd>{price ? money(price.amountMinor, price.currency) : uiText("common.status.loading")}</dd>
                </div>
                {spark && (
                  <div>
                    <dt>
                      <Localized k="billing.interface.quantity_822bab8" />
                    </dt>
                    <dd>{quantity}</dd>
                  </div>
                )}
                <div className="checkout-total">
                  <dt>
                    <Localized
                      k="billing.interface.total_today_1606eb3"
                      slots={[<small>{spark ? uiText("billing.interface.one_time_purchase_905ac4e") : uiText("billing.interface.renews_monthly_35088e2")}</small>]}
                    />
                  </dt>
                  <dd>
                    {price ? money(amount, price.currency) : "—"}
                    <small>
                      <Localized k="billing.interface.usd_a26cdf3" />
                    </small>
                  </dd>
                </div>
              </dl>
              <p className="checkout-renewal">
                {spark
                  ? uiText("billing.interface.0_99_per_spark_no_automatic_renewal_or_expiry_use_a_spark_in_one_0bfba21")
                  : uiText("billing.interface.3_99_per_month_for_this_community_renews_until_canceled_manage_re_54c148f")}
              </p>
              <p className="checkout-fees">
                <Localized k="billing.interface.billed_in_usd_your_payment_provider_may_apply_currency_conversion_7756a7d" />
              </p>
            </aside>
          </div>
          <footer className="checkout-footer">
            <BrandMark size={22} />
            <span>
              <Localized k="billing.interface.more_connection_more_meldiq_0b490cd" />
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate({ section: "settings", settingsPage: "billing" })}>
              <Localized k="billing.interface.billing_3ac8bbc" />
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
