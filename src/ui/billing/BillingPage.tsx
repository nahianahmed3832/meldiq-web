import { ArrowLeft, ArrowUpRight, CheckCircle2, Clock3, CreditCard, RefreshCw, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { type PayPalHistory, zPayPalCancellation, zPayPalHistory } from "../../api/paypalSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { Dialog } from "../components/Overlay";
import { money } from "../mojo/mojoFormat";
import { type CheckoutDraft, selectCheckout } from "./checkoutDraft";

const date = (value: number | null) => (value === null ? "Not available yet" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(value));

export function BillingPage() {
  const engine = useEngine();
  const { billing, me } = useOrbit((s) => s.mojo);
  const communities = useOrbit((s) => s.orgs);
  const online = useOrbit((s) => s.connection === "online");
  const [history, setHistory] = useState<PayPalHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canceling, setCanceling] = useState<{ id?: string; name: string; until: number | null } | null>(null);
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
        setError("PayPal status could not refresh. Showing the last verified billing state; try Refresh again.");
      }
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
      const result = await engine.api.json("POST", "/v2/billing/paypal/cancel", zPayPalCancellation, { body: { confirm: true, ...(canceling?.id ? { subscriptionId: canceling.id } : {}) } });
      setNotice(
        result.checkoutExpired
          ? "This unfinished checkout has expired. No paid subscription was verified. Your free Plus time is unchanged."
          : result.approvalPending
            ? "No recurring payment has been authorized. Close the PayPal checkout window to leave this purchase. Your free Plus time does not renew."
            : result.confirmed
              ? result.accessUntil
                ? `PayPal confirmed cancellation. Your paid benefits continue until ${date(result.accessUntil)}.`
                : "PayPal confirmed cancellation. No future payments are scheduled. Any existing free Plus time stays available."
              : "PayPal has not confirmed cancellation yet. Refresh your billing status before trying again.",
      );
      setCanceling(null);
      await engine.mojo.refresh();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancellation could not be confirmed. Your subscription may still renew.");
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
            {sub && !pending
              ? `${money(sub.amountMinor, sub.currency)} ${sub.currency}/month · ${sub.status === "incomplete" ? "Awaiting first payment" : sub.status.replaceAll("_", " ")}`
              : freePeriod?.source === "signup_trial"
                ? "Free signup trial · no recurring payment"
                : me?.plan === "free"
                  ? "Free · no recurring payment"
                  : "Granted Plus time · no recurring payment"}
          </p>
          <p className="muted">
            {sub && !pending
              ? renewalDate
                ? `${ending ? "Paid access ends" : "First / next billing date"}: ${date(renewalDate)}`
                : "Billing date will appear after PayPal confirms it."
              : freePeriod
                ? `Free Plus time ends ${date(freePeriod.endsAt)}. It does not renew or charge you.`
                : "No upcoming billing date"}
          </p>
          {freePeriod && (!sub || pending || sub.status === "incomplete") && (
            <p className="muted">Your free Plus time is separate from checkout. A paid renewal starts only after you approve payment.</p>
          )}
          {paypal && <small>Payment provider: PayPal{billing?.mode === "test" ? " · Sandbox" : ""}</small>}
        </div>
        {sub && paypal && !pending && !ending && (
          <button className="btn btn-secondary" disabled={busy || !online} onClick={() => setCanceling({ id: latest?.id, name: "Plus", until: sub.currentPeriodEnd ?? null })}>
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
      {pending && (
        <section className="checkout-card billing-current" aria-label="Unfinished Plus checkout">
          <div className="grow">
            <h2>Checkout awaiting approval</h2>
            <p>No paid Plus subscription or recurring payment has been authorized.</p>
            <p className="muted">Close the PayPal window to leave this checkout. Nothing renews unless you approve payment. Any free Plus time is separate.</p>
          </div>
          <button className="btn btn-secondary" disabled={!online} onClick={() => returnToCheckout({ product: "plus" })}>
            Return to checkout
          </button>
        </section>
      )}
      {history?.subscriptions
        .filter((subscription) => subscription.product === "bots_plus")
        .map((subscription) => (
          <section className="checkout-card billing-current" aria-label="Bots+ subscription" key={subscription.id}>
            <div className="grow">
              <h2>Bots+</h2>
              <p>$3.99 USD/month · {subscription.approvalPending ? "Checkout awaiting approval" : subscription.status.replaceAll("_", " ")}</p>
              <small>{communities.find((community) => community.id === subscription.orgId)?.name ?? "Community subscription"}</small>
              <p className="muted">
                {subscription.approvalPending
                  ? "No recurring payment has been authorized."
                  : subscription.currentPeriodEnd || subscription.billingStartAt
                    ? `${subscription.cancelAtPeriodEnd ? "Paid access ends" : "First / next billing date"}: ${date(subscription.currentPeriodEnd ?? subscription.billingStartAt ?? null)}`
                    : "No verified paid period yet."}
              </p>
              {["past_due", "unpaid", "paused"].includes(subscription.status) && (
                <p role="status">
                  Bots+ needs payment attention.{" "}
                  <a href={fundingUrl} target="_blank" rel="noreferrer">
                    Update your payment method in PayPal
                  </a>
                  , then refresh billing.
                </p>
              )}
            </div>
            {subscription.approvalPending ? (
              <button
                className="btn btn-secondary"
                disabled={!online || !subscription.orgId}
                onClick={() => subscription.orgId && returnToCheckout({ product: "bots_plus", orgId: subscription.orgId })}
              >
                Return to Bots+ checkout
              </button>
            ) : subscription.cancelAtPeriodEnd || subscription.status === "canceled" ? (
              <span className="checkout-sandbox">Renewal cancelled</span>
            ) : (
              !["incomplete_expired", "expired"].includes(subscription.status) && (
                <button className="btn btn-secondary" disabled={busy || !online} onClick={() => setCanceling({ id: subscription.id, name: "Bots+", until: subscription.currentPeriodEnd })}>
                  Cancel Bots+ renewal
                </button>
              )
            )}
          </section>
        ))}
      {sub && (sub.status === "past_due" || sub.status === "unpaid" || sub.status === "paused") && (
        <div className="banner danger" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          <span>Your subscription needs attention. Update your funding method in PayPal, then refresh billing. Benefits follow the verified payment state and your plan’s recovery policy.</span>
          <a href={fundingUrl} target="_blank" rel="noreferrer">
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
                {h.to === "incomplete" ? "checkout awaiting approval or first payment" : h.to === "incomplete_expired" ? "checkout expired" : h.to.replaceAll("_", " ")}
              </span>
              <time dateTime={new Date(h.at).toISOString()}>{date(h.at)}</time>
            </li>
          ))}
        </ol>
      </section>
      {canceling && (
        <Dialog
          title={`Cancel ${canceling.name} renewal?`}
          onClose={() => {
            if (!busy) setCanceling(null);
          }}
          footer={
            <>
              <button className="btn btn-secondary" disabled={busy} onClick={() => setCanceling(null)}>
                Keep {canceling.name}
              </button>
              <button className="btn btn-danger" disabled={busy || !online} onClick={() => void cancel()}>
                {busy ? "Confirming with PayPal…" : "Confirm cancellation"}
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p>
              PayPal will stop future renewals.{" "}
              {canceling.until
                ? `Your verified paid ${canceling.name} benefits continue until ${date(canceling.until)}.`
                : "Any existing free Plus time stays available. No paid period has been verified yet."}
            </p>
            <p>We’ll show confirmation after PayPal verifies the cancellation.</p>
            {error && <p role="alert">{error}</p>}
          </div>
        </Dialog>
      )}
    </div>
  );
}
