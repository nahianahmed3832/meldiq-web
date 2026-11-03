import { countLabel } from "../../i18n/counts";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
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
  useLocaleRender();
  const plus = catalog.plans.find((plan) => plan.key === "plus");
  const content = (
    <>
      <header className="plus-promotion-header">
        <button className="icon-btn plus-promotion-close" aria-label={uiText("billing.interface.dismiss_plus_promotion_c299ebe")} onClick={onDismiss}>
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
              <Localized k="billing.interface.files_up_to_ab9d8f4" slots={[<FileUp size={20} aria-hidden="true" />, size(plus.uploadBytes)]} />
            </li>
            <li>
              <Localized k="billing.interface.screen_sharing_8c7a78b" slots={[<MonitorUp size={20} aria-hidden="true" />, screenLabel(catalog, plus.screen)]} />
            </li>
            {plus.badge === "plus" && (
              <li>
                <Localized k="billing.interface.plus_badge_next_to_your_name_5f1e915" slots={[<BadgeCheck size={20} aria-hidden="true" />]} />
              </li>
            )}
            {plus.sparks > 0 && (
              <li>
                <Localized k="billing.promotion.includedSparks" slots={[<Gem size={20} aria-hidden="true" />, countLabel(plus.sparks, "sparks"), ""]} />
              </li>
            )}
          </ul>
        )}
        <div className="plus-promotion-actions">
          <button className="btn plus-promotion-upgrade" onClick={onUpgrade}>
            {p.cta} · {money(p.amountMinor, p.currency)}/mo
          </button>
          <button className="btn btn-ghost" onClick={onSnooze}>
            <Localized k="workspace.interface.not_now_a0e63d7" />
          </button>
        </div>
        <small>
          <Localized k="billing.interface.optional_renews_monthly_until_canceled_profile_customization_stay_c74d309" />
        </small>
        <button className="plus-promotion-optout" onClick={onOptOut}>
          <Localized k="billing.interface.don_t_show_again_f6f62e0" />
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
