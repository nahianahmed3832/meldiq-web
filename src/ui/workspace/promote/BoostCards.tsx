import { Rocket } from "lucide-react";
import type { PromoteView } from "../../../api/discoverySchemas";
import { useEngine } from "../../../application/orbit";
import { buyBoost } from "../../../sync/discovery/api";
import { boostOfTier, dayText, guaranteeText, knownTiers, PHASE_TEXT, POPULAR_TIER, price, recordPhase, TIER_TEXT } from "../../../sync/discovery/promote";
import { Card } from "../WorkspaceView";
import type { PromoteBuy } from "./usePromoteBuy";

interface BoostCardsProps {
  orgId: string;
  view: PromoteView;
  buyer: PromoteBuy;
}

/**
 * Promote's three boosts (the reference's Boost / Super Boost / Mega Boost): each with the label it puts on the card in
 * Discover, its weekly price, and Mega's "Most popular" ribbon and guaranteed place. Only the biggest one running counts.
 */
export function BoostCards({ orgId, view, buyer }: BoostCardsProps) {
  const engine = useEngine();
  const tiers = knownTiers(view.tiers);
  const mega = tiers.find((t) => t.tier === "mega");
  return (
    <Card title="Boost" sub="Move up Discover's list for a week, with a label on the community's card. Boosted communities show above every one that isn't.">
      <ul className="promote-tiers">
        {tiers.map((t) => {
          const text = TIER_TEXT[t.tier];
          const current = boostOfTier(view.boosts, t.tier);
          const key = `boost:${t.tier}`;
          return (
            <li key={t.tier} className={`promote-tier promote-tier-${t.tier}`} aria-label={text.name}>
              {t.tier === POPULAR_TIER && <span className="promote-popular">Most popular</span>}
              <span className={`discover-label discover-label-${t.tier === "mega" ? "gold" : "plain"}`}>{text.label}</span>
              <strong className="promote-tier-name">{text.name}</strong>
              <span className="promote-price">
                {price(t.weeklyCents, view.currency)}
                <small> / week</small>
              </span>
              <p className="promote-pitch">{text.pitch}</p>
              {guaranteeText(t.guaranteedTop) && <p className="promote-guarantee">{guaranteeText(t.guaranteedTop)}</p>}
              {current && (
                <small className="promote-status">
                  {PHASE_TEXT[recordPhase(current)]} · until {dayText(current.endsAt)}
                </small>
              )}
              <button
                className={`btn btn-sm ${t.tier === POPULAR_TIER ? "btn-primary" : "btn-secondary"}`}
                disabled={buyer.busy !== null}
                onClick={() => void buyer.buy(key, () => buyBoost(engine, orgId, t.tier))}
              >
                <Rocket size={14} aria-hidden="true" /> {buyer.busy === key ? "Opening…" : `${text.name} for a week`}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="faint promote-note">
        Only the biggest boost running counts.
        {mega?.guaranteedTop ? ` Mega Boost keeps the community in the top ${mega.guaranteedTop} whatever else is boosted (top 50 from 100 members, top 20 from 1,000).` : ""} A community that's
        locked, made private or taken out of Discover stops showing, and nothing is refunded.
      </p>
    </Card>
  );
}
