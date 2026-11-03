import { useLanguage } from "../../i18n";
import { updateHostedFieldLanguage } from "./localizedHostedFields";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { CardBillingAddress } from "./CardBillingAddress";
import { cardFieldTheme } from "./cardFieldTheme";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { loadCoreSdkScript, type CardFieldsOneTimePaymentSession } from "@paypal/paypal-js/sdk-v6";
import type { PayPalButton } from "./PayPalButton";
/** All sensitive inputs are PayPal-hosted components. Meldiq only submits its server-owned order reference. */
export function EmbeddedCardFields({ config, create, approve, cancel, fail }: ComponentProps<typeof PayPalButton>) {
  useLocaleRender();
  const language = useLanguage();
  const hostedFields = useRef<HTMLElement[]>([]);
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
        fields.createCardFieldsComponent({ style, type: "name", ariaLabel: uiText("billing.interface.name_on_card_18bf091"), placeholder: uiText("billing.interface.name_on_card_18bf091") }),
        fields.createCardFieldsComponent({ style, type: "number", ariaLabel: uiText("billing.interface.card_number_816fca1"), placeholder: uiText("billing.interface.card_number_816fca1") }),
        fields.createCardFieldsComponent({ style, type: "expiry", ariaLabel: uiText("billing.interface.expiration_date_8ccc3fd"), placeholder: "MM/YY" }),
        fields.createCardFieldsComponent({ style, type: "cvv", ariaLabel: uiText("billing.interface.security_code_1259260"), placeholder: "CVV" }),
      ];
      const containers = [name.current, number.current, expiry.current, cvv.current];
      inputs.forEach((input, i) => containers[i]?.replaceChildren(input));
      hostedFields.current = inputs;
      session.current = fields;
      cleanup = () => {
        inputs.forEach((input) => input.destroy());
        fields.destroy();
        hostedFields.current = [];
        session.current = null;
      };
      setStatus("ready");
    };
    void initialize().catch(() => {
      if (!disposed) {
        setStatus("unavailable");
        setError(uiText("billing.interface.secure_card_fields_could_not_load_check_your_connection_or_conten_444b78d"));
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
  useEffect(() => {
    updateHostedFieldLanguage(hostedFields.current, language);
  }, [language, status]);
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
      if (!purchase.providerRef || purchase.interval !== "one_time") throw new Error(uiText("billing.interface.card_checkout_requires_an_owned_one_time_order_6b77fa0"));
      const result = await current.submit(purchase.providerRef, { billingAddress: { countryCode: country, ...(postal.trim() ? { postalCode: postal.trim() } : {}) } });
      if (generation.current !== epoch) return;
      if (result.state === "canceled") {
        cancel();
        return;
      }
      if (result.state !== "succeeded") {
        setError(uiText("billing.interface.your_card_could_not_be_authorized_check_your_details_or_try_anoth_9a7ef12"));
        return;
      }
      // The SDK's returned IDs, amounts and success claims never identify the purchase or grant an entitlement.
      await approve();
    } catch {
      if (generation.current === epoch) fail(uiText("billing.interface.the_card_payment_could_not_be_verified_check_purchase_status_before__8efb5e0"));
    } finally {
      submitting.current = false;
      if (generation.current === epoch) setBusy(false);
    }
  };
  return (
    <section className="checkout-card-fields" aria-label={uiText("billing.interface.secure_debit_or_credit_card_payment_932b7c3")}>
      {status === "loading" && (
        <p role="status">
          <Localized k="billing.interface.loading_secure_card_fields_378a7cd" />
        </p>
      )}
      {status === "unavailable" && (
        <p role="status">
          <Localized k="billing.interface.embedded_cards_are_unavailable_for_this_purchase_you_can_explicit_d5e807f" />
        </p>
      )}
      <div hidden={status !== "ready"}>
        <label>
          <Localized k="billing.interface.name_on_card_18bf091" />
          <div className="checkout-hosted-field" ref={name} />
        </label>
        <label>
          <Localized k="billing.interface.card_number_816fca1" />
          <div className="checkout-hosted-field" ref={number} />
        </label>
        <div className="checkout-card-field-row">
          <label>
            <Localized k="billing.interface.expiration_date_8ccc3fd" />
            <div className="checkout-hosted-field" ref={expiry} />
          </label>
          <label>
            <Localized k="billing.interface.security_code_1259260" />
            <div className="checkout-hosted-field" ref={cvv} />
          </label>
        </div>
        <CardBillingAddress country={country} postal={postal} onCountry={setCountry} onPostal={setPostal} disabled={busy} />
        <p className="muted">
          <Localized k="billing.interface.paypal_securely_processes_your_card_your_bank_may_ask_you_to_veri_1be5a0c" />
        </p>
        <button className="btn btn-mojo checkout-check" type="button" disabled={busy || status !== "ready" || !country} onClick={() => void pay()}>
          {busy ? uiText("billing.interface.verifying_payment_52f2be6") : uiText("billing.interface.complete_purchase_e5e644c")}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {status === "unavailable" && (
        <button className="btn btn-secondary" type="button" onClick={() => setAttempt((value) => value + 1)}>
          <Localized k="billing.interface.retry_secure_card_fields_e4c0674" />
        </button>
      )}
    </section>
  );
}
