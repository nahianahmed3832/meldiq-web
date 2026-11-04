import { billingPlanName } from "../../i18n/billing";
import { billingProduct } from "../../i18n/billing";
import { billingState } from "../../i18n/billing";
import { interfaceLocale } from "../../i18n/format";
import { useT as useLocalization } from "../../i18n";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { Orders } from "./Orders";
import { CardSubscriptionManagement } from "./CardSubscriptions";
import { ArrowLeft, ArrowUpRight, CheckCircle2, Clock3, CreditCard, RefreshCw, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { SavedCards } from "./SavedCards";
import { type PayPalHistory, zPayPalCancellation, zPayPalHistory } from "../../api/paypalSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { Dialog } from "../components/Overlay";
import { money } from "../mojo/mojoFormat";
import { type CheckoutDraft, selectCheckout } from "./checkoutDraft";
const date = (value: number | null) => (value === null ? uiText("billing.interface.not_available_yet_787406d") : new Intl.DateTimeFormat(interfaceLocale(), { dateStyle: "medium" }).format(value));
export function BillingPage() {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const { billing, me } = useOrbit((s) => s.mojo);
  const communities = useOrbit((s) => s.orgs);
  const online = useOrbit((s) => s.connection === "online");
  const [history, setHistory] = useState<PayPalHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canceling, setCanceling] = useState<{
    id?: string;
    name: string;
    until: number | null;
  } | null>(null);
  const returnToCheckout = (draft: CheckoutDraft) => {
    selectCheckout(engine.device.userId, draft);
    navigate({ section: "settings", settingsPage: "checkout" });
  };
  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      try {
        await engine.api.json("POST", "/v2/billing/sync", z.object({ checked: z.number() }), { body: {} });
      } catch {
        setError(uiText("billing.interface.paypal_status_could_not_refresh_showing_the_last_verified_billing_e3b0f3a"));
      }
      await engine.mojo.refresh();
      if (engine.state.get().mojo.billing?.provider !== "paypal") {
        setHistory(null);
        return;
      }
      const result = await engine.api.json("GET", "/v2/billing/paypal/history", zPayPalHistory);
      setHistory(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : uiText("billing.interface.billing_history_could_not_load_dc3fb93"));
    } finally {
      setBusy(false);
    }
  }, [engine]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await engine.api.json("POST", "/v2/billing/paypal/cancel", zPayPalCancellation, { body: { confirm: true, ...(canceling?.id ? { subscriptionId: canceling.id } : {}) } });
      setNotice(
        result.checkoutExpired
          ? uiText("billing.interface.this_unfinished_checkout_has_expired_no_paid_subscription_was_ver_b8894b3")
          : result.approvalPending
            ? uiText("billing.interface.no_recurring_payment_has_been_authorized_close_the_paypal_checkou_1a68cdc")
            : result.confirmed
              ? result.accessUntil
                ? uiText("billing.interface.paypal_confirmed_cancellation_your_paid_benefits_continue_until_v_d9e244f", { value0: date(result.accessUntil) })
                : uiText("billing.interface.paypal_confirmed_cancellation_no_future_payments_are_scheduled_an_0cc9486")
              : uiText("billing.interface.paypal_has_not_confirmed_cancellation_yet_refresh_your_billing_st_48981a6"),
      );
      setCanceling(null);
      await engine.mojo.refresh();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : uiText("billing.interface.cancellation_could_not_be_confirmed_your_subscription_may_still_r_c4d21ea"));
    } finally {
      setBusy(false);
    }
  };
  const openPortal = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = await engine.mojo.portal();
      if (url) window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : uiText("billing.interface.couldn_t_open_the_payment_page_nothing_was_charged_679d717"));
    } finally {
      setBusy(false);
    }
  };
  const sub = billing?.subscription;
  const latest = history?.subscriptions.find((subscription) => subscription.product !== "bots_plus" && subscription.status === sub?.status);
  const pending = sub?.status === "incomplete" && (sub.approvalPending ?? latest?.approvalPending ?? true);
  const ending = !pending && (sub?.cancelAtPeriodEnd || latest?.cancelAtPeriodEnd);
  const freePeriod = billing?.freePeriod;
  const renewalDate = sub?.currentPeriodEnd ?? sub?.trialEnd ?? latest?.billingStartAt ?? null;
  const paypal = billing?.provider === "paypal";
  const fundingUrl = billing?.mode === "live" ? "https://www.paypal.com/myaccount/autopay/" : "https://www.sandbox.paypal.com/myaccount/autopay/";
  return (
    <div className="mojo billing-page">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate({ section: "settings", settingsPage: "mojo" })}>
        <Localized k="billing.interface.back_to_meldiq_plus_b7b2162" slots={[<ArrowLeft size={15} aria-hidden="true" />]} />
      </button>
      <div className="billing-title">
        <div>
          <span className="checkout-kicker">
            <Localized k="billing.interface.your_account_cee7fd7" />
          </span>
          <h1>
            <Localized k="billing.interface.billing_purchases_3a698f7" />
          </h1>
        </div>
        <button className="btn btn-secondary btn-sm" disabled={busy || !online} onClick={() => void refresh()}>
          <RefreshCw size={15} className={busy ? "spin" : ""} aria-hidden="true" /> {l10n("messaging.collection_refresh")}
        </button>
      </div>
      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="banner info" role="status">
          {notice}
        </div>
      )}
      <section className="checkout-card billing-current" aria-label={uiText("billing.interface.current_subscription_4e761d1")}>
        <CreditCard size={24} aria-hidden="true" />
        <div className="grow">
          <span className="muted">
            <Localized k="billing.interface.current_plan_37ca715" />
          </span>
          <h2>{me ? billingPlanName(me.perks.name) : l10n("common.status.loading")}</h2>
          <p>
            {sub && !pending
              ? uiText("billing.interface.value0_value1_every_value2_month_s_value3_f01b078", {
                  value0: money(sub.amountMinor, sub.currency),
                  value1: sub.currency,
                  value2: (sub.interval === "year" ? 12 : 1) * (sub.billingFrequency ?? 1),
                  value3: sub.status === "incomplete" ? uiText("billing.interface.awaiting_first_payment_e1ef254") : billingState(sub.status),
                })
              : freePeriod?.source === "signup_trial"
                ? uiText("billing.interface.free_signup_trial_no_recurring_payment_5f0cdf2")
                : me?.plan === "free"
                  ? uiText("billing.interface.free_no_recurring_payment_111bebb")
                  : uiText("billing.interface.granted_plus_time_no_recurring_payment_d318c21")}
          </p>
          <p className="muted">
            {sub && !pending
              ? renewalDate
                ? uiText("billing.interface.value0_value1_6a77681", {
                    value0: ending ? uiText("billing.interface.paid_access_ends_65e86ee") : uiText("billing.interface.first_next_billing_date_0660edc"),
                    value1: date(renewalDate),
                  })
                : uiText("billing.interface.billing_date_will_appear_after_paypal_confirms_it_7fd19bf")
              : freePeriod
                ? uiText("billing.interface.free_plus_time_ends_value0_it_does_not_renew_or_charge_you_8a21886", { value0: date(freePeriod.endsAt) })
                : uiText("billing.interface.no_upcoming_billing_date_5ad3bce")}
          </p>
          {freePeriod && (!sub || pending || sub.status === "incomplete") && (
            <p className="muted">
              <Localized k="billing.interface.your_free_plus_time_is_separate_from_checkout_a_paid_renewal_star_38b3493" />
            </p>
          )}
          {paypal && (
            <small>
              <Localized k="billing.interface.payment_provider_paypal_e797c1c" slots={[billing?.mode === "test" ? uiText("billing.interface.sandbox_e5b6d02") : ""]} />
            </small>
          )}
        </div>
        {sub && !paypal && billing?.portal && (
          <button className="btn btn-secondary" disabled={busy || !online} onClick={() => void openPortal()}>
            {uiText("billing.interface.manage_subscription_9041c6a")}
          </button>
        )}
        {sub && paypal && !pending && !ending && (
          <button className="btn btn-secondary" disabled={busy || !online} onClick={() => setCanceling({ id: latest?.id, name: "Plus", until: sub.currentPeriodEnd ?? null })}>
            <Localized k="billing.interface.cancel_renewal_9dd5e86" />
          </button>
        )}
        {ending && (
          <span className="checkout-sandbox">
            <Localized k="billing.interface.renewal_cancelled_786e8a1" />
          </span>
        )}
        {me?.plan !== "plus" && !sub && (
          <button className="btn btn-mojo" onClick={() => navigate({ section: "settings", settingsPage: "mojo" })}>
            <Localized k="billing.interface.explore_plus_c7bc5c2" slots={[<ArrowUpRight size={15} aria-hidden="true" />]} />
          </button>
        )}
      </section>
      {pending && (
        <section className="checkout-card billing-current" aria-label={uiText("billing.interface.unfinished_plus_checkout_6f5e5a3")}>
          <div className="grow">
            <h2>
              <Localized k="billing.interface.checkout_awaiting_approval_f65504d" />
            </h2>
            <p>
              <Localized k="billing.interface.no_paid_plus_subscription_or_recurring_payment_has_been_authorize_49b7ff9" />
            </p>
            <p className="muted">
              <Localized k="billing.interface.close_the_paypal_window_to_leave_this_checkout_nothing_renews_unl_841c8c4" />
            </p>
          </div>
          <button className="btn btn-secondary" disabled={!online} onClick={() => returnToCheckout({ product: "plus" })}>
            <Localized k="billing.interface.return_to_checkout_c783344" />
          </button>
        </section>
      )}
      {history?.subscriptions
        .filter((subscription) => subscription.product === "bots_plus")
        .map((subscription) => (
          <section className="checkout-card billing-current" aria-label={uiText("billing.interface.bots_subscription_9897a96")} key={subscription.id}>
            <div className="grow">
              <h2>
                <Localized k="billing.interface.bots_475bc2f" />
              </h2>
              <p>
                <Localized
                  k="billing.interface.3_99_usd_month_9563293"
                  slots={[subscription.approvalPending ? uiText("billing.interface.checkout_awaiting_approval_f65504d") : billingState(subscription.status)]}
                />
              </p>
              <small>{communities.find((community) => community.id === subscription.orgId)?.name ?? uiText("billing.interface.community_subscription_1ee4403")}</small>
              <p className="muted">
                {subscription.approvalPending
                  ? uiText("billing.interface.no_recurring_payment_has_been_authorized_4560527")
                  : subscription.currentPeriodEnd || subscription.billingStartAt
                    ? uiText("billing.interface.value0_value1_6a77681", {
                        value0: subscription.cancelAtPeriodEnd ? uiText("billing.interface.paid_access_ends_65e86ee") : uiText("billing.interface.first_next_billing_date_0660edc"),
                        value1: date(subscription.currentPeriodEnd ?? subscription.billingStartAt ?? null),
                      })
                    : uiText("billing.interface.no_verified_paid_period_yet_361dd2e")}
              </p>
              {["past_due", "unpaid", "paused"].includes(subscription.status) && (
                <p role="status">
                  <Localized
                    k="billing.interface.bots_needs_payment_attention_then_refresh_billing_00a2b19"
                    slots={[
                      <a href={fundingUrl} target="_blank" rel="noreferrer">
                        <Localized k="billing.interface.update_your_payment_method_in_paypal_baed587" />
                      </a>,
                    ]}
                  />
                </p>
              )}
            </div>
            {subscription.approvalPending ? (
              <button
                className="btn btn-secondary"
                disabled={!online || !subscription.orgId}
                onClick={() => subscription.orgId && returnToCheckout({ product: "bots_plus", orgId: subscription.orgId })}
              >
                <Localized k="billing.interface.return_to_bots_checkout_02c469e" />
              </button>
            ) : subscription.cancelAtPeriodEnd || subscription.status === "canceled" ? (
              <span className="checkout-sandbox">
                <Localized k="billing.interface.renewal_cancelled_786e8a1" />
              </span>
            ) : (
              !["incomplete_expired", "expired"].includes(subscription.status) && (
                <button className="btn btn-secondary" disabled={busy || !online} onClick={() => setCanceling({ id: subscription.id, name: "Bots+", until: subscription.currentPeriodEnd })}>
                  <Localized k="billing.interface.cancel_bots_renewal_18204e8" />
                </button>
              )
            )}
          </section>
        ))}
      {sub && (sub.status === "past_due" || sub.status === "unpaid" || sub.status === "paused") && (
        <div className="banner danger" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          <span>
            <Localized k="billing.interface.your_subscription_needs_attention_update_your_funding_method_in_p_faccb41" />
          </span>
          <a href={fundingUrl} target="_blank" rel="noreferrer">
            <Localized k="billing.interface.open_paypal_4ab1248" />
          </a>
        </div>
      )}
      {paypal && (
        <p className="checkout-security">
          <Localized k="billing.interface.paypal_handles_your_payment_method_cancellation_stops_future_rene_8eb7b1c" slots={[<CheckCircle2 size={16} aria-hidden="true" />]} />
        </p>
      )}
      <Orders />
      <CardSubscriptionManagement />
      {paypal && <SavedCards />}
      {paypal && (
        <section className="checkout-card" aria-labelledby="purchase-history-title">
          <h2 id="purchase-history-title">
            <Localized k="billing.interface.purchase_history_3cbb596" />
          </h2>
          {busy && !history && (
            <p role="status">
              <Localized k="billing.interface.loading_purchases_f703be9" />
            </p>
          )}
          {history && !history.transactions.length && (
            <p className="muted">
              <Localized k="billing.interface.your_purchases_and_transaction_references_will_appear_here_fb89fa4" />
            </p>
          )}
          {!!history?.transactions.length && (
            <div className="billing-table-wrap">
              <table className="billing-table">
                <thead>
                  <tr>
                    <th>
                      <Localized k="billing.interface.purchase_5b5e9c6" />
                    </th>
                    <th>
                      <Localized k="billing.interface.amount_49e96d7" />
                    </th>
                    <th>
                      <Localized k="billing.interface.status_920e413" />
                    </th>
                    <th>
                      <Localized k="billing.interface.reference_71bf909" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.transactions.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{billingProduct(p.product)}</strong>
                        <small>
                          <Localized k="billing.interface.paypal_0cf1dcd" slots={[date(p.createdAt)]} />
                        </small>
                      </td>
                      <td>
                        {money(p.amountMinor, p.currency)} {p.currency}
                      </td>
                      <td>
                        {billingState(p.status)}
                        {p.refundStatus !== "none" && (
                          <small>
                            <Localized k="billing.interface.refund_3d925e5" slots={[p.refundStatus]} />
                          </small>
                        )}
                      </td>
                      <td>
                        <code>{p.providerRef ?? p.id}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      <section className="checkout-card" aria-labelledby="subscription-history-title">
        <h2 id="subscription-history-title">
          <Localized k="billing.interface.subscription_history_3c441ed" slots={[<Clock3 size={18} aria-hidden="true" />]} />
        </h2>
        {history && !history.history.length && (
          <p className="muted">
            <Localized k="billing.interface.no_subscription_changes_yet_a5eeb18" />
          </p>
        )}
        <ol className="billing-history">
          {history?.history.map((h, i) => (
            <li key={`${h.subscriptionId}-${h.at}-${i}`}>
              <span>
                {h.from ? uiText("billing.interface.value0_6a22c8c", { value0: billingState(h.from) }) : uiText("billing.interface.subscription_91cbddc")}
                {h.to === "incomplete"
                  ? uiText("billing.interface.checkout_awaiting_approval_or_first_payment_1472d33")
                  : h.to === "incomplete_expired"
                    ? uiText("billing.interface.checkout_expired_6f2b4ec")
                    : billingState(h.to)}
              </span>
              <time dateTime={new Date(h.at).toISOString()}>{date(h.at)}</time>
            </li>
          ))}
        </ol>
      </section>
      {canceling && (
        <Dialog
          title={uiText("billing.interface.cancel_value0_renewal_1816bb8", { value0: canceling.name })}
          onClose={() => {
            if (!busy) setCanceling(null);
          }}
          footer={
            <>
              <button className="btn btn-secondary" disabled={busy} onClick={() => setCanceling(null)}>
                <Localized k="billing.interface.keep_a54058a" slots={[canceling.name]} />
              </button>
              <button className="btn btn-danger" disabled={busy || !online} onClick={() => void cancel()}>
                {busy ? uiText("billing.interface.confirming_with_paypal_3f30396") : uiText("billing.interface.confirm_cancellation_040f7f9")}
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p>
              <Localized
                k="billing.interface.paypal_will_stop_future_renewals_cdb4e97"
                slots={[
                  canceling.until
                    ? uiText("billing.interface.your_verified_paid_value0_benefits_continue_until_value1_802d237", { value0: canceling.name, value1: date(canceling.until) })
                    : uiText("billing.interface.any_existing_free_plus_time_stays_available_no_paid_period_has_be_f8d3ee3"),
                ]}
              />
            </p>
            {error && <p role="alert">{error}</p>}
          </div>
        </Dialog>
      )}
    </div>
  );
}
