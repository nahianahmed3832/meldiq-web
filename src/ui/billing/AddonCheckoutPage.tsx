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

type Addon = Extract<CheckoutDraft, { product: "spark" | "bots_plus" }>;

export function AddonCheckoutPage({ draft, initial }: { draft: Addon; initial: ReturnType<typeof readCheckout> }) {
  const engine = useEngine();
  const online = useOrbit((s) => s.connection === "online");
  const catalog = useOrbit((s) => s.mojo.catalog);
  const community = useOrbit((s) => (draft.product === "bots_plus" ? (s.orgs.find((org) => org.id === draft.orgId)?.name ?? "this community") : null));
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
  const title = spark ? `${quantity} Meldiq Spark${quantity === 1 ? "" : "s"}` : "Meldiq Bots+";
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
        throw new Error("The order changed. Return to the product page and review a new checkout.");
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
      .catch(() => active && setError("Secure checkout could not load. Try again."));
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
        .catch(() => active && setError("This checkout could not be resumed. Review its status in Billing."));
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
        setError(e instanceof Error ? e.message : "Payment confirmation could not be checked.");
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
    if (!accepted || !online || !price || price.currency !== "USD") throw new Error("Review the order before paying.");
    const current = saved.current;
    const result = validate(
      current.purchaseId
        ? await engine.api.json("GET", `/v2/billing/paypal/checkouts/${encodeURIComponent(current.purchaseId)}`, zPayPalCheckout)
        : await engine.api.json("POST", "/v2/billing/paypal/checkouts", zPayPalCheckout, { body: { ...draft, requestKey: current.requestKey } }),
    );
    remember(result);
    if (["expired", "failed", "refunded", "canceled", "incomplete_expired"].includes(result.status) && !result.confirmed) throw new Error("This checkout has ended. Start a new checkout to continue.");
    if (result.confirmed) throw new Error("This purchase is already confirmed. Open Billing to view it.");
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
          <LockKeyhole size={14} aria-hidden="true" /> Secure checkout
        </span>
      </header>
      <button className="btn btn-ghost btn-sm checkout-back" onClick={back}>
        <ArrowLeft size={15} aria-hidden="true" /> {spark ? "Back to Sparks" : "Back to community bots"}
      </button>
      {purchase?.confirmed ? (
        <section className="checkout-success" role="status">
          <CheckCircle2 size={52} aria-hidden="true" />
          <span className="checkout-kicker">ALL SET</span>
          <h1>{spark ? "Your Sparks are ready." : "Bots+ is active."}</h1>
          <p>{spark ? "Choose a community to boost. Your purchased Sparks do not renew or expire." : `Premium bot features are now available for ${community}.`}</p>
          <p className="muted">
            {money(purchase.amountMinor, purchase.currency)} {purchase.currency} · {spark ? "one-time payment" : "monthly"}
            <br />
            PayPal reference: <code>{purchase.providerRef}</code>
          </p>
          <button className="btn btn-mojo" onClick={back}>
            {spark ? "Use your Sparks" : "Open community bots"}
          </button>
        </section>
      ) : (
        <>
          <div className="checkout-title">
            <span className="checkout-kicker">
              <Sparkles size={14} aria-hidden="true" /> MORE FOR YOUR COMMUNITY
            </span>
            <h1>{title}</h1>
            <p>{spark ? "Boost communities with a one-time purchase. No Mojo subscription is required." : `Premium community bots for ${community}, purchased separately from Mojo Plus.`}</p>
          </div>
          <div className="checkout-layout">
            <div className="checkout-payment">
              <section className="checkout-card" aria-labelledby="addon-payment-title">
                <div className="checkout-card-heading">
                  <span className="checkout-step">1</span>
                  <h2 id="addon-payment-title">Your payment</h2>
                  {config?.environment === "sandbox" && <span className="checkout-sandbox">Sandbox</span>}
                </div>
                {config?.environment === "sandbox" && <p className="muted">This is a test purchase. No real money is taken.</p>}
                <div className="checkout-account">
                  <ShieldCheck size={21} aria-hidden="true" />
                  <div>
                    <strong>Your Meldiq account</strong>
                    <p>{spark ? "Your purchased Sparks stay with your account." : `This subscription covers ${community}.`}</p>
                  </div>
                </div>
                <h3>Payment method</h3>
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
                  <span>PayPal handles your payment authorization. Meldiq never sees your card number or security code.</span>
                </p>
                <label className="checkout-agreement">
                  <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
                  <span>
                    {spark ? "I understand this is a one-time payment" : "I agree to the monthly subscription and cancellation terms"}, and agree to the{" "}
                    <a href="https://meldiq.app/legal/terms" target="_blank" rel="noopener noreferrer">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="https://meldiq.app/legal/billing" target="_blank" rel="noopener noreferrer">
                      payment terms
                    </a>
                    , and have read the{" "}
                    <a href="https://meldiq.app/legal/privacy" target="_blank" rel="noopener noreferrer">
                      Privacy Policy
                    </a>
                    .
                  </span>
                </label>
                {error && (
                  <p className="banner danger" role="alert">
                    {error}
                  </p>
                )}
                {!online && (
                  <p className="muted" role="status">
                    Reconnect to continue checkout.
                  </p>
                )}
                {catalog && !price && (
                  <p className="muted" role="status">
                    This product is not available for checkout yet.
                  </p>
                )}
                {config && price && !enabled && (
                  <p className="muted" role="status">
                    PayPal is not available for this product yet.
                  </p>
                )}
                {!accepted && <p className="checkout-hint">Agree to the terms to continue to payment.</p>}
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
                    cancel={() => setError("Checkout was canceled. Nothing is granted until payment is confirmed.")}
                    fail={setError}
                  />
                )}
                {purchase && !closed && (
                  <p role="status" className="muted">
                    {awaiting ? "Waiting for payment confirmation…" : "Your payment is awaiting confirmation. You can safely check its status again."}
                  </p>
                )}
                {saved.current.purchaseId && (
                  <button className="btn btn-secondary checkout-check" disabled={checking || !online} onClick={() => void check(false)}>
                    {checking ? "Checking…" : "Check payment status"}
                  </button>
                )}
                {closed && (
                  <button className="btn btn-secondary" onClick={() => selectCheckout(engine.device.userId, draft)}>
                    Start a new checkout
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
                    Retry checkout
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
            <aside className="checkout-card checkout-summary" aria-labelledby="addon-summary-title">
              <div className="checkout-card-heading">
                <span className="checkout-step">2</span>
                <h2 id="addon-summary-title">Order summary</h2>
              </div>
              <div className="checkout-plan-art">
                <span>{spark ? <Sparkles size={30} aria-hidden="true" /> : <Bot size={30} aria-hidden="true" />}</span>
                <span className="checkout-kicker">{spark ? "MELDIQ SPARK" : "COMMUNITY BOTS"}</span>
                <h3>{spark ? `${quantity} Spark${quantity === 1 ? "" : "s"}` : "Bots+"}</h3>
                <p>{spark ? "More for the communities you love" : community}</p>
              </div>
              <dl className="checkout-breakdown">
                <div>
                  <dt>{spark ? "Per Spark" : "Monthly subscription"}</dt>
                  <dd>{price ? money(price.amountMinor, price.currency) : "Loading…"}</dd>
                </div>
                {spark && (
                  <div>
                    <dt>Quantity</dt>
                    <dd>{quantity}</dd>
                  </div>
                )}
                <div className="checkout-total">
                  <dt>
                    Total today<small>{spark ? "One-time purchase" : "Renews monthly"}</small>
                  </dt>
                  <dd>
                    {price ? money(amount, price.currency) : "—"}
                    <small>USD</small>
                  </dd>
                </div>
              </dl>
              <p className="checkout-renewal">
                {spark
                  ? "$0.99 per Spark. No automatic renewal or expiry. Use a Spark in one community at a time, and move it with your account."
                  : "$3.99 per month for this community. Renews until canceled. Manage renewal in Billing. Mojo Plus is a separate subscription."}
              </p>
              <p className="checkout-fees">Billed in USD. Your payment provider may apply currency conversion fees.</p>
            </aside>
          </div>
          <footer className="checkout-footer">
            <BrandMark size={22} />
            <span>More connection. More Meldiq.</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate({ section: "settings", settingsPage: "billing" })}>
              Billing
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
