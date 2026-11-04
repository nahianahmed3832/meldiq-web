import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useOrbit } from "../../application/orbit";
import { DISCOVERY_FEATURES } from "../../sync/discovery/rules";
import { OFFICIAL_BOTS_FEATURE } from "../../sync/officialBots";
import { TicketsSection } from "../community/tickets/TicketsCard";
import { BotsPage } from "./BotsPage";
import { AccessCard, JoinQuestionsCard } from "./ModerationPages";
import { DiscoveryCard } from "./discovery/DiscoveryCard";
import { TemplateCard } from "./discovery/TemplateCard";

export function DiscoverySettingsPage({ detail }: { detail: OrgAdminDetail }) {
  const features = useOrbit((s) => s.server?.features ?? []);
  return (
    <div className="ws-page">
      <AccessCard detail={detail} />
      {features.includes(DISCOVERY_FEATURES.listing) && <DiscoveryCard orgId={detail.org.id} />}
      {features.includes("join-applications") && <JoinQuestionsCard detail={detail} />}
      {features.includes(DISCOVERY_FEATURES.templates) && <TemplateCard orgId={detail.org.id} communityName={detail.org.name} />}
    </div>
  );
}

export function IntegrationsSettingsPage({ detail }: { detail: OrgAdminDetail }) {
  const features = useOrbit((s) => s.server?.features ?? []);
  return (
    <div className="ws-page">
      {detail.permissions.canManageOrg && (features.includes("bots") || features.includes(OFFICIAL_BOTS_FEATURE)) && <BotsPage detail={detail} />}
      <TicketsSection detail={detail} />
    </div>
  );
}
