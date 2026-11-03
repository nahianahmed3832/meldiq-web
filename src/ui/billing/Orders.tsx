import { catalogText } from "../../i18n/catalog";
import { billingProduct } from "../../i18n/billing";
import { billingState } from "../../i18n/billing";
import { interfaceLocale } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useState } from "react";
import { zCommerceOrders, zCommerceReceipt } from "../../api/commerceSchemas";
import { useEngine } from "../../application/orbit";
import { useAction, useLoad } from "../workspace/useLoad";
import { money } from "../mojo/mojoFormat";
import { Dialog } from "../components/Overlay";
export function Orders() {
  useLocaleRender();
  const engine = useEngine();
  const result = useLoad(() => engine.api.json("GET", "/v2/billing/orders", zCommerceOrders), [engine]);
  const action = useAction();
  const [receipt, setReceipt] = useState<ReturnType<typeof zCommerceReceipt.parse> | null>(null);
  if (!result.data?.orders.length && !result.error) return null;
  return (
    <section className="checkout-card">
      <h2>
        <Localized k="billing.interface.orders_receipts_b31c3ec" />
      </h2>
      {(result.error || action.error) && (
        <p className="banner danger" role="alert">
          {action.error ?? result.error}
        </p>
      )}
      {result.data?.orders.map((o) => (
        <div className="row" key={o.id}>
          <div className="grow lines">
            <strong>{billingProduct(o.product)}</strong>
            <small>
              {money(o.totalMinor, o.currency)} · {billingState(o.status)} · {new Date(o.createdAt).toLocaleDateString(interfaceLocale())}
            </small>
          </div>
          <button
            className="btn btn-secondary"
            disabled={action.busy}
            onClick={() => void action.act(async () => setReceipt(await engine.api.json("GET", `/v2/billing/orders/${encodeURIComponent(o.id)}/receipt`, zCommerceReceipt)))}
          >
            <Localized k="billing.interface.view_receipt_3e63856" />
          </button>
        </div>
      ))}
      {receipt && (
        <Dialog
          title={receipt.paid ? uiText("billing.interface.payment_receipt_f22d234") : uiText("billing.interface.order_status_5e14951")}
          onClose={() => setReceipt(null)}
          footer={
            <button className="btn btn-secondary" onClick={() => setReceipt(null)}>
              <Localized k="common.actions.close" />
            </button>
          }
        >
          <div className="dialog-body">
            <h3>Meldiq</h3>
            <p>{billingProduct(receipt.product)}</p>
            <p>
              {billingState(receipt.status)} · {new Date(receipt.createdAt).toLocaleDateString(interfaceLocale())}
            </p>
            <dl>
              <dt>
                <Localized k="billing.interface.subtotal_8c0f2cb" />
              </dt>
              <dd>{money(receipt.subtotalMinor, receipt.currency)}</dd>
              <dt>
                <Localized k="billing.interface.discount_cb72ec9" />
              </dt>
              <dd>{money(receipt.discountMinor, receipt.currency)}</dd>
              <dt>
                <Localized k="billing.interface.tax_collected_5819930" />
              </dt>
              <dd>{money(receipt.taxMinor, receipt.currency)}</dd>
              <dt>
                <Localized k="billing.interface.total_c9b3c38" />
              </dt>
              <dd>
                <strong>{money(receipt.totalMinor, receipt.currency)}</strong>
              </dd>
            </dl>
            <p>
              <Localized k="billing.interface.receipt_afa2003" slots={[<code>{receipt.receiptNumber}</code>]} />
            </p>
            <p>
              <Localized k="billing.interface.provider_reference_5f94154" slots={[<code>{receipt.providerReference ?? "Awaiting confirmation"}</code>]} />
            </p>
            <p className="muted">{catalogText("billing.commerce.receiptStatement", receipt.statement)}</p>
          </div>
        </Dialog>
      )}
    </section>
  );
}
