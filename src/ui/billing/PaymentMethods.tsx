import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { CreditCard } from "lucide-react";
import type { CardAvailability } from "./PayPalCardButton";
export type PaymentMethod = "paypal" | "card";
export function PaymentMethods({ value, cardStatus, onChange, retry }: { value: PaymentMethod; cardStatus: CardAvailability; onChange: (value: PaymentMethod) => void; retry: () => void }) {
  useLocaleRender();
  return (
    <div className="checkout-method" role="radiogroup" aria-label={uiText("billing.interface.payment_method_b948ac0")}>
      <label className="checkout-method-option">
        <input type="radio" name="payment-method" value="card" checked={value === "card"} disabled={cardStatus === "unavailable"} onChange={() => onChange("card")} />
        <div>
          <strong>
            <Localized k="billing.interface.debit_or_credit_card_04f636e" />
          </strong>
          <small>
            {cardStatus === "loading"
              ? uiText("billing.interface.checking_card_availability_53d58bf")
              : cardStatus === "unavailable"
                ? uiText("billing.interface.paypal_does_not_offer_cards_for_this_purchase_a81cb19")
                : uiText("billing.interface.pay_securely_by_card_processed_by_paypal_de195a0")}
          </small>
        </div>
        <CreditCard size={24} aria-hidden="true" />
      </label>
      <label className="checkout-method-option">
        <input type="radio" name="payment-method" value="paypal" checked={value === "paypal"} onChange={() => onChange("paypal")} />
        <div>
          <strong>PayPal</strong>
          <small>
            <Localized k="billing.interface.pay_with_your_paypal_account_f58536c" />
          </small>
        </div>
        <span className="checkout-paypal-wordmark" aria-hidden="true">
          PayPal
        </span>
      </label>
      {(cardStatus === "error" || cardStatus === "unavailable") && (
        <div className="checkout-hint" role="status">
          {cardStatus === "error"
            ? uiText("billing.interface.card_checkout_could_not_load_check_your_connection_or_browser_con_8d6a9c5")
            : uiText("billing.interface.card_availability_depends_on_paypal_and_your_location_you_can_cho_d04b625")}
          <button type="button" className="btn btn-ghost btn-sm" onClick={retry}>
            <Localized k="billing.interface.check_card_availability_again_706775c" />
          </button>
        </div>
      )}
    </div>
  );
}
