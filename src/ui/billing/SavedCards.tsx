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
export function SavedCards({ onChanged }: { onChanged?: () => void } = {}) {
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
    setNotice("Card saved securely with PayPal.");
  };
  let pending: string | null = null;
  try {
    pending = sessionStorage.getItem(setupKey(engine.device.userId));
  } catch {
    /* Storage is optional. */
  }
  return (
    <section className="checkout-card">
      <h2>Saved cards</h2>
      <p className="muted">PayPal stores your card details. Meldiq stores an encrypted payment reference and the masked information below.</p>
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
            {m.expiry ? ` · expires ${m.expiry}` : ""}
          </span>
          <button
            className="btn btn-secondary"
            disabled={action.busy}
            onClick={() => {
              if (confirm(`Remove ${m.brand} ending ${m.lastFour}?`))
                void action.act(async () => {
                  await engine.api.json("DELETE", `/v2/billing/payment-methods/${encodeURIComponent(m.id)}`, z.object({ removed: z.literal(true) }));
                  methods.reload();
                  onChanged?.();
                  setNotice("Card removed.");
                });
            }}
          >
            Remove
          </button>
        </div>
      ))}
      {!methods.data.methods.length && <p>No cards saved.</p>}
      {pending && !adding && (
        <button className="btn btn-secondary" disabled={action.busy} onClick={() => void action.act(() => complete(pending))}>
          Check unfinished card verification
        </button>
      )}
      {canSave &&
        config.data &&
        (adding ? (
          <SaveCardForm config={config.data} onSaved={complete} onClose={() => setAdding(false)} />
        ) : (
          <button className="btn btn-secondary" onClick={() => setAdding(true)}>
            Add a card
          </button>
        ))}
    </section>
  );
}
function SaveCardForm({ config, onSaved, onClose }: { config: PayPalConfig; onSaved: (id: string) => Promise<void>; onClose: () => void }) {
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
      if (!disposed) setError("Secure card fields are taking too long. Close this form and try again.");
    }, 45000);
    void (async () => {
      const sdk = await loadCoreSdkScript({ environment: config.environment === "live" ? "production" : "sandbox" });
      if (!sdk || disposed) return;
      const instance = await sdk.createInstance({ clientId: config.clientId, components: ["card-fields"] });
      const eligible = await instance.findEligibleMethods({ currencyCode: "USD" });
      if (disposed) return;
      if (!eligible.isEligible("advanced_cards")) throw new Error("Card saving is unavailable for this account or browser.");
      const fields = instance.createCardFieldsSavePaymentSession();
      const style = cardFieldTheme();
      const inputs = (["name", "number", "expiry", "cvv"] as const).map((type) =>
        fields.createCardFieldsComponent({ style, type, ariaLabel: type === "name" ? "Name on card" : type === "number" ? "Card number" : type === "expiry" ? "Expiration date" : "Security code" }),
      );
      [name.current, number.current, expiry.current, cvv.current].forEach((container, i) => container?.replaceChildren(inputs[i]));
      session.current = fields;
      cleanup = () => {
        inputs.forEach((i) => i.destroy());
        fields.destroy();
        session.current = null;
      };
      clearTimeout(timeout);
      setReady(true);
      setError(null);
    })().catch((e) => {
      if (!disposed) setError(e instanceof Error ? e.message : "Secure card fields could not load.");
    });
    return () => {
      disposed = true;
      alive.current = false;
      clearTimeout(timeout);
      cleanup();
    };
  }, [config.clientId, config.environment, number, expiry, cvv]);
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
      else setError(result.state === "canceled" ? "Card verification was closed. No card has been saved in Meldiq." : "PayPal could not verify this card. Check the details and retry.");
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "Card verification could not finish. Check its status before starting another setup.");
    } finally {
      submitting.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return (
    <div className="checkout-card-fields">
      <p>Saving a card does not start a subscription. PayPal may ask your bank to verify it.</p>
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
      {!ready && !error && <p role="status">Loading secure card fields…</p>}
      {error && (
        <p role="alert" className="banner danger">
          {error}
        </p>
      )}
      <label className="checkbox">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={busy} />
        Save this card securely with PayPal for future Meldiq payments.
      </label>
      <button className="btn btn-mojo" disabled={!ready || !consent || busy || !country} onClick={() => void save()}>
        {busy ? "Verifying…" : "Save card"}
      </button>
      <button className="btn btn-ghost" disabled={busy} onClick={onClose}>
        Close
      </button>
    </div>
  );
}
