import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
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
  useLocaleRender();
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
      const methods = await instance.findEligibleMethods({ currencyCode: "USD", paymentFlow: subscription ? "RECURRING_PAYMENT" : "ONE_TIME_PAYMENT" });
      if (disposed) return;
      if (!methods.isEligible("paypal")) throw new Error(uiText("billing.interface.paypal_is_not_available_for_this_purchase_please_try_another_elig_18785aa"));
      const options = {
        onApprove: async () => {
          if (!disposed) await callbacks.current.approve();
        },
        onCancel: () => {
          if (!disposed) callbacks.current.cancel();
        },
        onError: () => {
          if (!disposed) callbacks.current.fail(uiText("billing.interface.paypal_could_not_complete_checkout_check_your_billing_status_befo_7b58bf2"));
        },
      };
      const sub = subscription ? instance.createPayPalSubscriptionPaymentSession(options) : null;
      const payment = subscription ? null : instance.createPayPalOneTimePaymentSession(options);
      const button = document.createElement("paypal-button");
      button.className = "paypal-gold";
      button.setAttribute("type", subscription ? "subscribe" : "pay");
      button.setAttribute("aria-label", subscription ? uiText("billing.interface.subscribe_with_paypal_f0e5590") : uiText("billing.interface.pay_with_paypal_3586b84"));
      let running = false;
      button.addEventListener("click", () => {
        if (running || disposed) return;
        running = true;
        button.setAttribute("aria-disabled", "true");
        const purchase = callbacks.current.create().then((p) => {
          if (!p.providerRef) throw new Error(uiText("billing.interface.the_purchase_is_still_being_prepared_please_try_again_8a41cc8"));
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
            if (!disposed) callbacks.current.fail(e instanceof Error ? e.message : uiText("billing.interface.checkout_was_interrupted_check_billing_status_before_trying_again_956210c"));
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
        callbacks.current.fail(e instanceof Error ? e.message : uiText("billing.interface.paypal_could_not_load_check_your_connection_and_try_again_9a46618"));
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
          <Localized k="billing.interface.loading_secure_paypal_checkout_57b4a2b" />
        </p>
      )}
    </div>
  );
}
