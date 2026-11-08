import { LanguagePicker } from "../components/LanguagePicker";
import { formatUnit } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { interfaceLocale } from "../../i18n/format";
import { useT as useLocalization } from "../../i18n";
import { CHECKOUT_DRAFT_EVENT, restoreCheckout } from "./checkoutDraft";
import { AddonCheckoutPage } from "./AddonCheckoutPage";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Crown, Gift, LockKeyhole, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { type PayPalConfig, type PayPalPurchase, zPayPalCheckout } from "../../api/paypalSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { BrandMark } from "../components/BrandMark";
import { money, size } from "../mojo/mojoFormat";
import { readCheckout, writeCheckout, selectCheckout } from "./checkoutDraft";
import { usePayPalCardSdk } from "./PayPalCardButton";
import { CheckoutPaymentButton } from "./CheckoutPaymentButton";
import { ExpressPayPal, PaymentMethods, type PaymentMethod } from "./PaymentMethods";
import { fetchPayPalCheckoutConfig } from "./checkoutConfig";
const billing = () => navigate({ section: "settings", settingsPage: "billing" });
const endedStatuses = new Set(["expired", "incomplete_expired", "canceled", "failed", "refunded"]);
/** Meldiq owns the review and confirmation. The API owns pricing, payment verification and all entitlements. */
function PlusCheckoutPage({ initial }: { initial: ReturnType<typeof readCheckout> }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const catalog = useOrbit((s) => s.mojo.catalog);
  const online = useOrbit((s) => s.connection === "online");
  const userId = engine.device.userId;
  const [saved, setSaved] = useState(() => initial);
  const savedRef = useRef(saved);
  const [config, setConfig] = useState<PayPalConfig | null>(null);
  const [purchase, setPurchase] = useState<PayPalPurchase | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("paypal");
  const agreement = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const chooseMethod = (value: PaymentMethod) => {
    setMethod(value);
    setError(null);
  };
  const draft = saved.draft;
  const gift = draft.product === "gift";
  const cards = usePayPalCardSdk(config, !gift, attempt);
  const recipientId = gift ? (draft.recipient?.kind === "user" ? draft.recipient.userId : draft.recipientUserId) : undefined;
  const recipient = useOrbit((s) =>
    recipientId ? (s.users[recipientId]?.displayName ?? recipientId) : gift && draft.recipient?.kind === "email" ? draft.recipient.email : uiText("billing.interface.a_gift_link_621520a"),
  );
  const selectedTerm = draft.product === "plus" ? (draft.term ?? "monthly") : "monthly";
  const termOffer = catalog?.plusTerms.find((t) => (gift ? t.months === draft.months : t.key === selectedTerm));
  const price = gift ? (catalog?.onSale.gifts ? catalog.onSale.plus : null) : selectedTerm === "monthly" ? catalog?.onSale.plus : termOffer?.available ? termOffer : null;
  const amount = purchase?.amountMinor ?? (gift ? (termOffer?.amountMinor ?? (price?.amountMinor ?? 0) * draft.months) : (termOffer?.amountMinor ?? price?.amountMinor ?? 0));
  const months = purchase && purchase.interval !== "one_time" ? (purchase.interval === "year" ? 12 : 1) * (purchase.billingFrequency ?? 1) : gift ? draft.months : (termOffer?.months ?? 1);
  const cadence = months === 1 ? uiText("billing.interface.month_a5c7d17") : formatUnit(months, "month");
  const savings = termOffer && !gift ? termOffer.savingsMinor : 0;
  const currency = purchase?.currency ?? price?.currency ?? "USD";
  const plus = catalog?.plans.find((p) => p.key === "plus");
  const sandbox = config?.environment === "sandbox";
  const deferred = !gift && config?.billingStartAt != null && config.billingStartAt > Date.now();
  const startDate = config?.billingStartAt ? new Intl.DateTimeFormat(interfaceLocale(), { dateStyle: "medium" }).format(config.billingStartAt) : null;
  const complete = purchase?.confirmed === true || (purchase?.approved === true && deferred);
  const closed = purchase != null && endedStatuses.has(purchase.status);
  const canPay = config && online && (price || purchase) && !closed && (gift || config.subscriptions);
  const remember = useCallback(
    (value: ReturnType<typeof readCheckout>) => {
      savedRef.current = value;
      setSaved(value);
      writeCheckout(userId, value);
    },
    [userId],
  );
  const verify = useCallback(
    async (capture: boolean) => {
      const id = savedRef.current.purchaseId;
      if (!id) return;
      setChecking(true);
      setError(null);
      try {
        const p = capture
          ? await engine.api.json("POST", `/v2/billing/paypal/checkouts/${encodeURIComponent(id)}/confirm`, zPayPalCheckout, { body: {} })
          : await engine.api.json("GET", `/v2/billing/paypal/checkouts/${encodeURIComponent(id)}`, zPayPalCheckout);
        setPurchase(p);
        if (p.confirmed || p.approved || endedStatuses.has(p.status)) remember({ ...savedRef.current, completed: true });
        setMessage(p.confirmed || endedStatuses.has(p.status) ? null : uiText("billing.interface.your_payment_is_still_awaiting_confirmation_you_can_safely_check_a88195c"));
        await engine.mojo.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : uiText("billing.interface.we_could_not_verify_the_payment_yet_check_its_status_before_tryin_af46a1b"));
      } finally {
        setChecking(false);
      }
    },
    [engine, remember],
  );
  useEffect(() => {
    let disposed = false;
    void fetchPayPalCheckoutConfig(engine.api)
      .then((c) => {
        if (!disposed) setConfig(c);
      })
      .catch((e: unknown) => {
        if (!disposed) {
          setConfig(null);
          setError(
            e instanceof ApiError && e.status === 404
              ? uiText("billing.interface.paypal_checkout_is_not_available_on_this_server_yet_73c03ac")
              : e instanceof Error
                ? e.message
                : uiText("billing.interface.checkout_could_not_load_9614d64"),
          );
        }
      });
    return () => {
      disposed = true;
    };
  }, [engine, attempt]);
  useEffect(() => {
    writeCheckout(userId, savedRef.current);
    void engine.mojo.refresh();
    const q = new URLSearchParams(location.search);
    const canceled = q.get("checkout") === "canceled" || q.get("gift") === "canceled";
    const returned = q.has("checkout") || q.has("gift") || q.has("token") || q.has("subscription_id");
    if (returned) history.replaceState(history.state, "", location.pathname);
    if (canceled) setMessage(uiText("billing.interface.you_closed_paypal_checkout_check_the_purchase_status_before_tryin_35eff7a"));
    // Query parameters never identify a purchase or prove payment. Only the stored, account-owned ID is used.
    if (savedRef.current.purchaseId) void verify(returned && !canceled);
  }, [engine, userId, verify]);
  const create = async () => {
    setError(null);
    setMessage(null);
    if (!accepted || !online || (!price && !purchase) || currency !== "USD") throw new Error(uiText("billing.interface.review_the_order_and_agree_to_the_terms_before_paying_c4376c2"));
    const current = savedRef.current;
    const p = current.purchaseId
      ? await engine.api.json("GET", `/v2/billing/paypal/checkouts/${encodeURIComponent(current.purchaseId)}`, zPayPalCheckout)
      : await engine.api.json("POST", "/v2/billing/paypal/checkouts", zPayPalCheckout, { body: { ...current.draft, requestKey: current.requestKey } });
    if (p.product !== (gift ? "gift" : "plus")) throw new Error(uiText("billing.interface.this_saved_purchase_is_for_another_product_review_it_in_billing_b_730afa2"));
    if (!gift && (p.interval !== (selectedTerm === "yearly" ? "year" : "month") || (p.billingFrequency ?? 1) !== (selectedTerm === "quarterly" ? 3 : 1))) {
      setAccepted(false);
      throw new Error(uiText("billing.interface.the_saved_purchase_has_a_different_billing_interval_review_or_can_fed90f8"));
    }
    remember({ ...current, purchaseId: p.id, completed: p.confirmed || p.approved === true || endedStatuses.has(p.status) });
    setPurchase(p);
    if (endedStatuses.has(p.status)) throw new Error(uiText("billing.interface.this_checkout_has_ended_start_a_new_checkout_to_continue_4331837"));
    if (p.confirmed || p.approved) throw new Error(uiText("billing.interface.this_purchase_is_already_confirmed_open_billing_to_view_it_389c118"));
    if (p.amountMinor !== amount || p.currency !== currency) {
      setAccepted(false);
      throw new Error(uiText("billing.interface.your_saved_purchase_keeps_its_original_quote_review_the_displayed_01a34f9"));
    }
    return p;
  };
  return (
    <div className="meldiq-checkout">
      <header className="checkout-brand">
        <a href="/settings/mojo" className="checkout-logo">
          <BrandMark size={34} />
          <strong>Meldiq</strong>
        </a>
        <span>
          <Localized k="billing.interface.secure_checkout_074e5f6" slots={[<LockKeyhole size={14} aria-hidden="true" />]} />
        </span>
        <LanguagePicker />
      </header>
      <button className="btn btn-ghost btn-sm checkout-back" onClick={() => navigate({ section: "settings", settingsPage: "mojo" })}>
        <Localized k="billing.interface.back_to_meldiq_plus_b7b2162" slots={[<ArrowLeft size={15} aria-hidden="true" />]} />
      </button>
      {complete ? (
        <section className="checkout-success" aria-labelledby="checkout-success-title">
          <CheckCircle2 size={52} aria-hidden="true" />
          <span className="checkout-kicker">
            <Localized k="billing.interface.all_set_78b4588" />
          </span>
          <h1 id="checkout-success-title">
            {gift
              ? uiText("billing.interface.a_little_more_meldiq_plus_gifted_8fa2097")
              : deferred && !purchase?.confirmed
                ? uiText("billing.interface.your_plus_renewal_is_scheduled_047b4e2")
                : uiText("billing.interface.welcome_to_plus_56e754e")}
          </h1>
          <p>
            {gift
              ? uiText("billing.interface.your_gift_payment_is_confirmed_your_friend_can_start_their_plus_t_ab9a233")
              : deferred && !purchase?.confirmed
                ? uiText("billing.interface.paypal_has_confirmed_your_approval_your_first_payment_is_value0_y_3063f27", { value0: startDate })
                : uiText("billing.interface.your_subscription_is_confirmed_your_plus_benefits_are_now_availab_8062d9c")}
          </p>
          <p className="muted">
            <Localized
              k="billing.interface.paypal_reference_8c99210"
              slots={[
                money(purchase!.amountMinor, purchase!.currency),
                gift ? uiText("billing.interface.one_time_payment_c973270") : uiText("billing.interface.every_value0_8973b43", { value0: cadence }),
                <br />,
                <code>{purchase?.providerRef}</code>,
              ]}
            />
          </p>
          <button className="btn btn-mojo" onClick={billing}>
            <Localized k="billing.interface.view_billing_58e216d" slots={[<ArrowRight size={16} aria-hidden="true" />]} />
          </button>
        </section>
      ) : (
        <>
          <div className="checkout-title">
            <span className="checkout-kicker">
              <Localized k="billing.interface.a_little_more_meldiq_3500966" slots={[<Sparkles size={14} aria-hidden="true" />]} />
            </span>
            <h1>{gift ? uiText("billing.interface.make_their_day_with_plus_142197d") : uiText("billing.interface.make_room_for_more_f35caed")}</h1>
            <p>{gift ? uiText("billing.interface.a_thoughtful_upgrade_for_someone_you_love_talking_to_8c4febe") : uiText("billing.interface.your_conversations_a_little_more_possibility_ba71e0b")}</p>
          </div>
          <div className="checkout-layout">
            {canPay && (
              <ExpressPayPal
                onReview={() => {
                  chooseMethod("paypal");
                  agreement.current?.focus();
                }}
              />
            )}
            <div className="checkout-payment">
              <section className="checkout-card" aria-labelledby="checkout-payment-title">
                <div className="checkout-card-heading">
                  <h2 id="checkout-payment-title">
                    <Localized k="billing.interface.your_payment_96cd398" />
                  </h2>
                  {sandbox && (
                    <span className="checkout-sandbox">
                      <Localized k="billing.interface.sandbox_67fc624" />
                    </span>
                  )}
                </div>
                {config && (
                  <p className="muted">
                    {sandbox
                      ? uiText("billing.interface.this_is_a_test_purchase_no_real_money_is_taken_3939868")
                      : deferred
                        ? uiText("billing.interface.your_existing_plus_time_stays_available_your_first_payment_is_val_b7909f9", { value0: startDate })
                        : uiText("billing.interface.review_your_purchase_before_authorizing_payment_with_paypal_5486c99")}
                  </p>
                )}
                <div className="checkout-account">
                  <ShieldCheck size={21} aria-hidden="true" />
                  <div>
                    <strong>
                      <Localized k="billing.interface.your_meldiq_account_c8c5e0c" />
                    </strong>
                    <p>
                      <Localized k="billing.interface.this_purchase_is_linked_to_the_account_you_re_signed_in_to_f34e1a7" />
                    </p>
                  </div>
                  <Check size={16} aria-hidden="true" />
                </div>
                {!gift && catalog && catalog.plusTerms.length > 0 && (
                  <fieldset className="plus-term-choices" disabled={!!purchase}>
                    <legend>
                      <Localized k="billing.interface.choose_your_billing_interval_ff6d4a2" />
                    </legend>
                    {catalog.plusTerms.map((t) => (
                      <label className={`plus-term-option${selectedTerm === t.key ? " selected" : ""}`} key={t.key}>
                        <input
                          type="radio"
                          name="plus-term"
                          checked={selectedTerm === t.key}
                          onChange={() => {
                            setAccepted(false);
                            selectCheckout(userId, { product: "plus", term: t.key });
                          }}
                        />
                        <span>
                          <strong>{t.months === 1 ? l10n("billing.monthly") : formatUnit(t.months, "month")}</strong>
                          <small>
                            <Localized
                              k="billing.interface.billed_every_45e2ceb"
                              slots={[money(t.amountMinor, t.currency), t.months === 1 ? uiText("billing.interface.month_a5c7d17") : formatUnit(t.months, "month")]}
                            />
                          </small>
                          {t.savingsMinor > 0 && (
                            <small className="plus-term-saving">
                              <Localized
                                k="billing.interface.vs_monthly_about_month_fc2ea2d"
                                slots={[l10n("common.actions.save"), money(t.savingsMinor, t.currency), t.savingsPercent, money(t.monthlyEquivalentMinor, t.currency)]}
                              />
                            </small>
                          )}
                          {!t.available && !(t.key === "monthly" && catalog.onSale.plus) && (
                            <small>
                              <Localized k="billing.interface.not_available_for_purchase_yet_fda50e8" />
                            </small>
                          )}
                        </span>
                      </label>
                    ))}
                    {purchase && (
                      <small>
                        <Localized k="billing.interface.a_pending_purchase_keeps_its_billing_interval_review_or_cancel_it_69025f3" />
                      </small>
                    )}
                  </fieldset>
                )}
                <PaymentMethods value={method} cardStatus={cards.status} retry={() => setAttempt((value) => value + 1)} onChange={chooseMethod} />
                <p className="checkout-security">
                  <LockKeyhole size={15} aria-hidden="true" />
                  <span>
                    <Localized k="billing.interface.paypal_securely_handles_payment_authorization_meldiq_never_sees_y_24415a3" />
                  </span>
                </p>
                <label className="checkout-agreement">
                  <input ref={agreement} type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                  <span>
                    <Localized
                      k="billing.interface.i_agree_to_the_and_have_read_the_0182142"
                      slots={[
                        <a href="https://meldiq.app/legal/terms" target="_blank" rel="noreferrer">
                          <Localized k="billing.interface.terms_of_service_4afa55b" />
                        </a>,
                        l10n("messaging.meldling_and"),
                        <a href="https://meldiq.app/legal/billing" target="_blank" rel="noreferrer">
                          <Localized k="billing.interface.subscription_terms_0220f09" />
                        </a>,
                        <a href="https://meldiq.app/legal/privacy" target="_blank" rel="noreferrer">
                          <Localized k="billing.interface.privacy_policy_506ff39" />
                        </a>,
                      ]}
                    />
                  </span>
                </label>
                {error && (
                  <div className="banner danger" role="alert">
                    {error}
                  </div>
                )}
                {message && (
                  <div className="banner info" role="status">
                    {message}
                  </div>
                )}
                {!online && (
                  <p role="status" className="muted">
                    <Localized k="billing.interface.you_re_offline_reconnect_to_continue_59a8a9f" />
                  </p>
                )}
                {config && !config.subscriptions && !gift && (
                  <p role="status" className="muted">
                    <Localized k="billing.interface.recurring_paypal_payments_are_not_available_for_this_app_yet_f931f8c" />
                  </p>
                )}
                {catalog && !price && (
                  <p role="status" className="muted">
                    <Localized k="billing.interface.this_offer_is_not_available_for_purchase_yet_e158f85" />
                  </p>
                )}
                {!accepted && (
                  <p className="checkout-hint">
                    <Localized k="billing.interface.agree_to_the_terms_to_continue_with_paypal_b54866d" />
                  </p>
                )}
                {closed && (
                  <div className="banner info" role="status">
                    <Localized k="billing.interface.this_checkout_has_ended_start_a_new_checkout_if_you_want_to_purch_3d5a0ac" />
                  </div>
                )}
                {closed && (
                  <button className="btn btn-secondary" disabled={!online} onClick={() => selectCheckout(userId, draft)}>
                    <Localized k="billing.interface.start_a_new_checkout_0b5e45e" />
                  </button>
                )}
                {canPay && accepted && (
                  <CheckoutPaymentButton
                    key={attempt}
                    config={config}
                    method={method}
                    cardSdk={cards.sdk}
                    cardStatus={cards.status}
                    subscription={!gift}
                    create={create}
                    approve={() => verify(true)}
                    cancel={() => setMessage(uiText("billing.interface.you_closed_paypal_checkout_you_can_check_the_purchase_status_belo_122d859"))}
                    fail={setError}
                  />
                )}
                {error && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setError(null);
                      setAttempt((a) => a + 1);
                    }}
                  >
                    <Localized k="billing.interface.try_loading_paypal_again_61f2404" />
                  </button>
                )}
                {saved.purchaseId && (
                  <button className="btn btn-secondary checkout-check" disabled={checking || !online} onClick={() => void verify(false)}>
                    <RefreshCw size={15} className={checking ? "spin" : ""} aria-hidden="true" />
                    {checking ? uiText("billing.interface.checking_payment_b7f9874") : uiText("billing.interface.check_purchase_status_e474197")}
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
            <aside className="checkout-card checkout-summary" aria-labelledby="checkout-summary-title">
              <div className="checkout-card-heading">
                <h2 id="checkout-summary-title">
                  <Localized k="billing.interface.order_summary_6c200a8" />
                </h2>
              </div>
              <div className="checkout-plan-art">
                <span>{gift ? <Gift size={30} aria-hidden="true" /> : <Crown size={30} aria-hidden="true" />}</span>
                <Sparkles size={18} className="checkout-art-spark" aria-hidden="true" />
                <div className="checkout-plan-detail">
                  <span className="checkout-kicker">
                    <Localized k="billing.interface.meldiq_plus_5c68974" />
                  </span>
                  <h3>
                    <Localized k="billing.interface.plus_0800d83" slots={[gift ? uiText("billing.interface.gift_14f4725") : ""]} />
                  </h3>
                  <p>
                    {gift
                      ? uiText("billing.interface.native_count_648eb6957", { value0: formatUnit(draft.months, "month"), value1: "" })
                      : uiText("billing.interface.more_of_what_brings_you_together_9337df7")}
                  </p>
                </div>
              </div>
              <dl className="checkout-breakdown">
                <div>
                  <dt>
                    {gift
                      ? uiText("billing.interface.native_count_4736ea779", { value0: formatUnit(draft.months, "month"), value1: "" })
                      : uiText("billing.interface.plus_every_value0_5ad9a72", { value0: cadence })}
                  </dt>
                  <dd>{money(amount, currency)}</dd>
                </div>
                <div>
                  <dt>
                    <Localized k="billing.interface.tax_added_fb1952a" />
                  </dt>
                  <dd>{money(0, currency)}</dd>
                </div>
                <div className="checkout-total">
                  <dt>
                    {gift ? uiText("billing.interface.total_c9b3c38") : uiText("billing.interface.total_today_edff0a6")}
                    <small>
                      {gift
                        ? uiText("billing.interface.one_time_purchase_905ac4e")
                        : deferred
                          ? uiText("billing.interface.first_payment_value0_47c7b57", { value0: startDate })
                          : uiText("billing.interface.renews_every_value0_2e59e40", { value0: cadence })}
                    </small>
                  </dt>
                  <dd>
                    {money(deferred ? 0 : amount, currency)}
                    <small>{currency}</small>
                  </dd>
                </div>
              </dl>
              {gift && (
                <p className="checkout-renewal">
                  <Localized
                    k="billing.interface.gift_for_0c0aa66"
                    slots={[
                      <strong>{recipient}</strong>,
                      draft.note && (
                        <>
                          <Localized k="billing.interface.your_note_fcd67a2" slots={[<br />, draft.note]} />
                        </>
                      ),
                    ]}
                  />
                </p>
              )}
              <p className="checkout-renewal">
                {gift
                  ? uiText("billing.interface.one_payment_no_automatic_renewal_your_friend_chooses_when_to_star_02c5c24")
                  : deferred
                    ? uiText("billing.interface.value0_value1_on_value2_then_every_value3_until_you_cancel_your_e_01ea896", {
                        value0: money(amount, currency),
                        value1: currency,
                        value2: startDate,
                        value3: cadence,
                      })
                    : uiText("billing.interface.then_value0_value1_every_value2_until_you_cancel_cancel_from_bill_fbdcfd3", { value0: money(amount, currency), value1: currency, value2: cadence })}
              </p>
              {!gift && (
                <div className="plus-support-summary">
                  <strong>
                    {savings > 0
                      ? uiText("billing.interface.you_save_value0_versus_monthly_billing_c6a2e7f", { value0: money(savings, currency) })
                      : uiText("billing.interface.support_meldiq_with_plus_285e978")}
                  </strong>
                  <p>
                    <Localized k="billing.interface.your_subscription_helps_support_servers_storage_bandwidth_securit_fe7c2a4" slots={[money(amount, currency)]} />
                  </p>
                </div>
              )}
              {plus && (
                <ul className="checkout-perks">
                  <li>
                    <Localized k="billing.interface.characters_per_message_0bb71b9" slots={[<Check size={15} aria-hidden="true" />, plus.messageChars.toLocaleString(interfaceLocale())]} />
                  </li>
                  <li>
                    <Localized k="billing.interface.files_up_to_ab9d8f4" slots={[<Check size={15} aria-hidden="true" />, size(plus.uploadBytes)]} />
                  </li>
                  <li>
                    <Localized k="billing.interface.included_sparks_35c26fa" slots={[<Check size={15} aria-hidden="true" />, plus.sparks]} />
                  </li>
                  <li>
                    <Localized k="billing.interface.plus_badge_and_customization_de3fbb2" slots={[<Check size={15} aria-hidden="true" />]} />
                  </li>
                </ul>
              )}
              <p className="checkout-fees">
                <Localized k="billing.interface.billed_in_your_payment_provider_may_apply_currency_conversion_fee_6b5976b" slots={[currency]} />
              </p>
            </aside>
          </div>
          <footer className="checkout-footer">
            <BrandMark size={22} />
            <span>
              <Localized k="billing.interface.more_connection_more_meldiq_0b490cd" />
            </span>
            <a href="https://meldiq.app/support" target="_blank" rel="noreferrer">
              <Localized k="billing.interface.need_a_hand_0925c83" />
            </a>
          </footer>
        </>
      )}
    </div>
  );
}
/** Add-ons have their own receipts and terms; no Plus subscription is required. */
export function CheckoutPage() {
  useLocaleRender();
  const engine = useEngine();
  const [selected, setSelected] = useState(() => readCheckout(engine.device.userId));
  useEffect(() => {
    const change = () => {
      const next = readCheckout(engine.device.userId);
      setSelected((previous) => (previous.requestKey === next.requestKey ? previous : next));
    };
    window.addEventListener(CHECKOUT_DRAFT_EVENT, change);
    return () => window.removeEventListener(CHECKOUT_DRAFT_EVENT, change);
  }, [engine]);
  const [resuming, setResuming] = useState(() => new URLSearchParams(window.location.search).has("purchase"));
  const [resumeError, setResumeError] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("purchase");
    if (!id) return;
    let disposed = false;
    void engine.api
      .json("GET", `/v2/billing/paypal/checkouts/${encodeURIComponent(id)}`, zPayPalCheckout)
      .then((purchase) => {
        if (disposed) return;
        restoreCheckout(engine.device.userId, purchase);
        const url = new URL(window.location.href);
        url.searchParams.delete("purchase");
        window.history.replaceState(window.history.state, "", url);
        setResuming(false);
      })
      .catch((e: unknown) => {
        if (!disposed) setResumeError(e instanceof Error ? e.message : uiText("billing.interface.purchase_could_not_be_loaded_c1517b7"));
      });
    return () => {
      disposed = true;
    };
  }, [engine]);
  if (resuming)
    return (
      <div className="mojo checkout-page">
        <h1>
          <Localized k="billing.interface.resume_your_purchase_707d90d" />
        </h1>
        <p role={resumeError ? "alert" : "status"}>{resumeError ?? uiText("billing.interface.checking_your_purchase_8c408f7")}</p>
        <button className="btn btn-secondary" onClick={billing}>
          <Localized k="billing.interface.back_to_billing_175f88d" />
        </button>
      </div>
    );
  const draft = selected.draft;
  return draft.product === "spark" || draft.product === "bots_plus" ? (
    <AddonCheckoutPage key={selected.requestKey} draft={draft} initial={selected} />
  ) : (
    <PlusCheckoutPage key={selected.requestKey} initial={selected} />
  );
}
