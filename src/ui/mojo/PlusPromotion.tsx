import { BadgeCheck, FileUp, Gem, MonitorUp, Sparkles, X } from "lucide-react";
import type { MojoCatalog } from "../../api/mojoSchemas";
import type { Promotion } from "../../api/promotionSchemas";
import { Dialog } from "../components/Overlay";
import { money, screenLabel, size } from "./mojoFormat";

/** Reference-inspired popup; benefits come from Meldiq's catalog, independent of the reference application's limits. */
export function PlusPromotion({
  promotion: p,
  catalog,
  onDismiss,
  onSnooze,
  onUpgrade,
  onOptOut,
}: {
  promotion: Promotion;
  catalog: MojoCatalog;
  onDismiss: () => void;
  onSnooze: () => void;
  onUpgrade: () => void;
  onOptOut: () => void;
}) {
  const plus = catalog.plans.find((plan) => plan.key === "plus");
  const content = (
    <>
      <header className="plus-promotion-header">
        <button className="icon-btn plus-promotion-close" aria-label="Dismiss Plus promotion" onClick={onDismiss}>
          <X size={23} />
        </button>
        <h2 id="plus-support-title">
          {p.heading} <Sparkles size={19} aria-hidden="true" />
        </h2>
        <p>{p.description}</p>
      </header>
      <div className="plus-promotion-body">
        {p.image && <img src={p.image} alt="" />}
        {plus && (
          <ul className="plus-promotion-benefits">
            <li>
              <FileUp size={20} aria-hidden="true" />
              Files up to {size(plus.uploadBytes)}
            </li>
            <li>
              <MonitorUp size={20} aria-hidden="true" />
              {screenLabel(catalog, plus.screen)} screen sharing
            </li>
            {plus.badge === "plus" && (
              <li>
                <BadgeCheck size={20} aria-hidden="true" />
                Plus badge next to your name
              </li>
            )}
            {plus.sparks > 0 && (
              <li>
                <Gem size={20} aria-hidden="true" />
                {plus.sparks} included Spark{plus.sparks === 1 ? "" : "s"} for communities
              </li>
            )}
          </ul>
        )}
        <div className="plus-promotion-actions">
          <button className="btn plus-promotion-upgrade" onClick={onUpgrade}>
            {p.cta} · {money(p.amountMinor, p.currency)}/mo
          </button>
          <button className="btn btn-ghost" onClick={onSnooze}>
            Not now
          </button>
        </div>
        <small>Optional · Renews monthly until canceled. Profile customization stays free.</small>
        <button className="plus-promotion-optout" onClick={onOptOut}>
          Don’t show again
        </button>
      </div>
    </>
  );
  if (p.presentation === "modal")
    return (
      <Dialog title={p.heading} header={<></>} className="plus-promotion plus-promotion-modal" onClose={onDismiss}>
        {content}
      </Dialog>
    );
  return (
    <aside className={`plus-support-notice plus-promotion plus-promotion-${p.presentation}`} role="status" aria-live="polite" aria-labelledby="plus-support-title">
      {content}
    </aside>
  );
}
