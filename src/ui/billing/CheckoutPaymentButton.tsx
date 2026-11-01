import type { ComponentProps } from "react";
import type { PayPalNamespace } from "@paypal/paypal-js";
import { PayPalButton } from "./PayPalButton";
import { PayPalCardButton, type CardAvailability } from "./PayPalCardButton";
import type { PaymentMethod } from "./PaymentMethods";

export function CheckoutPaymentButton({
  method,
  cardSdk,
  cardStatus,
  ...props
}: ComponentProps<typeof PayPalButton> & { method: PaymentMethod; cardSdk: PayPalNamespace | null; cardStatus: CardAvailability }) {
  if (method === "paypal") return <PayPalButton {...props} />;
  if (!cardSdk)
    return cardStatus === "loading" ? (
      <p className="muted" role="status">
        Checking secure card checkout…
      </p>
    ) : null;
  return (
    <>
      <p className="checkout-hint">To pay as a guest, turn off “Save info &amp; create your PayPal account” if PayPal shows that option.</p>
      <PayPalCardButton sdk={cardSdk} {...props} />
    </>
  );
}
