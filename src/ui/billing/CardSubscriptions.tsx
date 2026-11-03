import { billingState } from "../../i18n/billing";
import { interfaceLocale } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useRef, useState } from "react";
import { zCardMandate, zCardMandates, zCardMethods, zCardQuote } from "../../api/cardSchemas";
import { useEngine } from "../../application/orbit";
import { navigate } from "../../application/router";
import { useAction, useLoad } from "../workspace/useLoad";
import { money } from "../mojo/mojoFormat";
import { SavedCards } from "./SavedCards";
const date = (t: number) => new Intl.DateTimeFormat(interfaceLocale(), { dateStyle: "medium" }).format(t);
export function CardSubscriptionCheckout({ product, orgId }: { product: "plus" | "bots_plus"; orgId?: string }) {
  useLocaleRender();
  const engine = useEngine();
  const methods = useLoad(() => engine.api.json("GET", "/v2/billing/payment-methods", zCardMethods), [engine]);
  const quote = useLoad(() => engine.api.json("GET", `/v2/billing/card-subscriptions/quote?product=${product}`, zCardQuote), [engine, product]);
  const [method, setMethod] = useState("");
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof zCardMandate.parse> | null>(null);
  const requestKey = useRef(crypto.randomUUID());
  const lock = useRef(false);
  const action = useAction();
  const subscribe = async () => {
    if (lock.current || !consent || !quote.data || !methods.data?.methods.some((m) => m.id === method)) return;
    lock.current = true;
    try {
      await action.act(async () => {
        const mandate = await engine.api.json("POST", "/v2/billing/card-subscriptions", zCardMandate, {
          body: { product, ...(orgId ? { orgId } : {}), paymentMethodId: method, requestKey: requestKey.current, consentVersion: quote.data!.consentVersion, acceptRecurring: true },
        });
        setResult(mandate);
        await engine.mojo.refresh();
      });
    } finally {
      lock.current = false;
    }
  };
  if (result)
    return (
      <section className="card">
        <h3>
          {result.status === "past_due"
            ? uiText("billing.interface.card_payment_declined_7600c65")
            : result.status === "attention"
              ? uiText("billing.interface.payment_verification_pending_b59318f")
              : result.paidThrough
                ? uiText("billing.interface.payment_confirmed_3450b63")
                : uiText("billing.interface.card_renewal_scheduled_0fb6634")}
        </h3>
        <p>
          {result.status === "past_due"
            ? uiText("billing.interface.paypal_declined_this_payment_open_billing_and_choose_another_veri_f2bd1fa")
            : result.status === "attention"
              ? uiText("billing.interface.we_could_not_confirm_payment_yet_check_billing_before_starting_an_f641700")
              : result.paidThrough
                ? uiText("billing.interface.your_paid_period_continues_until_value0_fa82117", { value0: date(result.paidThrough) })
                : result.nextBillingAt
                  ? uiText("billing.interface.your_first_payment_is_scheduled_for_value0_existing_free_plus_tim_5e7877f", { value0: date(result.nextBillingAt) })
                  : uiText("billing.interface.check_billing_for_your_subscription_status_f252055")}
        </p>
        <button className="btn btn-secondary" onClick={() => navigate({ section: "settings", settingsPage: "billing" })}>
          <Localized k="billing.interface.view_billing_2b264b2" />
        </button>
      </section>
    );
  return (
    <div className="card-subscription-checkout">
      {(quote.error || methods.error || action.error) && (
        <p className="banner danger" role="alert">
          {action.error ?? quote.error ?? methods.error}
        </p>
      )}
      {(methods.loading || quote.loading) && (
        <p role="status">
          <Localized k="billing.interface.loading_secure_card_checkout_c855640" />
        </p>
      )}
      {methods.data?.methods.length ? (
        <label className="field">
          <span>
            <Localized k="billing.interface.choose_your_saved_card_58aa617" />
          </span>
          <select
            className="input"
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setConsent(false);
            }}
            disabled={action.busy}
          >
            <option value="">
              <Localized k="billing.interface.choose_a_card_a33241e" />
            </option>
            {methods.data.methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.brand} ···· {m.lastFour}
              </option>
            ))}
          </select>
        </label>
      ) : (
        !methods.loading && (
          <p>
            <Localized k="billing.interface.add_your_card_below_to_continue_saving_a_card_alone_does_not_star_05a85ab" />
          </p>
        )
      )}
      <SavedCards onChanged={methods.reload} />
      {quote.data && (
        <label className="checkbox">
          <input type="checkbox" checked={consent} disabled={action.busy} onChange={(e) => setConsent(e.target.checked)} />
          <Localized
            k="billing.interface.i_authorize_meldiq_to_charge_to_my_selected_card_every_month_star_8b6ca3f"
            slots={[money(quote.data.amountMinor, quote.data.currency), date(quote.data.firstBillingAt)]}
          />
        </label>
      )}
      <button className="btn btn-mojo" disabled={!consent || !methods.data?.methods.some((m) => m.id === method) || !quote.data || action.busy} onClick={() => void subscribe()}>
        {action.busy ? uiText("billing.interface.verifying_payment_52f2be6") : uiText("billing.interface.subscribe_with_card_366cedb")}
      </button>
      <p className="checkout-hint">
        <Localized k="billing.interface.your_bank_may_require_verification_plus_starts_after_payment_is_c_5e7e884" />
      </p>
    </div>
  );
}
export function CardSubscriptionManagement() {
  useLocaleRender();
  const engine = useEngine();
  const result = useLoad(() => engine.api.json("GET", "/v2/billing/card-subscriptions", zCardMandates), [engine]);
  const methods = useLoad(() => engine.api.json("GET", "/v2/billing/payment-methods", zCardMethods), [engine]);
  const action = useAction();
  const [selected, setSelected] = useState<Record<string, string>>({});
  if (!result.data?.subscriptions.length) return null;
  return (
    <section className="checkout-card">
      <h2>
        <Localized k="billing.interface.card_subscriptions_9956d98" />
      </h2>
      {action.error && (
        <p className="banner danger" role="alert">
          {action.error}
        </p>
      )}
      {result.data.subscriptions.map((m) => (
        <article className="card" key={m.id}>
          <h3>
            {m.product === "plus" ? uiText("billing.interface.plus_8a78437") : uiText("billing.interface.bots_475bc2f")}
            {m.orgId ? uiText("calls.interface.value0_9402340", { value0: m.orgId }) : ""}
          </h3>
          <p>
            <Localized
              k="billing.interface.month_beec2d6"
              slots={[
                money(m.amountMinor, m.currency),
                m.status === "attention" ? uiText("billing.interface.payment_needs_verification_17b5f85") : billingState(m.status),
                m.cancelAt ? uiText("billing.interface.renewal_canceled_927f845") : "",
              ]}
            />
          </p>
          {m.paidThrough && (
            <p>
              <Localized k="billing.interface.verified_paid_time_until_71c73a5" slots={[date(m.paidThrough)]} />
            </p>
          )}
          {m.nextBillingAt && (
            <p>
              <Localized k="billing.interface.next_payment_5d8eaf0" slots={[date(m.nextBillingAt)]} />
            </p>
          )}
          {m.processing && (
            <p role="status">
              <Localized k="billing.interface.a_payment_is_in_progress_canceling_stops_future_renewals_this_pay_b07f8a8" />
            </p>
          )}
          {!m.cancelAt && m.status !== "canceled" && (
            <>
              <button
                className="btn btn-secondary"
                disabled={action.busy}
                onClick={() => {
                  if (confirm(uiText("billing.interface.cancel_future_card_renewals_your_verified_paid_time_stays_available_cb8203a")))
                    void action.act(async () => {
                      await engine.api.json("POST", `/v2/billing/card-subscriptions/${encodeURIComponent(m.id)}/cancel`, zCardMandate, { body: { confirm: true } });
                      result.reload();
                      await engine.mojo.refresh();
                    });
                }}
              >
                <Localized k="billing.interface.cancel_card_renewal_a8a95c0" />
              </button>
              {!!methods.data?.methods.length && (
                <div className="field">
                  <label htmlFor={`method-${m.id}`}>
                    <Localized k="billing.interface.card_for_future_renewals_2b36f54" />
                  </label>
                  <select
                    id={`method-${m.id}`}
                    className="input"
                    value={selected[m.id] ?? m.paymentMethodId}
                    onChange={(e) => setSelected({ ...selected, [m.id]: e.target.value })}
                    disabled={action.busy}
                  >
                    {methods.data.methods.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.brand} ···· {card.lastFour}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-secondary"
                    disabled={action.busy || !selected[m.id] || selected[m.id] === m.paymentMethodId}
                    onClick={() =>
                      void action.act(async () => {
                        await engine.api.json("PUT", `/v2/billing/card-subscriptions/${encodeURIComponent(m.id)}/payment-method`, zCardMandate, { body: { paymentMethodId: selected[m.id] } });
                        result.reload();
                      })
                    }
                  >
                    <Localized k="billing.interface.update_renewal_card_5d3f734" />
                  </button>
                </div>
              )}
            </>
          )}
        </article>
      ))}
    </section>
  );
}
