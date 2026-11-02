import { useRef, useState } from "react";
import { zCardMandate, zCardMandates, zCardMethods, zCardQuote } from "../../api/cardSchemas";
import { useEngine } from "../../application/orbit";
import { navigate } from "../../application/router";
import { useAction, useLoad } from "../workspace/useLoad";
import { money } from "../mojo/mojoFormat";
import { SavedCards } from "./SavedCards";
const date = (t: number) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(t);
export function CardSubscriptionCheckout({ product, orgId }: { product: "plus" | "bots_plus"; orgId?: string }) {
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
            ? "Card payment declined"
            : result.status === "attention"
              ? "Payment verification pending"
              : result.paidThrough
                ? "Payment confirmed"
                : "Card renewal scheduled"}
        </h3>
        <p>
          {result.status === "past_due"
            ? "PayPal declined this payment. Open Billing and choose another verified card to retry. No paid access has been granted for this charge."
            : result.status === "attention"
              ? "We could not confirm payment yet. Check Billing before starting another purchase."
              : result.paidThrough
                ? `Your paid period continues until ${date(result.paidThrough)}.`
                : result.nextBillingAt
                  ? `Your first payment is scheduled for ${date(result.nextBillingAt)}. Existing free Plus time stays available.`
                  : "Check Billing for your subscription status."}
        </p>
        <button className="btn btn-secondary" onClick={() => navigate({ section: "settings", settingsPage: "billing" })}>
          View billing
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
      {(methods.loading || quote.loading) && <p role="status">Loading secure card checkout…</p>}
      {methods.data?.methods.length ? (
        <label className="field">
          <span>Choose your saved card</span>
          <select
            className="input"
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setConsent(false);
            }}
            disabled={action.busy}
          >
            <option value="">Choose a card…</option>
            {methods.data.methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.brand} ···· {m.lastFour}
              </option>
            ))}
          </select>
        </label>
      ) : (
        !methods.loading && <p>Add your card below to continue. Saving a card alone does not start billing.</p>
      )}
      <SavedCards onChanged={methods.reload} />
      {quote.data && (
        <label className="checkbox">
          <input type="checkbox" checked={consent} disabled={action.busy} onChange={(e) => setConsent(e.target.checked)} />I authorize Meldiq to charge{" "}
          {money(quote.data.amountMinor, quote.data.currency)} to my selected card every month, starting {date(quote.data.firstBillingAt)}, until I cancel in Billing.
        </label>
      )}
      <button className="btn btn-mojo" disabled={!consent || !methods.data?.methods.some((m) => m.id === method) || !quote.data || action.busy} onClick={() => void subscribe()}>
        {action.busy ? "Verifying payment…" : "Subscribe with card"}
      </button>
      <p className="checkout-hint">Your bank may require verification. Plus benefits start only after the server verifies payment; your free signup trial is separate.</p>
    </div>
  );
}
export function CardSubscriptionManagement() {
  const engine = useEngine();
  const result = useLoad(() => engine.api.json("GET", "/v2/billing/card-subscriptions", zCardMandates), [engine]);
  const methods = useLoad(() => engine.api.json("GET", "/v2/billing/payment-methods", zCardMethods), [engine]);
  const action = useAction();
  const [selected, setSelected] = useState<Record<string, string>>({});
  if (!result.data?.subscriptions.length) return null;
  return (
    <section className="checkout-card">
      <h2>Card subscriptions</h2>
      {action.error && (
        <p className="banner danger" role="alert">
          {action.error}
        </p>
      )}
      {result.data.subscriptions.map((m) => (
        <article className="card" key={m.id}>
          <h3>
            {m.product === "plus" ? "Plus" : "Bots+"}
            {m.orgId ? ` · ${m.orgId}` : ""}
          </h3>
          <p>
            {money(m.amountMinor, m.currency)} / month · {m.status === "attention" ? "Payment needs verification" : m.status.replaceAll("_", " ")}
            {m.cancelAt ? " · renewal canceled" : ""}
          </p>
          {m.paidThrough && <p>Verified paid time until {date(m.paidThrough)}.</p>}
          {m.nextBillingAt && <p>Next payment: {date(m.nextBillingAt)}.</p>}
          {m.processing && <p role="status">A payment is in progress. Canceling stops future renewals; this payment may still finish.</p>}
          {!m.cancelAt && m.status !== "canceled" && (
            <>
              <button
                className="btn btn-secondary"
                disabled={action.busy}
                onClick={() => {
                  if (confirm("Cancel future card renewals? Your verified paid time stays available."))
                    void action.act(async () => {
                      await engine.api.json("POST", `/v2/billing/card-subscriptions/${encodeURIComponent(m.id)}/cancel`, zCardMandate, { body: { confirm: true } });
                      result.reload();
                      await engine.mojo.refresh();
                    });
                }}
              >
                Cancel card renewal
              </button>
              {!!methods.data?.methods.length && (
                <div className="field">
                  <label htmlFor={`method-${m.id}`}>Card for future renewals</label>
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
                    Update renewal card
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
