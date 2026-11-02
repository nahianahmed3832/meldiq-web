import { useState } from "react";
import { zCommerceOrders, zCommerceReceipt } from "../../api/commerceSchemas";
import { useEngine } from "../../application/orbit";
import { useAction, useLoad } from "../workspace/useLoad";
import { money } from "../mojo/mojoFormat";
import { Dialog } from "../components/Overlay";
export function Orders() {
  const engine = useEngine();
  const result = useLoad(() => engine.api.json("GET", "/v2/billing/orders", zCommerceOrders), [engine]);
  const action = useAction();
  const [receipt, setReceipt] = useState<ReturnType<typeof zCommerceReceipt.parse> | null>(null);
  if (!result.data?.orders.length && !result.error) return null;
  return (
    <section className="checkout-card">
      <h2>Orders &amp; receipts</h2>
      {(result.error || action.error) && (
        <p className="banner danger" role="alert">
          {action.error ?? result.error}
        </p>
      )}
      {result.data?.orders.map((o) => (
        <div className="row" key={o.id}>
          <div className="grow lines">
            <strong>{o.product}</strong>
            <small>
              {money(o.totalMinor, o.currency)} · {o.status.replaceAll("_", " ")} · {new Date(o.createdAt).toLocaleDateString()}
            </small>
          </div>
          <button
            className="btn btn-secondary"
            disabled={action.busy}
            onClick={() => void action.act(async () => setReceipt(await engine.api.json("GET", `/v2/billing/orders/${encodeURIComponent(o.id)}/receipt`, zCommerceReceipt)))}
          >
            View receipt
          </button>
        </div>
      ))}
      {receipt && (
        <Dialog
          title={receipt.paid ? "Payment receipt" : "Order status"}
          onClose={() => setReceipt(null)}
          footer={
            <button className="btn btn-secondary" onClick={() => setReceipt(null)}>
              Close
            </button>
          }
        >
          <div className="dialog-body">
            <h3>Meldiq</h3>
            <p>{receipt.product}</p>
            <p>
              {receipt.status} · {new Date(receipt.createdAt).toLocaleDateString()}
            </p>
            <dl>
              <dt>Subtotal</dt>
              <dd>{money(receipt.subtotalMinor, receipt.currency)}</dd>
              <dt>Discount</dt>
              <dd>{money(receipt.discountMinor, receipt.currency)}</dd>
              <dt>Tax collected</dt>
              <dd>{money(receipt.taxMinor, receipt.currency)}</dd>
              <dt>Total</dt>
              <dd>
                <strong>{money(receipt.totalMinor, receipt.currency)}</strong>
              </dd>
            </dl>
            <p>
              Receipt: <code>{receipt.receiptNumber}</code>
            </p>
            <p>
              Provider reference: <code>{receipt.providerReference ?? "Awaiting confirmation"}</code>
            </p>
            <p className="muted">{receipt.statement}</p>
          </div>
        </Dialog>
      )}
    </section>
  );
}
