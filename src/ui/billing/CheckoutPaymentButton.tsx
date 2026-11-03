import { Localized } from "../../i18n/Localized";
import { CardSubscriptionCheckout } from "./CardSubscriptions";
import { EmbeddedCardFields } from "./EmbeddedCardFields";
import { useEffect, type ComponentProps } from "react";
import { holdUpdates } from "../../application/updates";
import type { PayPalNamespace } from "@paypal/paypal-js";
import { PayPalButton } from "./PayPalButton";
import { PayPalCardButton, type CardAvailability } from "./PayPalCardButton";
import type { PaymentMethod } from "./PaymentMethods";
export function CheckoutPaymentButton({
  method,
  cardSdk,
  cardStatus,
  cardProduct = "plus",
  cardOrgId,
  ...props
}: ComponentProps<typeof PayPalButton> & {
  method: PaymentMethod;
  cardSdk: PayPalNamespace | null;
  cardStatus: CardAvailability;
  cardProduct?: "plus" | "bots_plus";
  cardOrgId?: string;
}) {
  // Keep a background update from interrupting authorization in the provider's popup.
  useEffect(() => holdUpdates(), []);
  if (method === "paypal") return <PayPalButton {...props} />;
  if (props.subscription && props.config.advancedCards?.recurring) return <CardSubscriptionCheckout product={cardProduct} orgId={cardOrgId} />;
  if (!props.subscription && props.config.advancedCards?.oneTime) return <EmbeddedCardFields {...props} />;
  if (!cardSdk)
    return cardStatus === "loading" ? (
      <p className="muted" role="status">
        <Localized k="billing.interface.checking_secure_card_checkout_9249ca2" />
      </p>
    ) : null;
  return (
    <>
      <p className="checkout-hint">
        <Localized k="billing.interface.to_pay_as_a_guest_turn_off_save_info_create_your_paypal_account_i_f2ecc2a" />
      </p>
      <PayPalCardButton sdk={cardSdk} {...props} />
    </>
  );
}
