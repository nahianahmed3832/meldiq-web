import type { ComponentProps } from "react";
import type { PayPalNamespace } from "@paypal/paypal-js";
import { PayPalButton } from "./PayPalButton";
import { PayPalCardButton } from "./PayPalCardButton";

export function CheckoutPaymentButton({ cardSdk, ...props }: ComponentProps<typeof PayPalButton> & { cardSdk: PayPalNamespace | null }) {
  return cardSdk ? (
    <>
      <p className="checkout-hint">To pay as a guest, turn off “Save info &amp; create your PayPal account” if PayPal shows that option.</p>
      <PayPalCardButton sdk={cardSdk} {...props} />
    </>
  ) : (
    <PayPalButton {...props} />
  );
}
