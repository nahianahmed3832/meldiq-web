import { useEffect, useRef, useState } from "react";
import { loadCoreSdkScript } from "@paypal/paypal-js/sdk-v6";
import type { PayPalConfig, PayPalPurchase } from "../../api/paypalSchemas";

/** Only PayPal's own v6 web component renders a payment control. No client token or secret is needed. */
export function PayPalButton({
  config,
  subscription,
  create,
  approve,
  cancel,
  fail,
}: {
  config: PayPalConfig;
  subscription: boolean;
  create: () => Promise<PayPalPurchase>;
  approve: () => Promise<void>;
  cancel: () => void;
  fail: (message: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ create, approve, cancel, fail });
  useEffect(() => {
    callbacks.current = { create, approve, cancel, fail };
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let disposed = false;
    let destroy: (() => void) | undefined;
    const node = root.current;
    const initialize = async () => {
      const sdk = await loadCoreSdkScript({ environment: config.environment === "live" ? "production" : "sandbox" });
      if (!sdk || disposed) return;
      const instance = await sdk.createInstance({ clientId: config.clientId, components: ["paypal-payments", "paypal-subscriptions"], pageType: "checkout" });
      const methods = await instance.findEligibleMethods({ currencyCode: "USD" });
      if (disposed) return;
      if (!methods.isEligible("paypal")) throw new Error("PayPal is not available for this purchase. Please try another eligible PayPal account.");
      const options = {
        onApprove: async () => {
          if (!disposed) await callbacks.current.approve();
        },
        onCancel: () => {
          if (!disposed) callbacks.current.cancel();
        },
        onError: () => {
          if (!disposed) callbacks.current.fail("PayPal could not complete checkout. Check your billing status before trying again.");
        },
      };
      const sub = subscription ? instance.createPayPalSubscriptionPaymentSession(options) : null;
      const payment = subscription ? null : instance.createPayPalOneTimePaymentSession(options);
      const button = document.createElement("paypal-button");
      button.className = "paypal-gold";
      button.setAttribute("type", subscription ? "subscribe" : "pay");
      button.setAttribute("aria-label", subscription ? "Subscribe with PayPal" : "Pay with PayPal");
      let running = false;
      button.addEventListener("click", () => {
        if (running || disposed) return;
        running = true;
        button.setAttribute("aria-disabled", "true");
        const purchase = callbacks.current.create().then((p) => {
          if (!p.providerRef) throw new Error("The purchase is still being prepared. Please try again.");
          return p;
        });
        // Call start during the user's click, before awaiting network, so PayPal can open its approval window.
        const started = sub
          ? sub.start(
              { presentationMode: "auto" },
              purchase.then((p) => ({ subscriptionId: p.providerRef! })),
            )
          : payment!.start(
              { presentationMode: "auto" },
              purchase.then((p) => ({ orderId: p.providerRef! })),
            );
        void started
          .catch((e: unknown) => {
            if (!disposed) callbacks.current.fail(e instanceof Error ? e.message : "Checkout was interrupted. Check billing status before trying again.");
          })
          .finally(() => {
            running = false;
            button.removeAttribute("aria-disabled");
          });
      });
      destroy = () => {
        sub?.destroy();
        payment?.destroy();
        button.remove();
      };
      if (disposed) {
        destroy();
        return;
      }
      node?.replaceChildren(button);
      setLoading(false);
    };
    void initialize().catch((e: unknown) => {
      if (!disposed) {
        setLoading(false);
        callbacks.current.fail(e instanceof Error ? e.message : "PayPal could not load. Check your connection and try again.");
      }
    });
    return () => {
      disposed = true;
      destroy?.();
    };
  }, [config.clientId, config.environment, subscription]);
  return (
    <div className="checkout-paypal">
      <div ref={root} />
      {loading && (
        <p className="muted" role="status">
          Loading secure PayPal checkout…
        </p>
      )}
    </div>
  );
}
