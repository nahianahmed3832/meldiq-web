import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, CheckCircle2, Sparkles } from "lucide-react";
import { useEngine, useOrbit } from "../../application/orbit";
import { setPrefs } from "../../application/prefs";
import { navigate } from "../../application/router";
import { type PayPalConfig, type PayPalPurchase, zPayPalCheckout, zPayPalConfig } from "../../api/paypalSchemas";
import { BrandMark } from "../components/BrandMark";
import { money } from "../mojo/mojoFormat";
import { type CheckoutDraft, readCheckout, selectCheckout, writeCheckout } from "./checkoutDraft";
import { PayPalButton } from "./PayPalButton";

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
  const [checking, setChecking] = useState(false);
  const [awaiting, setAwaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const spark = draft.product === "spark";
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
      if (p.product !== product || p.currency !== "USD" || p.amountMinor !== amount || (product === "spark" && p.quantity !== quantity) || (product === "bots_plus" && p.orgId !== orgId)) {
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
      if (stopped || ++count > 15) return;
      await check(false);
      if (!stopped) timer = setTimeout(() => void poll(), 2000);
    };
    timer = setTimeout(() => void poll(), 2000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [awaiting, purchase?.confirmed, check]);

  const create = async () => {
    setError(null);
    if (!accepted || !online || !price) throw new Error("Review the order before paying.");
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
  return (
    <div className="meldiq-checkout">
      <header className="checkout-brand">
        <span className="row">
          <BrandMark size={30} />
          <strong>Meldiq</strong>
        </span>
        <button className="btn btn-ghost" onClick={() => navigate({ section: "settings", settingsPage: "billing" })}>
          Billing
        </button>
      </header>
      <div className="settings-page" style={{ maxWidth: 720, margin: "0 auto" }}>
        {purchase?.confirmed ? (
          <section className="card setting-card" role="status">
            <CheckCircle2 size={30} aria-hidden="true" />
            <h1>{spark ? "Your Sparks are ready." : "Bots+ is active."}</h1>
            <p>{spark ? "Choose a community to boost. Your purchased Sparks do not renew or expire." : `Premium bot features are now available for ${community}.`}</p>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (draft.product === "bots_plus") {
                  setPrefs({ orgId: draft.orgId });
                  navigate({ section: "workspace", workspacePage: "bots" });
                } else navigate({ section: "settings", settingsPage: "spark" });
              }}
            >
              {spark ? "Use your Sparks" : "Open community bots"}
            </button>
          </section>
        ) : (
          <section className="card setting-card">
            {spark ? <Sparkles size={30} aria-hidden="true" /> : <Bot size={30} aria-hidden="true" />}
            <h1>{title}</h1>
            <p>{spark ? "Boost communities with a one-time purchase. No Mojo subscription is required." : `Premium community bots for ${community}, purchased separately from Mojo Plus.`}</p>
            <p className="checkout-total">
              <strong>{money(amount, "USD")}</strong> {spark ? "one time" : "per month"}
            </p>
            <p>
              {spark
                ? "$0.99 per Spark. No automatic renewal. Use a Spark in one community at a time, and move it with your account."
                : "$3.99 per month for this community. Renews until canceled. Mojo Plus is a separate subscription."}
            </p>
            {config?.environment === "sandbox" && <p className="banner warn">PayPal Sandbox · test purchases only</p>}
            {error && (
              <p className="banner danger" role="alert">
                {error}
              </p>
            )}
            {!online && <p className="banner warn">Reconnect to continue checkout.</p>}
            {price === null && <p className="muted">This product is not available for checkout yet.</p>}
            <label className="row">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              {spark ? "I understand this is a one-time payment." : "I agree to the monthly subscription and cancellation terms."}
            </label>
            <p className="faint">
              By purchasing, you agree to the{" "}
              <a href="https://meldiq.app/terms" target="_blank" rel="noopener noreferrer">
                Terms of Service
              </a>
              .
            </p>
            {config && (spark ? config.sparks : config.botsPlus) && price && accepted && online && !closed && (
              <PayPalButton
                config={config}
                subscription={!spark}
                create={create}
                approve={async () => {
                  setAwaiting(true);
                  await check(true);
                }}
                cancel={() => setError("Checkout was canceled. Nothing is granted until payment is confirmed.")}
                fail={setError}
              />
            )}
            {awaiting && <p role="status">Waiting for payment confirmation…</p>}
            {saved.current.purchaseId && (
              <button className="btn btn-secondary" disabled={checking || !online} onClick={() => void check(false)}>
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
                className="btn btn-ghost"
                onClick={() => {
                  setError(null);
                  setAttempt((value) => value + 1);
                }}
              >
                Retry checkout
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
