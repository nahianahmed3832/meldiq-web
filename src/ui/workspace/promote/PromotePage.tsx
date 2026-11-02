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
  const why = view.listed ? null : unlistedText(view.reason, memberCount, DISCOVERY_LIMITS.minMembers);
  const boost = view.boost;
  return (
    <Card title="Discovery rank" sub="Where this community shows in Discover's list. Boosted communities come first (the biggest boost wins), then the biggest communities.">
      <div className="promote-rank">
        <div className="promote-rank-number" aria-label={`Discovery rank ${rankText(view.rank, view.listed)}`}>
          <TrendingUp size={18} aria-hidden="true" />
          <strong>{rankText(view.rank, view.listed)}</strong>
        </div>
        <div className="lines grow">
          {why ? <span>{why}</span> : <span>{view.rank === 1 ? "First in Discover." : "In Discover's list right now."}</span>}
          {boost && (
            <small className="faint">
              <Clock size={12} aria-hidden="true" /> {TIER_TEXT[boost.tier as keyof typeof TIER_TEXT]?.name ?? "A boost"} running until {dayText(boost.endsAt)}
            </small>
          )}
          <small className="faint">
            <Eye size={12} aria-hidden="true" /> {view.visitors.weekly} {view.visitors.weekly === 1 ? "person" : "people"} opened Discover in the last 7 days
          </small>
        </div>
        {!view.listed && view.reason !== "removed" && (
          <button className="btn btn-secondary btn-sm" onClick={() => navigate({ section: "workspace", workspacePage: "overview" })}>
            Discovery settings
          </button>
        )}
      </div>
    </Card>
  );
}

/** "Coming soon" once the server says it takes no payments yet; other refusals as errors. */
function BuyNotes({ buyer, billingReason }: { buyer: PromoteBuy; billingReason: string | null }) {
  if (buyer.comingSoon) {
    return (
      <div className="banner info promote-soon" role="status">
        <strong>Coming soon</strong> · Payments are being set up. Boosts and Promoted spots can be bought here once they are.
        {billingReason && <small className="faint"> {billingReason}</small>}
      </div>
    );
  }
  return <ErrorLine text={buyer.error} />;
}
