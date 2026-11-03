import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useEffect, useRef, useState } from "react";
import { loadScript, type PayPalNamespace } from "@paypal/paypal-js";
import type { PayPalConfig, PayPalPurchase } from "../../api/paypalSchemas";
const scripts = new Map<string, Promise<PayPalNamespace | null>>();
export type CardAvailability = "loading" | "ready" | "unavailable" | "error";
/** Keep a visible card choice even if PayPal blocks or cannot load its eligibility check. */
export function usePayPalCardSdk(config: PayPalConfig | null, subscription: boolean, attempt = 0) {
  const scriptKey = config ? `${config.environment}:${config.clientId}:${subscription}` : "";
  const key = `${scriptKey}:${attempt}`;
  const [result, setResult] = useState<{
    key: string;
    sdk: PayPalNamespace | null;
    status: CardAvailability;
  } | null>(null);
  useEffect(() => {
    if (!config) return;
    if ((!subscription && config.advancedCards?.oneTime) || (subscription && config.advancedCards?.recurring)) {
      // The embedded v6 control performs its own advanced_cards eligibility check before rendering fields.
      setResult({ key, sdk: null, status: "ready" });
      return;
    }
    let disposed = false;
    let script = scripts.get(scriptKey);
    if (!script) {
      const loaded = loadScript({
        clientId: config.clientId,
        environment: config.environment === "live" ? "production" : "sandbox",
        components: ["buttons", "funding-eligibility"],
        currency: "USD",
        intent: subscription ? "subscription" : "capture",
        vault: subscription,
        enableFunding: ["card"],
        dataNamespace: subscription ? "meldiqSubscriptionCards" : "meldiqOrderCards",
      });
      script = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(uiText("billing.interface.card_eligibility_timed_out_9d790da"))), 15000);
        void loaded.then(resolve, reject).finally(() => clearTimeout(timer));
      });
      scripts.set(scriptKey, script);
      void script.catch(() => scripts.delete(scriptKey));
    }
    void script
      .then((sdk) => {
        if (disposed) return;
        if (!sdk?.Buttons) throw new Error(uiText("billing.interface.card_sdk_unavailable_ff4832b"));
        const eligibilityOnly = async (): Promise<string> => {
          throw new Error(uiText("billing.interface.eligibility_checks_cannot_create_purchases_1a2ee3c"));
        };
        const button = sdk.Buttons({ fundingSource: sdk.FUNDING?.CARD ?? "card", ...(subscription ? { createSubscription: eligibilityOnly } : { createOrder: eligibilityOnly }) });
        const eligible = button.isEligible();
        setResult({ key, sdk: eligible ? sdk : null, status: eligible ? "ready" : "unavailable" });
      })
      .catch(() => {
        if (!disposed) setResult({ key, sdk: null, status: "error" });
      });
    return () => {
      disposed = true;
    };
  }, [config, key, scriptKey, subscription]);
  return result?.key === key ? result : { sdk: null, status: "loading" as const };
}
export function PayPalCardButton({
  sdk,
  subscription,
  create,
  approve,
  cancel,
  fail,
}: {
  sdk: PayPalNamespace;
  subscription: boolean;
  create: () => Promise<PayPalPurchase>;
  approve: () => Promise<void>;
  cancel: () => void;
  fail: (message: string) => void;
}) {
  useLocaleRender();
  const root = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ create, approve, cancel, fail });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    callbacks.current = { create, approve, cancel, fail };
  });
  useEffect(() => {
    let disposed = false;
    const node = root.current;
    if (!sdk.Buttons || !node) return;
    const createReference = async () => {
      if (disposed) throw new Error(uiText("billing.interface.checkout_is_closed_5515a2b"));
      const purchase = await callbacks.current.create();
      if (!purchase.providerRef) throw new Error(uiText("billing.interface.the_purchase_is_still_being_prepared_please_try_again_8a41cc8"));
      // Only the server-owned purchase supplies a provider reference; callbacks never identify a purchase.
      return purchase.providerRef;
    };
    const button = sdk.Buttons({
      fundingSource: sdk.FUNDING?.CARD ?? "card",
      style: { layout: "vertical", shape: "rect", height: 48 },
      ...(subscription ? { createSubscription: createReference } : { createOrder: createReference }),
      onApprove: async () => {
        if (!disposed) await callbacks.current.approve();
      },
      onCancel: () => {
        if (!disposed) callbacks.current.cancel();
      },
      onError: () => {
        if (!disposed) callbacks.current.fail(uiText("billing.interface.card_checkout_could_not_complete_check_your_payment_status_before_tr_561b260"));
      },
    });
    if (!button.isEligible()) {
      callbacks.current.fail(uiText("billing.interface.card_checkout_is_unavailable_for_this_purchase_please_choose_paypal_99f68eb"));
      setLoading(false);
      return;
    }
    void button
      .render(node)
      .then(() => {
        if (!disposed) setLoading(false);
      })
      .catch(() => {
        if (!disposed) {
          setLoading(false);
          callbacks.current.fail(uiText("billing.interface.secure_card_checkout_could_not_load_try_again_or_choose_paypal_ca5f3e6"));
        }
      });
    return () => {
      disposed = true;
      void button.close().catch(() => {});
    };
  }, [sdk, subscription]);
  return (
    <div className="checkout-paypal">
      <div ref={root} />
      {loading && (
        <p className="muted" role="status">
          <Localized k="billing.interface.loading_secure_card_checkout_c855640" />
        </p>
      )}
    </div>
  );
}
