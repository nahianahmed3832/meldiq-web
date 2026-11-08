import { useEffect, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
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
  const engine = useEngine();
  const active = useOrbit((s) => s.mojo.orgs[id]?.active ?? 0);
  useEffect(() => { void engine.mojo.loadOrg(id); }, [engine, id]);
  const next = offer.levels.findIndex((count) => count > active);
  const [selection, setQuantity] = useState<number | null>(null);
  const quantity = selection ?? (next < 0 ? 1 : offer.levels[next]! - active);
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
            <li key={level} className={active >= level ? "reached" : undefined}>
              <Icon name="settings.spark" size={24} />
              {levelLabel(index + 1)}
            </li>
          ))}
        </ol>
        <p><strong>{t("workspace.reference.activeContributions", { count: active })}</strong>{next >= 0 && <> · {t("billing.interface.value0_more_for_level_value1_3a01894", { value0: offer.levels[next]! - active, value1: next + 1 })}</>}</p>
      </header>
      <section className="supercharge-order" aria-labelledby="supercharge-level">
        <div className="supercharge-summary">
          <h2 id="supercharge-level">{t("workspace.reference.getLevel")}</h2>
          <span>{t("workspace.reference.perSpark", { amount: amount(1) })}</span>
        </div>
        <div className="supercharge-options">
          {offer.levels.map((count, index) => {
            const needed = Math.max(0, count - active);
            return (
              <button key={count} type="button" className="supercharge-option" aria-pressed={quantity === needed} disabled={!needed} onClick={() => setQuantity(needed)}>
                <Icon name="settings.spark" size={24} />
                <strong>{levelLabel(index + 1)}</strong>
                {needed > 0 ? <>
                  <small>{t("workspace.reference.units", { count: needed })}</small>
                  <strong>{t("workspace.reference.monthlyShort", { amount: amount(needed) })}</strong>
                </> : <small>{t("billing.interface.unlocked_531c7b2")}</small>}
              </button>
            );
          })}
        </div>
        <div className="supercharge-summary supercharge-quantity">
          <span>{t("workspace.reference.quantity")}</span>
          <div className="supercharge-stepper">
            <button className="btn btn-secondary" type="button" disabled={quantity <= 1} aria-label={t("workspace.reference.decrease")} onClick={() => setQuantity(Math.max(1, quantity - 1))}>
              −
            </button>
            <output aria-live="polite">{quantity}</output>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={quantity >= maxQuantity}
              aria-label={t("workspace.reference.increase")}
              onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
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
