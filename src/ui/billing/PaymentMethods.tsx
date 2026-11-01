import { CreditCard } from "lucide-react";
import type { CardAvailability } from "./PayPalCardButton";

export type PaymentMethod = "paypal" | "card";

export function PaymentMethods({ value, cardStatus, onChange, retry }: { value: PaymentMethod; cardStatus: CardAvailability; onChange: (value: PaymentMethod) => void; retry: () => void }) {
  return (
    <div className="checkout-method" role="radiogroup" aria-label="Payment method">
      <label className="checkout-method-option">
        <input type="radio" name="payment-method" value="card" checked={value === "card"} disabled={cardStatus === "unavailable"} onChange={() => onChange("card")} />
        <div>
          <strong>Debit or credit card</strong>
          <small>
            {cardStatus === "loading" ? "Checking card availability…" : cardStatus === "unavailable" ? "PayPal does not offer cards for this purchase" : "Pay securely by card · processed by PayPal"}
          </small>
        </div>
        <CreditCard size={24} aria-hidden="true" />
      </label>
      <label className="checkout-method-option">
        <input type="radio" name="payment-method" value="paypal" checked={value === "paypal"} onChange={() => onChange("paypal")} />
        <div>
          <strong>PayPal</strong>
          <small>Pay with your PayPal account</small>
        </div>
        <span className="checkout-paypal-wordmark" aria-hidden="true">
          PayPal
        </span>
      </label>
      {(cardStatus === "error" || cardStatus === "unavailable") && (
        <div className="checkout-hint" role="status">
          {cardStatus === "error"
            ? "Card checkout could not load. Check your connection or browser content blocker, then try again."
            : "Card availability depends on PayPal and your location. You can choose PayPal or check again."}
          <button type="button" className="btn btn-ghost btn-sm" onClick={retry}>
            Check card availability again
          </button>
        </div>
      )}
    </div>
  );
}
