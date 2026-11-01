import { CreditCard } from "lucide-react";

export type PaymentMethod = "paypal" | "card";

export function PaymentMethods({ value, cards, onChange }: { value: PaymentMethod; cards: boolean; onChange: (value: PaymentMethod) => void }) {
  return (
    <div className="checkout-method" role="radiogroup" aria-label="Payment method">
      {cards && (
        <label className="checkout-method-option">
          <input type="radio" name="payment-method" value="card" checked={value === "card"} onChange={() => onChange("card")} />
          <div>
            <strong>Debit or credit card</strong>
            <small>Pay securely by card · processed by PayPal</small>
          </div>
          <CreditCard size={24} aria-hidden="true" />
        </label>
      )}
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
    </div>
  );
}
