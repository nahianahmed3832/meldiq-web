import { ArrowLeft, ArrowUpRight, CheckCircle2, Clock3, CreditCard, RefreshCw, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { type PayPalHistory, zPayPalCancellation, zPayPalHistory } from "../../api/paypalSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { Dialog } from "../components/Overlay";
import { money } from "../mojo/mojoFormat";

const date = (value: number | null) => (value === null ? "Not available yet" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(value));

export function BillingPage() {
  const engine = useEngine();
  const { billing, me } = useOrbit((s) => s.mojo);
  const online = useOrbit((s) => s.connection === "online");
  const [history, setHistory] = useState<PayPalHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await engine.mojo.refresh();
      const result = await engine.api.json("GET", "/v2/billing/paypal/history", zPayPalHistory);
      setHistory(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Billing history could not load.");
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
      const result = await engine.api.json("POST", "/v2/billing/paypal/cancel", zPayPalCancellation, { body: { confirm: true } });
      setNotice(
        result.confirmed
          ? `PayPal confirmed cancellation. Your paid benefits continue until ${date(result.accessUntil)}.`
          : "PayPal has not confirmed cancellation yet. Refresh your billing status before trying again.",
      );
      setCanceling(false);
      await engine.mojo.refresh();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancellation could not be confirmed. Your subscription may still renew.");
    } finally {
      setBusy(false);
    }
  };
  const sub = billing?.subscription;
  const latest = history?.subscriptions[0];
  const ending = sub?.cancelAtPeriodEnd || latest?.cancelAtPeriodEnd;
  const paypal = billing?.provider === "paypal";
  return (
    <div className="mojo billing-page">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate({ section: "settings", settingsPage: "mojo" })}>
        <ArrowLeft size={15} aria-hidden="true" /> Back to Mojo
      </button>
      <div className="billing-title">
        <div>
          <span className="checkout-kicker">YOUR ACCOUNT</span>
          <h1>Billing & purchases</h1>
        </div>
        <button className="btn btn-secondary btn-sm" disabled={busy || !online} onClick={() => void refresh()}>
          <RefreshCw size={15} className={busy ? "spin" : ""} aria-hidden="true" /> Refresh
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
      <section className="checkout-card billing-current" aria-label="Current subscription">
        <CreditCard size={24} aria-hidden="true" />
        <div className="grow">
          <span className="muted">Current plan</span>
          <h2>{me?.perks.name ?? "Loading…"}</h2>
          <p>
            {sub
              ? `${money(sub.amountMinor, sub.currency)} ${sub.currency}/month · ${sub.status.replaceAll("_", " ")}`
              : me?.plan === "free"
                ? "Free · no recurring payment"
                : "Granted Plus time · no recurring payment"}
          </p>
          <p className="muted">{sub ? `${ending ? "Paid access ends" : "Next billing date"}: ${date(sub.currentPeriodEnd ?? sub.trialEnd ?? null)}` : "No upcoming billing date"}</p>
          {paypal && <small>Payment provider: PayPal{billing?.mode === "test" ? " · Sandbox" : ""}</small>}
        </div>
        {sub && paypal && !ending && (
          <button className="btn btn-secondary" disabled={busy || !online} onClick={() => setCanceling(true)}>
            Cancel renewal
          </button>
        )}
        {ending && <span className="checkout-sandbox">Renewal cancelled</span>}
        {me?.plan !== "plus" && !sub && (
          <button className="btn btn-mojo" onClick={() => navigate({ section: "settings", settingsPage: "mojo" })}>
            Explore Plus <ArrowUpRight size={15} aria-hidden="true" />
          </button>
        )}
      </section>
      {sub && (sub.status === "past_due" || sub.status === "unpaid" || sub.status === "paused") && (
        <div className="banner danger" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          <span>Your subscription needs attention. Update your funding method in PayPal, then refresh billing. Benefits follow the verified payment state and your plan’s recovery policy.</span>
          <a href={billing?.mode === "live" ? "https://www.paypal.com/myaccount/autopay/" : "https://www.sandbox.paypal.com/myaccount/autopay/"} target="_blank" rel="noreferrer">
            Open PayPal
          </a>
        </div>
      )}
      {paypal && (
        <p className="checkout-security">
          <CheckCircle2 size={16} aria-hidden="true" />
          PayPal handles your payment method. Cancellation stops future renewal; your verified paid period remains available.
        </p>
      )}
      <section className="checkout-card" aria-labelledby="purchase-history-title">
        <h2 id="purchase-history-title">Purchase history</h2>
        {busy && !history && <p role="status">Loading purchases…</p>}
        {history && !history.transactions.length && <p className="muted">Your purchases and transaction references will appear here.</p>}
        {!!history?.transactions.length && (
          <div className="billing-table-wrap">
            <table className="billing-table">
              <thead>
                <tr>
                  <th>Purchase</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {history.transactions.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.product}</strong>
                      <small>{date(p.createdAt)} · PayPal</small>
                    </td>
                    <td>
                      {money(p.amountMinor, p.currency)} {p.currency}
                    </td>
                    <td>
                      {p.status.replaceAll("_", " ")}
                      {p.refundStatus !== "none" && <small>Refund: {p.refundStatus}</small>}
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
      <section className="checkout-card" aria-labelledby="subscription-history-title">
        <h2 id="subscription-history-title">
          <Clock3 size={18} aria-hidden="true" /> Subscription history
        </h2>
        {history && !history.history.length && <p className="muted">No subscription changes yet.</p>}
        <ol className="billing-history">
          {history?.history.map((h, i) => (
            <li key={`${h.subscriptionId}-${h.at}-${i}`}>
              <span>
                {h.from ? `${h.from.replaceAll("_", " ")} → ` : "Subscription "}
                {h.to.replaceAll("_", " ")}
              </span>
              <time dateTime={new Date(h.at).toISOString()}>{date(h.at)}</time>
            </li>
          ))}
        </ol>
      </section>
      {canceling && (
        <Dialog
          title="Cancel Plus renewal?"
          onClose={() => {
            if (!busy) setCanceling(false);
          }}
          footer={
            <>
              <button className="btn btn-secondary" disabled={busy} onClick={() => setCanceling(false)}>
                Keep Plus
              </button>
              <button className="btn btn-danger" disabled={busy || !online} onClick={() => void cancel()}>
                {busy ? "Confirming with PayPal…" : "Confirm cancellation"}
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p>PayPal will stop future renewals. Your verified paid Plus benefits continue until {date(sub?.currentPeriodEnd ?? null)}.</p>
            <p>We’ll show confirmation after PayPal verifies the cancellation.</p>
            {error && <p role="alert">{error}</p>}
          </div>
        </Dialog>
      )}
    </div>
  );
}
