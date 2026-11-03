import { countLabel } from "../../../i18n/counts";
import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { Clock, Eye, TrendingUp } from "lucide-react";
import type { PromoteView } from "../../../api/discoverySchemas";
import type { OrgAdminDetail } from "../../../api/workspaceSchemas";
import { useEngine } from "../../../application/orbit";
import { navigate } from "../../../application/router";
import { promoteView } from "../../../sync/discovery/api";
import { dayText, rankText, TIER_TEXT } from "../../../sync/discovery/promote";
import { DISCOVERY_LIMITS, unlistedText } from "../../../sync/discovery/rules";
import { useLoad } from "../useLoad";
import { Card, ErrorLine } from "../WorkspaceView";
import { BoostCards } from "./BoostCards";
import { PromotedRowCard } from "./PromotedRowCard";
import { type PromoteBuy, usePromoteBuy } from "./usePromoteBuy";
/**
 * Community settings › Promote (community parity E, feature discovery-promote; the reference's Promote page): the
 * community's Discovery rank, the three boosts by the week (Boost, Super Boost, Mega Boost with its gold label and
 * guaranteed place) and the Promoted row at the top of Discover with its live views, clicks and joins. Payments go
 * through the server's checkout; while Meldiq takes none, the buttons say payments are being set up.
 */
export function PromotePage({ detail }: { detail: OrgAdminDetail }) {
  useLocaleRender();
  const engine = useEngine();
  const orgId = detail.org.id;
  const view = useLoad(() => promoteView(engine, orgId), [engine, orgId]);
  const buyer = usePromoteBuy();
  if (!view.data) {
    return <div className="ws-page">{view.error ? <ErrorLine text={view.error} /> : <div aria-busy="true" className="skeleton" style={{ height: 160, borderRadius: 16 }} />}</div>;
  }
  const v = view.data;
  return (
    <div className="ws-page promote-page">
      <RankCard view={v} memberCount={detail.stats.members} />
      <BuyNotes buyer={buyer} billingReason={v.billing.available ? null : v.billing.reason} />
      <BoostCards orgId={orgId} view={v} buyer={buyer} />
      <PromotedRowCard orgId={orgId} name={detail.org.name} photoRev={detail.org.photoRev} view={v} buyer={buyer} />
    </div>
  );
}
function RankCard({ view, memberCount }: { view: PromoteView; memberCount: number }) {
  useLocaleRender();
  const why = view.listed ? null : unlistedText(view.reason, memberCount, DISCOVERY_LIMITS.minMembers);
  const boost = view.boost;
  return (
    <Card title={uiText("workspace.interface.discovery_rank_cee844a")} sub={uiText("workspace.interface.where_this_community_shows_in_discover_s_list_boosted_communities_3729cad")}>
      <div className="promote-rank">
        <div className="promote-rank-number" aria-label={uiText("workspace.interface.discovery_rank_value0_7a76444", { value0: rankText(view.rank, view.listed) })}>
          <TrendingUp size={18} aria-hidden="true" />
          <strong>{rankText(view.rank, view.listed)}</strong>
        </div>
        <div className="lines grow">
          {why ? <span>{why}</span> : <span>{view.rank === 1 ? uiText("workspace.interface.first_in_discover_406872f") : uiText("workspace.interface.in_discover_s_list_right_now_78d3ea3")}</span>}
          {boost && (
            <small className="faint">
              <Localized
                k="workspace.interface.running_until_dc71978"
                slots={[<Clock size={12} aria-hidden="true" />, TIER_TEXT[boost.tier as keyof typeof TIER_TEXT]?.name ?? uiText("workspace.interface.a_boost_e42e5bd"), dayText(boost.endsAt)]}
              />
            </small>
          )}
          <small className="faint">
            <Localized k="workspace.interface.native_count_33e091bbd" slots={[<Eye size={12} aria-hidden="true" />, countLabel(view.visitors.weekly, "people"), ""]} />
          </small>
        </div>
        {!view.listed && view.reason !== "removed" && (
          <button className="btn btn-secondary btn-sm" onClick={() => navigate({ section: "workspace", workspacePage: "overview" })}>
            <Localized k="workspace.interface.discovery_settings_97d4805" />
          </button>
        )}
      </div>
    </Card>
  );
}
/** "Coming soon" once the server says it takes no payments yet; other refusals as errors. */
function BuyNotes({ buyer, billingReason }: { buyer: PromoteBuy; billingReason: string | null }) {
  useLocaleRender();
  if (buyer.comingSoon) {
    return (
      <div className="banner info promote-soon" role="status">
        <Localized
          k="workspace.interface.payments_are_being_set_up_boosts_and_promoted_spots_can_be_bought_6ceca16"
          slots={[
            <strong>
              <Localized k="workspace.interface.coming_soon_4f7d640" />
            </strong>,
            billingReason && <small className="faint"> {billingReason}</small>,
          ]}
        />
      </div>
    );
  }
  return <ErrorLine text={buyer.error} />;
}
