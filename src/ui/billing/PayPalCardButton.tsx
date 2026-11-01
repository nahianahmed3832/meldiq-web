import { useEffect, useRef, useState } from "react";
import { loadScript, type PayPalNamespace } from "@paypal/paypal-js";
import type { PayPalConfig, PayPalPurchase } from "../../api/paypalSchemas";

const scripts = new Map<string, Promise<PayPalNamespace | null>>();

export type CardAvailability = "loading" | "ready" | "unavailable" | "error";

/** Keep a visible card choice even if PayPal blocks or cannot load its eligibility check. */
export function usePayPalCardSdk(config: PayPalConfig | null, subscription: boolean, attempt = 0) {
  const scriptKey = config ? `${config.environment}:${config.clientId}:${subscription}` : "";
  const key = `${scriptKey}:${attempt}`;
  const [result, setResult] = useState<{ key: string; sdk: PayPalNamespace | null; status: CardAvailability } | null>(null);
  useEffect(() => {
    if (!config) return;
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
        const timer = setTimeout(() => reject(new Error("Card eligibility timed out")), 15000);
        void loaded.then(resolve, reject).finally(() => clearTimeout(timer));
      });
      scripts.set(scriptKey, script);
      void script.catch(() => scripts.delete(scriptKey));
    }
    void script
      .then((sdk) => {
        if (disposed) return;
        if (!sdk?.Buttons) throw new Error("Card SDK unavailable");
        const eligibilityOnly = async (): Promise<string> => {
          throw new Error("Eligibility checks cannot create purchases.");
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
      if (disposed) throw new Error("Checkout is closed.");
      const purchase = await callbacks.current.create();
      if (!purchase.providerRef) throw new Error("The purchase is still being prepared. Please try again.");
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
        if (!disposed) callbacks.current.fail("Card checkout could not complete. Check your payment status before trying again, or choose PayPal.");
      },
    });
    if (!button.isEligible()) {
      callbacks.current.fail("Card checkout is unavailable for this purchase. Please choose PayPal.");
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
          callbacks.current.fail("Secure card checkout could not load. Try again or choose PayPal.");
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
          Loading secure card checkout…
        </p>
      )}
    </div>
  );
}
