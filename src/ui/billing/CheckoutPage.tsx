import { CHECKOUT_DRAFT_EVENT, restoreCheckout } from "./checkoutDraft";
import { AddonCheckoutPage } from "./AddonCheckoutPage";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CreditCard, Crown, Gift, LockKeyhole, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { type PayPalConfig, type PayPalPurchase, zPayPalCheckout, zPayPalConfig } from "../../api/paypalSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import { BrandMark } from "../components/BrandMark";
import { money, size } from "../mojo/mojoFormat";
import { readCheckout, writeCheckout } from "./checkoutDraft";
import { PayPalButton } from "./PayPalButton";

const billing = () => navigate({ section: "settings", settingsPage: "billing" });

/** Meldiq owns the review and confirmation. The API owns pricing, payment verification and all entitlements. */
function PlusCheckoutPage({ initial }: { initial: ReturnType<typeof readCheckout> }) {
  const engine = useEngine();
  const catalog = useOrbit((s) => s.mojo.catalog);
  const online = useOrbit((s) => s.connection === "online");
  const userId = engine.device.userId;
  const [saved, setSaved] = useState(() => initial);
  const savedRef = useRef(saved);
  const [config, setConfig] = useState<PayPalConfig | null>(null);
  const [purchase, setPurchase] = useState<PayPalPurchase | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const draft = saved.draft;
  const gift = draft.product === "gift";
  const recipient = useOrbit((s) => (gift ? (s.users[draft.recipientUserId]?.displayName ?? draft.recipientUserId) : null));
  const price = catalog?.onSale.plus;
  const amount = (price?.amountMinor ?? 399) * (gift ? draft.months : 1);
  const currency = price?.currency ?? "USD";
  const plus = catalog?.plans.find((p) => p.key === "plus");
  const sandbox = config?.environment === "sandbox";
  const deferred = !gift && config?.billingStartAt != null && config.billingStartAt > Date.now();
  const startDate = config?.billingStartAt ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(config.billingStartAt) : null;
  const complete = purchase?.confirmed === true || (purchase?.approved === true && deferred);

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
        if (p.confirmed || p.approved) remember({ ...savedRef.current, completed: true });
        setMessage(p.confirmed ? null : "Your payment is still awaiting confirmation. You can safely check its status again.");
        await engine.mojo.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "We could not verify the payment yet. Check its status before trying again.");
      } finally {
        setChecking(false);
      }
    },
    [engine, remember],
  );

  useEffect(() => {
    let disposed = false;
    writeCheckout(userId, savedRef.current);
    void engine.mojo.refresh();
    void engine.api
      .json("GET", "/v2/billing/paypal/config", zPayPalConfig)
      .then((c) => {
        if (!disposed) setConfig(c);
      })
      .catch((e: unknown) => {
        if (!disposed) setError(e instanceof ApiError && e.status === 404 ? "PayPal checkout is not available on this server yet." : e instanceof Error ? e.message : "Checkout could not load.");
      });
    const q = new URLSearchParams(location.search);
    const canceled = q.get("checkout") === "canceled" || q.get("gift") === "canceled";
    const returned = q.has("checkout") || q.has("gift") || q.has("token") || q.has("subscription_id");
    if (returned) history.replaceState(history.state, "", location.pathname);
    if (canceled) setMessage("You closed PayPal checkout. Check the purchase status before trying again.");
    // Query parameters never identify a purchase or prove payment. Only the stored, account-owned ID is used.
    if (savedRef.current.purchaseId) void verify(returned && !canceled);
    return () => {
      disposed = true;
    };
  }, [engine, userId, verify]);

  const create = async () => {
    setError(null);
    setMessage(null);
    if (!accepted || !online || !price || currency !== "USD") throw new Error("Review the order and agree to the terms before paying.");
    const current = savedRef.current;
    const p = current.purchaseId
      ? await engine.api.json("GET", `/v2/billing/paypal/checkouts/${encodeURIComponent(current.purchaseId)}`, zPayPalCheckout)
      : await engine.api.json("POST", "/v2/billing/paypal/checkouts", zPayPalCheckout, { body: { ...current.draft, requestKey: current.requestKey } });
    remember({ ...current, purchaseId: p.id, completed: p.confirmed || p.approved === true });
    setPurchase(p);
    if (p.confirmed || p.approved) throw new Error("This purchase is already confirmed. Open Billing to view it.");
    if (p.amountMinor !== amount || p.currency !== currency) throw new Error("The price changed before checkout. Reload this page and review the updated order.");
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
          <LockKeyhole size={14} aria-hidden="true" /> Secure checkout
        </span>
      </header>
      <button className="btn btn-ghost btn-sm checkout-back" onClick={() => navigate({ section: "settings", settingsPage: "mojo" })}>
        <ArrowLeft size={15} aria-hidden="true" /> Back to Mojo
      </button>
      {complete ? (
        <section className="checkout-success" aria-labelledby="checkout-success-title">
          <CheckCircle2 size={52} aria-hidden="true" />
          <span className="checkout-kicker">ALL SET</span>
          <h1 id="checkout-success-title">{gift ? "A little more Mojo, gifted." : deferred && !purchase?.confirmed ? "Your Plus renewal is scheduled." : "Welcome to Plus."}</h1>
          <p>
            {gift
              ? "Your gift payment is confirmed. Your friend can start their Plus time from Meldiq Mojo."
              : deferred && !purchase?.confirmed
                ? `PayPal has confirmed your approval. Your first payment is ${startDate}; your existing Plus time stays available until then.`
                : "Your subscription is confirmed. Your Plus benefits are now available across your Meldiq devices."}
          </p>
          <p className="muted">
            {money(purchase!.amountMinor, purchase!.currency)} {gift ? "· one-time payment" : "· monthly"}
            <br />
            PayPal reference: <code>{purchase?.providerRef}</code>
          </p>
          <button className="btn btn-mojo" onClick={billing}>
            View billing <ArrowRight size={16} aria-hidden="true" />
          </button>
        </section>
      ) : (
        <>
          <div className="checkout-title">
            <span className="checkout-kicker">
              <Sparkles size={14} aria-hidden="true" /> A LITTLE MORE MELDIQ
            </span>
            <h1>{gift ? "Make their day with Plus." : "Make room for more."}</h1>
            <p>{gift ? "A thoughtful upgrade for someone you love talking to." : "Your conversations. A little more possibility."}</p>
          </div>
          <div className="checkout-layout">
            <div className="checkout-payment">
              <section className="checkout-card" aria-labelledby="checkout-payment-title">
                <div className="checkout-card-heading">
                  <span className="checkout-step">1</span>
                  <h2 id="checkout-payment-title">Your payment</h2>
                  {sandbox && <span className="checkout-sandbox">Sandbox</span>}
                </div>
                {config && (
                  <p className="muted">
                    {sandbox
                      ? "This is a test purchase. No real money is taken."
                      : deferred
                        ? `Your existing Plus time stays available. Your first payment is ${startDate}.`
                        : "Review your purchase before authorizing payment with PayPal."}
                  </p>
                )}
                <div className="checkout-account">
                  <ShieldCheck size={21} aria-hidden="true" />
                  <div>
                    <strong>Your Meldiq account</strong>
                    <p>This purchase is linked to the account you’re signed in to.</p>
                  </div>
                  <Check size={16} aria-hidden="true" />
                </div>
                <h3>Payment method</h3>
                <div className="checkout-method" role="radiogroup" aria-label="Payment method">
                  <div role="radio" aria-checked="true" tabIndex={0}>
                    <span className="checkout-radio" />
                    <div>
                      <strong>PayPal</strong>
                      <small>Authorize securely with PayPal</small>
                    </div>
                    <CreditCard size={24} aria-hidden="true" />
                  </div>
                </div>
                <p className="checkout-security">
                  <LockKeyhole size={15} aria-hidden="true" />
                  <span>PayPal securely handles payment authorization. Meldiq never sees your card number or security code.</span>
                </p>
                <label className="checkout-agreement">
                  <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                  <span>
                    I agree to the{" "}
                    <a href="https://meldiq.app/legal/terms" target="_blank" rel="noreferrer">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="https://meldiq.app/legal/billing" target="_blank" rel="noreferrer">
                      subscription terms
                    </a>
                    , and have read the{" "}
                    <a href="https://meldiq.app/legal/privacy" target="_blank" rel="noreferrer">
                      Privacy Policy
                    </a>
                    .
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
                    You’re offline. Reconnect to continue.
                  </p>
                )}
                {config && !config.subscriptions && !gift && (
                  <p role="status" className="muted">
                    Recurring PayPal payments are not available for this app yet.
                  </p>
                )}
                {catalog && !price && (
                  <p role="status" className="muted">
                    This offer is not available for purchase yet.
                  </p>
                )}
                {!accepted && <p className="checkout-hint">Agree to the terms to continue with PayPal.</p>}
                {config && accepted && online && price && (gift || config.subscriptions) && (
                  <PayPalButton
                    key={attempt}
                    config={config}
                    subscription={!gift}
                    create={create}
                    approve={() => verify(true)}
                    cancel={() => setMessage("You closed PayPal checkout. You can check the purchase status below.")}
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
                    Try loading PayPal again
                  </button>
                )}
                {saved.purchaseId && (
                  <button className="btn btn-secondary checkout-check" disabled={checking || !online} onClick={() => void verify(false)}>
                    <RefreshCw size={15} className={checking ? "spin" : ""} aria-hidden="true" />
                    {checking ? "Checking payment…" : "Check purchase status"}
                  </button>
                )}
              </section>
              <div className="checkout-trust">
                <ShieldCheck size={18} aria-hidden="true" />
                <p>
                  Securely processed by PayPal.
                  <br />
                  <span>Benefits begin after payment is verified.</span>
                </p>
              </div>
            </div>
            <aside className="checkout-card checkout-summary" aria-labelledby="checkout-summary-title">
              <div className="checkout-card-heading">
                <span className="checkout-step">2</span>
                <h2 id="checkout-summary-title">Order summary</h2>
              </div>
              <div className="checkout-plan-art">
                <span>{gift ? <Gift size={30} aria-hidden="true" /> : <Crown size={30} aria-hidden="true" />}</span>
                <Sparkles size={18} className="checkout-art-spark" aria-hidden="true" />
                <span className="checkout-kicker">MELDIQ MOJO</span>
                <h3>Plus{gift ? " Gift" : ""}</h3>
                <p>{gift ? `${draft.months} month${draft.months === 1 ? "" : "s"} of more` : "More of what brings you together"}</p>
              </div>
              <dl className="checkout-breakdown">
                <div>
                  <dt>{gift ? `Plus · ${draft.months} month${draft.months === 1 ? "" : "s"}` : "Plus · monthly"}</dt>
                  <dd>{money(amount, currency)}</dd>
                </div>
                <div>
                  <dt>Tax added</dt>
                  <dd>{money(0, currency)}</dd>
                </div>
                <div className="checkout-total">
                  <dt>
                    {gift ? "Total" : "Total today"}
                    <small>{gift ? "One-time purchase" : deferred ? `First payment ${startDate}` : "Renews monthly"}</small>
                  </dt>
                  <dd>
                    {money(deferred ? 0 : amount, currency)}
                    <small>{currency}</small>
                  </dd>
                </div>
              </dl>
              {gift && (
                <p className="checkout-renewal">
                  Gift for <strong>{recipient}</strong>
                  {draft.note && (
                    <>
                      <br />
                      Your note: {draft.note}
                    </>
                  )}
                </p>
              )}
              <p className="checkout-renewal">
                {gift
                  ? "One payment. No automatic renewal. Your friend chooses when to start their gift."
                  : deferred
                    ? `${money(amount, currency)} ${currency} on ${startDate}, then every month until you cancel. Your existing Plus time is preserved.`
                    : `Then ${money(amount, currency)} ${currency} every month until you cancel. Cancel from Billing; your verified paid period remains available.`}
              </p>
              {plus && (
                <ul className="checkout-perks">
                  <li>
                    <Check size={15} aria-hidden="true" />
                    {plus.messageChars.toLocaleString()} characters per message
                  </li>
                  <li>
                    <Check size={15} aria-hidden="true" />
                    Files up to {size(plus.uploadBytes)}
                  </li>
                  <li>
                    <Check size={15} aria-hidden="true" />
                    {plus.sparks} included Sparks
                  </li>
                  <li>
                    <Check size={15} aria-hidden="true" />
                    Plus badge and customization
                  </li>
                </ul>
              )}
              <p className="checkout-fees">Billed in {currency}. Your payment provider may apply currency conversion fees.</p>
            </aside>
          </div>
          <footer className="checkout-footer">
            <BrandMark size={22} />
            <span>More connection. More Meldiq.</span>
            <a href="https://meldiq.app/support" target="_blank" rel="noreferrer">
              Need a hand?
            </a>
          </footer>
        </>
      )}
    </div>
  );
}

/** Add-ons have their own receipts and terms; no Plus subscription is required. */
export function CheckoutPage() {
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
        if (!disposed) setResumeError(e instanceof Error ? e.message : "Purchase could not be loaded.");
      });
    return () => {
      disposed = true;
    };
  }, [engine]);
  if (resuming)
    return (
      <div className="mojo checkout-page">
        <h1>Resume your purchase</h1>
        <p role={resumeError ? "alert" : "status"}>{resumeError ?? "Checking your purchase…"}</p>
        <button className="btn btn-secondary" onClick={billing}>
          Back to billing
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
