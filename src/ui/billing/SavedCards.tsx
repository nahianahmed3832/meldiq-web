import { useLanguage } from "../../i18n";
import { updateHostedFieldLanguage } from "./localizedHostedFields";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { CardBillingAddress } from "./CardBillingAddress";
import { cardFieldTheme } from "./cardFieldTheme";
import { useEffect, useRef, useState } from "react";
import { loadCoreSdkScript, type CardFieldsSavePaymentSession } from "@paypal/paypal-js/sdk-v6";
import { z } from "zod";
import { useEngine } from "../../application/orbit";
import { zPayPalConfig, type PayPalConfig } from "../../api/paypalSchemas";
import { useAction, useLoad } from "../workspace/useLoad";
const Method = z.object({ id: z.string(), brand: z.string(), lastFour: z.string(), expiry: z.string().nullable(), createdAt: z.number() });
const Methods = z.object({ available: z.boolean(), methods: z.array(Method) });
const Setup = z.object({ id: z.string(), setupToken: z.string(), expiresAt: z.number() });
const setupKey = (user: string) => `meldiq.cardSetup.${user}`;
export function SavedCards({
  onChanged,
}: {
  onChanged?: () => void;
} = {}) {
  useLocaleRender();
  const engine = useEngine();
  const methods = useLoad(() => engine.api.json("GET", "/v2/billing/payment-methods", Methods), [engine]);
  const config = useLoad(() => engine.api.json("GET", "/v2/billing/paypal/config", zPayPalConfig), [engine]);
  const action = useAction();
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const canSave = methods.data?.available === true && config.data?.advancedCards?.vault === true;
  if (!methods.data || (!canSave && methods.data.methods.length === 0)) return null;
  const complete = async (id: string) => {
    await engine.api.json("POST", `/v2/billing/payment-methods/setups/${encodeURIComponent(id)}/complete`, Method, { body: {} });
    sessionStorage.removeItem(setupKey(engine.device.userId));
    methods.reload();
    onChanged?.();
    setAdding(false);
    setNotice(uiText("billing.interface.card_saved_securely_with_paypal_a0063ee"));
  };
  let pending: string | null = null;
  try {
    pending = sessionStorage.getItem(setupKey(engine.device.userId));
  } catch {
    /* Storage is optional. */
  }
  return (
    <section className="checkout-card">
      <h2>
        <Localized k="billing.interface.saved_cards_07a91c6" />
      </h2>
      <p className="muted">
        <Localized k="billing.interface.paypal_stores_your_card_details_meldiq_stores_an_encrypted_paymen_5bef417" />
      </p>
      {notice && <p role="status">{notice}</p>}
      {action.error && (
        <p className="banner danger" role="alert">
          {action.error}
        </p>
      )}
      {methods.data.methods.map((m) => (
        <div className="row" key={m.id}>
          <span className="grow">
            {m.brand} ···· {m.lastFour}
            {m.expiry ? uiText("billing.interface.expires_value0_071b3a0", { value0: m.expiry }) : ""}
          </span>
          <button
            className="btn btn-secondary"
            disabled={action.busy}
            onClick={() => {
              if (confirm(uiText("billing.interface.remove_ending_a80e6c4", { value0: m.brand, value1: m.lastFour })))
                void action.act(async () => {
                  await engine.api.json("DELETE", `/v2/billing/payment-methods/${encodeURIComponent(m.id)}`, z.object({ removed: z.literal(true) }));
                  methods.reload();
                  onChanged?.();
                  setNotice(uiText("billing.interface.card_removed_1dd30ce"));
                });
            }}
          >
            <Localized k="common.actions.remove" />
          </button>
        </div>
      ))}
      {!methods.data.methods.length && (
        <p>
          <Localized k="billing.interface.no_cards_saved_0d1373a" />
        </p>
      )}
      {pending && !adding && (
        <button className="btn btn-secondary" disabled={action.busy} onClick={() => void action.act(() => complete(pending))}>
          <Localized k="billing.interface.check_unfinished_card_verification_7c1385c" />
        </button>
      )}
      {canSave &&
        config.data &&
        (adding ? (
          <SaveCardForm config={config.data} onSaved={complete} onClose={() => setAdding(false)} />
        ) : (
          <button className="btn btn-secondary" onClick={() => setAdding(true)}>
            <Localized k="billing.interface.add_a_card_be8f51d" />
          </button>
        ))}
    </section>
  );
}
function SaveCardForm({ config, onSaved, onClose }: { config: PayPalConfig; onSaved: (id: string) => Promise<void>; onClose: () => void }) {
  useLocaleRender();
  const language = useLanguage();
  const hostedFields = useRef<HTMLElement[]>([]);
  const engine = useEngine();
  const name = useRef<HTMLDivElement>(null);
  const containers = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const session = useRef<CardFieldsSavePaymentSession | null>(null);
  const alive = useRef(true);
  const [country, setCountry] = useState("");
  const [postal, setPostal] = useState("");
  const [ready, setReady] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const requestKey = useRef(crypto.randomUUID());
  const [number, expiry, cvv] = containers;
  useEffect(() => {
    let disposed = false;
    alive.current = true;
    let cleanup = () => {};
    const timeout = setTimeout(() => {
      if (!disposed) setError(uiText("billing.interface.secure_card_fields_are_taking_too_long_close_this_form_and_try_ag_9210093"));
    }, 45000);
    void (async () => {
      const sdk = await loadCoreSdkScript({ environment: config.environment === "live" ? "production" : "sandbox" });
      if (!sdk || disposed) return;
      const instance = await sdk.createInstance({ clientId: config.clientId, components: ["card-fields"] });
      const eligible = await instance.findEligibleMethods({ currencyCode: "USD" });
      if (disposed) return;
      if (!eligible.isEligible("advanced_cards")) throw new Error(uiText("billing.interface.card_saving_is_unavailable_for_this_account_or_browser_1eee318"));
      const fields = instance.createCardFieldsSavePaymentSession();
      const style = cardFieldTheme();
      const inputs = (["name", "number", "expiry", "cvv"] as const).map((type) =>
        fields.createCardFieldsComponent({
          style,
          type,
          ariaLabel:
            type === "name"
              ? uiText("billing.interface.name_on_card_18bf091")
              : type === "number"
                ? uiText("billing.interface.card_number_816fca1")
                : type === "expiry"
                  ? uiText("billing.interface.expiration_date_8ccc3fd")
                  : uiText("billing.interface.security_code_1259260"),
        }),
      );
      [name.current, number.current, expiry.current, cvv.current].forEach((container, i) => container?.replaceChildren(inputs[i]));
      hostedFields.current = inputs;
      session.current = fields;
      cleanup = () => {
        inputs.forEach((i) => i.destroy());
        fields.destroy();
        hostedFields.current = [];
        session.current = null;
      };
      clearTimeout(timeout);
      setReady(true);
      setError(null);
    })().catch((e) => {
      if (!disposed) setError(e instanceof Error ? e.message : uiText("billing.interface.secure_card_fields_could_not_load_9b0aca4"));
    });
    return () => {
      disposed = true;
      alive.current = false;
      clearTimeout(timeout);
      cleanup();
    };
  }, [config.clientId, config.environment, number, expiry, cvv]);
  useEffect(() => {
    updateHostedFieldLanguage(hostedFields.current, language);
  }, [language, ready]);
  const save = async () => {
    if (!session.current || !consent || submitting.current || !country) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const setup = await engine.api.json("POST", "/v2/billing/payment-methods/setups", Setup, { body: { requestKey: requestKey.current } });
      if (!alive.current) return;
      try {
        sessionStorage.setItem(setupKey(engine.device.userId), setup.id);
      } catch {
        /* The form still completes without persistence. */
      }
      const result = await session.current!.submit(setup.setupToken, { billingAddress: { countryCode: country, ...(postal.trim() ? { postalCode: postal.trim() } : {}) } });
      if (!alive.current) return;
      if (result.state === "succeeded") await onSaved(setup.id);
      else
        setError(
          result.state === "canceled"
            ? uiText("billing.interface.card_verification_was_closed_no_card_has_been_saved_in_meldiq_46c8cfc")
            : uiText("billing.interface.paypal_could_not_verify_this_card_check_the_details_and_retry_ddbebea"),
        );
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : uiText("billing.interface.card_verification_could_not_finish_check_its_status_before_starti_19c68c4"));
    } finally {
      submitting.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return (
    <div className="checkout-card-fields">
      <p>
        <Localized k="billing.interface.saving_a_card_does_not_start_a_subscription_paypal_may_ask_your_b_c52e0b3" />
      </p>
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
      {!ready && !error && (
        <p role="status">
          <Localized k="billing.interface.loading_secure_card_fields_378a7cd" />
        </p>
      )}
      {error && (
        <p role="alert" className="banner danger">
          {error}
        </p>
      )}
      <label className="checkbox">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={busy} />
        <Localized k="billing.interface.save_this_card_securely_with_paypal_for_future_meldiq_payments_eb7ac6f" />
      </label>
      <button className="btn btn-mojo" disabled={!ready || !consent || busy || !country} onClick={() => void save()}>
        {busy ? uiText("billing.interface.verifying_63bbd08") : uiText("billing.interface.save_card_27528dd")}
      </button>
      <button className="btn btn-ghost" disabled={busy} onClick={onClose}>
        <Localized k="common.actions.close" />
      </button>
    </div>
  );
}
