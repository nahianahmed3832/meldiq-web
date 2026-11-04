import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { Rocket } from "lucide-react";
import type { PromoteView } from "../../../api/discoverySchemas";
import { useEngine } from "../../../application/orbit";
import { buyBoost } from "../../../sync/discovery/api";
import { boostOfTier, dayText, guaranteeText, knownTiers, PHASE_TEXT, POPULAR_TIER, price, recordPhase, TIER_TEXT } from "../../../sync/discovery/promote";
import { Card } from "../../components/SettingsCard";
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
  useLocaleRender();
  const engine = useEngine();
  const tiers = knownTiers(view.tiers);
  const mega = tiers.find((t) => t.tier === "mega");
  return (
    <Card title={uiText("workspace.interface.boost_0d791a0")} sub={uiText("workspace.interface.move_up_discover_s_list_for_a_week_with_a_label_on_the_community_fdf1654")}>
      <ul className="promote-tiers">
        {tiers.map((t) => {
          const text = TIER_TEXT[t.tier];
          const current = boostOfTier(view.boosts, t.tier);
          const key = `boost:${t.tier}`;
          return (
            <li key={t.tier} className={`promote-tier promote-tier-${t.tier}`} aria-label={text.name}>
              {t.tier === POPULAR_TIER && (
                <span className="promote-popular">
                  <Localized k="workspace.interface.most_popular_ad2ea94" />
                </span>
              )}
              <span className={`discover-label discover-label-${t.tier === "mega" ? "gold" : "plain"}`}>{text.label}</span>
              <strong className="promote-tier-name">{text.name}</strong>
              <span className="promote-price">
                {price(t.weeklyCents, view.currency)}
                <small>
                  <Localized k="workspace.interface.week_19e9eb8" />
                </small>
              </span>
              <p className="promote-pitch">{text.pitch}</p>
              {guaranteeText(t.guaranteedTop) && <p className="promote-guarantee">{guaranteeText(t.guaranteedTop)}</p>}
              {current && (
                <small className="promote-status">
                  <Localized k="workspace.interface.until_b40e2f7" slots={[PHASE_TEXT[recordPhase(current)], dayText(current.endsAt)]} />
                </small>
              )}
              <button
                className={`btn btn-sm ${t.tier === POPULAR_TIER ? "btn-primary" : "btn-secondary"}`}
                disabled={buyer.busy !== null}
                onClick={() => void buyer.buy(key, () => buyBoost(engine, orgId, t.tier))}
              >
                <Rocket size={14} aria-hidden="true" />{" "}
                {buyer.busy === key ? uiText("organization.interface.opening_c926c2c") : uiText("workspace.interface.value0_for_a_week_6301e75", { value0: text.name })}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="faint promote-note">
        <Localized
          k="workspace.interface.only_the_biggest_boost_running_counts_a_community_that_s_locked_m_fa15bb1"
          slots={[mega?.guaranteedTop ? uiText("workspace.interface.mega_boost_keeps_the_community_in_the_top_value0_whatever_else_is_3fc17d4", { value0: mega.guaranteedTop }) : ""]}
        />
      </p>
    </Card>
  );
}
