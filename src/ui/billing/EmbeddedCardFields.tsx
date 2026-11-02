import { CardBillingAddress } from "./CardBillingAddress";
import { cardFieldTheme } from "./cardFieldTheme";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { loadCoreSdkScript, type CardFieldsOneTimePaymentSession } from "@paypal/paypal-js/sdk-v6";
import type { PayPalButton } from "./PayPalButton";

/** All sensitive inputs are PayPal-hosted components. Meldiq only submits its server-owned order reference. */
export function EmbeddedCardFields({ config, create, approve, cancel, fail }: ComponentProps<typeof PayPalButton>) {
  const [country, setCountry] = useState("");
  const [postal, setPostal] = useState("");
  const name = useRef<HTMLDivElement>(null);
  const number = useRef<HTMLDivElement>(null);
  const expiry = useRef<HTMLDivElement>(null);
  const cvv = useRef<HTMLDivElement>(null);
  const session = useRef<CardFieldsOneTimePaymentSession | null>(null);
  const submitting = useRef(false);
  const generation = useRef(0);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    const epoch = ++generation.current;
    let cleanup = () => {};
    setStatus("loading");
    setError(null);
    const initialize = async () => {
      const sdk = await loadCoreSdkScript({ environment: config.environment === "live" ? "production" : "sandbox" });
      if (!sdk || disposed) return;
      const instance = await sdk.createInstance({ clientId: config.clientId, components: ["card-fields"] });
      const eligible = await instance.findEligibleMethods({ currencyCode: "USD" });
      if (disposed) return;
      if (!eligible.isEligible("advanced_cards")) {
        setStatus("unavailable");
        return;
      }
      const fields = instance.createCardFieldsOneTimePaymentSession();
      const style = cardFieldTheme();
      const inputs = [
        fields.createCardFieldsComponent({ style, type: "name", ariaLabel: "Name on card", placeholder: "Name on card" }),
        fields.createCardFieldsComponent({ style, type: "number", ariaLabel: "Card number", placeholder: "Card number" }),
        fields.createCardFieldsComponent({ style, type: "expiry", ariaLabel: "Expiration date", placeholder: "MM/YY" }),
        fields.createCardFieldsComponent({ style, type: "cvv", ariaLabel: "Security code", placeholder: "CVV" }),
      ];
      const containers = [name.current, number.current, expiry.current, cvv.current];
      inputs.forEach((input, i) => containers[i]?.replaceChildren(input));
      session.current = fields;
      cleanup = () => {
        inputs.forEach((input) => input.destroy());
        fields.destroy();
        session.current = null;
      };
      setStatus("ready");
    };
    void initialize().catch(() => {
      if (!disposed) {
        setStatus("unavailable");
        setError("Secure card fields could not load. Check your connection or content blocker, then retry.");
      }
    });
    return () => {
      disposed = true;
      // This ref is a cancellation counter, so cleanup intentionally reads its current value.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (generation.current === epoch) generation.current++;
      cleanup();
    };
  }, [config.clientId, config.environment, attempt]);
  const pay = async () => {
    if (submitting.current || !session.current || status !== "ready" || !country) return;
    const current = session.current;
    const epoch = generation.current;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const purchase = await create();
      if (generation.current !== epoch) return;
      if (!purchase.providerRef || purchase.interval !== "one_time") throw new Error("Card checkout requires an owned one-time order.");
      const result = await current.submit(purchase.providerRef, { billingAddress: { countryCode: country, ...(postal.trim() ? { postalCode: postal.trim() } : {}) } });
      if (generation.current !== epoch) return;
      if (result.state === "canceled") {
        cancel();
        return;
      }
      if (result.state !== "succeeded") {
        setError("Your card could not be authorized. Check your details or try another payment method.");
        return;
      }
      // The SDK's returned IDs, amounts and success claims never identify the purchase or grant an entitlement.
      await approve();
    } catch {
      if (generation.current === epoch) fail("The card payment could not be verified. Check purchase status before retrying.");
    } finally {
      submitting.current = false;
      if (generation.current === epoch) setBusy(false);
    }
  };
  return (
    <section className="checkout-card-fields" aria-label="Secure debit or credit card payment">
      {status === "loading" && <p role="status">Loading secure card fields…</p>}
      {status === "unavailable" && <p role="status">Embedded cards are unavailable for this purchase. You can explicitly choose PayPal Wallet or check again.</p>}
      <div hidden={status !== "ready"}>
        <label>
          Name on card
          <div className="checkout-hosted-field" ref={name} />
        </label>
        <label>
          Card number
          <div className="checkout-hosted-field" ref={number} />
        </label>
        <div className="checkout-card-field-row">
          <label>
            Expiration date
            <div className="checkout-hosted-field" ref={expiry} />
          </label>
          <label>
            Security code
            <div className="checkout-hosted-field" ref={cvv} />
          </label>
        </div>
        <CardBillingAddress country={country} postal={postal} onCountry={setCountry} onPostal={setPostal} disabled={busy} />
        <p className="muted">PayPal securely processes your card. Your bank may ask you to verify the payment.</p>
        <button className="btn btn-mojo checkout-check" type="button" disabled={busy || status !== "ready" || !country} onClick={() => void pay()}>
          {busy ? "Verifying payment…" : "Complete purchase"}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {status === "unavailable" && (
        <button className="btn btn-secondary" type="button" onClick={() => setAttempt((value) => value + 1)}>
          Retry secure card fields
        </button>
      )}
    </section>
  );
}
