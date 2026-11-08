import { useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useT } from "../../i18n";
import offers from "../../sync/discovery/communityOffers.json";
import { price } from "../../sync/discovery/promote";
import { OrgAvatar } from "../components/OrgAvatar";
import { Icon } from "../icons/Icon";
import { SparkDialog } from "../mojo/SparkDialog";

const offer = offers.supercharge;
const maxQuantity = Math.max(...offer.levels);
const amount = (quantity: number) => price(quantity * offer.unitCents, offers.currency);

/** Preview recurring community Supercharges while one-time Sparks remain available on their original terms. */
export function CommunitySparksPage({ detail }: { detail: OrgAdminDetail }) {
  const t = useT();
  const { id, name, photoRev } = detail.org;
  const [quantity, setQuantity] = useState(offer.levels[0]);
  const [manage, setManage] = useState(false);
  const levelLabel = (level: number) => t("billing.interface.level_value0_6095a3d", { value0: level });
  return (
    <div className="ws-page community-supercharge">
      <header className="supercharge-hero">
        <OrgAvatar orgId={id} name={name} photoRev={photoRev} size={72} />
        <h2>{t("workspace.reference.superchargeName", { name })}</h2>
        <p>{t("workspace.reference.superchargeHelp")}</p>
        <ol className="supercharge-track">
          {offer.levels.map((level, index) => (
            <li key={level}>
              <Icon name="settings.spark" size={24} />
              {levelLabel(index + 1)}
            </li>
          ))}
        </ol>
      </header>
      <section className="supercharge-order" aria-labelledby="supercharge-level">
        <div className="supercharge-summary">
          <h2 id="supercharge-level">{t("workspace.reference.getLevel")}</h2>
          <span>{t("workspace.reference.perSpark", { amount: amount(1) })}</span>
        </div>
        <div className="supercharge-options">
          {offer.levels.map((count, index) => (
            <button key={count} type="button" className="supercharge-option" aria-pressed={quantity === count} onClick={() => setQuantity(count)}>
              <Icon name="settings.spark" size={24} />
              <strong>{levelLabel(index + 1)}</strong>
              <small>{t("workspace.reference.units", { count })}</small>
              <strong>{t("workspace.reference.monthlyShort", { amount: amount(count) })}</strong>
            </button>
          ))}
        </div>
        <div className="supercharge-summary supercharge-quantity">
          <span>{t("workspace.reference.quantity")}</span>
          <div className="supercharge-stepper">
            <button className="btn btn-secondary" type="button" disabled={quantity <= 1} aria-label={t("workspace.reference.decrease")} onClick={() => setQuantity((n) => Math.max(1, n - 1))}>
              −
            </button>
            <output aria-live="polite">{quantity}</output>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={quantity >= maxQuantity}
              aria-label={t("workspace.reference.increase")}
              onClick={() => setQuantity((n) => Math.min(maxQuantity, n + 1))}
            >
              +
            </button>
          </div>
        </div>
        <div className="supercharge-summary" aria-live="polite">
          <span>{t("workspace.reference.total", { count: quantity, amount: amount(1) })}</span>
          <strong>{t("workspace.reference.monthly", { amount: amount(quantity) })}</strong>
        </div>
        <button type="button" className="btn supercharge-buy" disabled aria-describedby="supercharge-pending">
          <Icon name="settings.spark" size={20} /> {t("workspace.reference.getSupercharge")} · {amount(quantity)}
        </button>
        <p id="supercharge-pending" className="muted">
          {t("workspace.reference.checkoutPending")}
        </p>
      </section>
      <div>
        <button type="button" className="btn btn-secondary" onClick={() => setManage(true)}>
          {t("workspace.reference.existingSparks")}
        </button>
      </div>
      {manage && <SparkDialog orgId={id} name={name} onClose={() => setManage(false)} />}
    </div>
  );
}
