import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { MeldlingArt } from "../components/MeldlingArt";
import { ArrowLeft, Laptop } from "lucide-react";
import { ApplicationsPage, BansPage, SecurityPage } from "./ModerationPages";
import { COMMUNITY_RAIL_GROUPS, LEGACY_GROUPS, communityPageTitle, visibleWorkspaceRail } from "./communityRail";
import { ThemePage } from "./ThemePage";
import { CommunitySparksPage } from "./SparksPromotePages";
import { PromotePage } from "./promote/PromotePage";
import { ReportsPage } from "./ReportsPage";
import { GuidePage, OnboardingPage } from "./GuidePages";
import { ExpressionsPage } from "./ExpressionsPage";
import { PinsPage } from "./PinsPage";
import { RulesPage } from "./RulesPage";
import { LobbySettingsPage } from "./LobbySettingsPage";
import { useState } from "react";
import { SettingsNavigation, SettingsUnavailable } from "../components/SettingsNavigation";
import { DiscoverySettingsPage, IntegrationsSettingsPage } from "./CategoryPages";
import { CommunityNotificationSettings } from "../community/NotifyDialogs";
import { ProfileSafety } from "./ProfileSafety";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate, type WorkspacePage } from "../../application/router";
import { workspaceDetail } from "../../sync/workspaces";
import type { ShellDialog } from "../shell/Shell";
import { ChannelsPage } from "./ChannelsPage";
import { InvitationsPage } from "./InvitationsPage";
import { BotsPage } from "./BotsPage";
import { PartnerApplicationCard } from "./PartnerApplicationCard";
import { OverviewPage } from "./OverviewPage";
import { PingRolesPage } from "./PingRolesPage";
import { PeoplePage } from "./PeoplePage";
import { useLoad } from "./useLoad";
import { RolesPage } from "./RolesPage";
import { AuditPage } from "./AuditPage";
import { UsagePage } from "./UsagePage";
import { MeetingsPage } from "./MeetingsPage";
/**
 * The current workspace's settings and administration (docs/WORKSPACE_ADMINISTRATION.md). What each page offers follows
 * the permissions the server sends; the server decides every change.
 */
export function WorkspaceView({ orgId, page: requestedPage, onDialog }: { orgId: string | null; page: WorkspacePage; onDialog: (d: ShellDialog) => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [query, setQuery] = useState("");
  const features = useOrbit((s) => s.server?.features ?? []);
  const page = requestedPage === "theme" && !features.includes("community-channels") ? "overview" : requestedPage;
  // Any change to the workspace (here, on another device, by an admin) refreshes the org list; that reloads the detail.
  const org = useOrbit((s) => s.orgs.find((o) => o.id === orgId) ?? null);
  const detail = useLoad(() => (orgId ? workspaceDetail(engine, orgId) : Promise.resolve(null)), [engine, orgId, org]);
  if (!orgId || !org) {
    return (
      <section className="main" aria-label={uiText("workspace.interface.workspace_87bb59b")}>
        <div className="empty" style={{ margin: "auto" }}>
          <MeldlingArt pose="hello" />
          <h2>
            <Localized k="workspace.interface.no_community_yet_183b3a6" />
          </h2>
          <p className="muted">
            <Localized k="workspace.interface.create_one_for_your_organisation_start_a_community_or_join_one_wi_2ea734b" />
          </p>
          <div className="row" style={{ gap: 8, justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={() => onDialog({ kind: "createWorkspace" })}>
              {l10n("workspace.rail_create")}
            </button>
            <button className="btn btn-secondary" onClick={() => onDialog({ kind: "joinWorkspace" })}>
              {l10n("workspace.home_join_code")}
            </button>
          </div>
        </div>
      </section>
    );
  }
  const d = detail.data;
  const community = features.includes("community-channels");
  const visible = visibleWorkspaceRail(features, d);
  const groups = (community ? COMMUNITY_RAIL_GROUPS : LEGACY_GROUPS)
    .map((g) => ({ key: g.key, title: g.label ?? org.name, pages: visible.filter((p) => p.group === g.key) }))
    .filter((g) => g.pages.length);
  const available = visible.some((p) => p.key === page);
  const title = visible.find((p) => p.key === page)?.label ?? communityPageTitle(page, features);
  return (
    <section className="main main-split" aria-label={uiText("workspace.interface.value0_settings_5f9bb7e", { value0: org.name })} style={{ display: "flex", flexDirection: "column" }}>
      <div className={`settings workspace-settings${community ? " community-settings" : ""}`}>
        <nav className="settings-nav" aria-label={community ? uiText("organization.interface.community_settings_7a81b1f") : uiText("workspace.interface.community_pages_e931537")}>
          <h2 className="ellipsis">{org.name}</h2>
          <div className="mobile-workspace-nav">
            <button className="icon-btn" aria-label={uiText("workspace.interface.back_to_community_a901f2b")} onClick={() => navigate({ section: "home" })}>
              <ArrowLeft size={20} />
            </button>
          </div>
          <SettingsNavigation
            groups={groups}
            current={page}
            query={query}
            onQuery={setQuery}
            compact
            label={uiText("settings.navigation.searchWorkspace")}
            compactLabel={uiText("workspace.interface.community_settings_page_f82064e")}
            onSelect={(key) => navigate({ section: "workspace", workspacePage: key })}
          />
          <button className="side-item" onClick={() => navigate({ section: "home" })} style={{ marginTop: 8 }}>
            <span className="glyph">
              <Laptop size={17} />
            </span>
            <span className="grow">{l10n("messaging.conv_back")}</span>
          </button>
        </nav>
        <div className="settings-page scroll">
          <div key={`${orgId}:${page}`} className="inner">
            <header className="workspace-settings-heading">
              <h1>{title}</h1>
            </header>
            {(!community || page === "notifications") && (
              <p className="settings-scope">
                {uiText(page === "notifications" ? "settings.interface.your_account_dbb5f63" : "settings.navigation.workspaceScope")}
                <span>{uiText(page === "notifications" ? "settings.navigation.communityNotificationsDescription" : "settings.navigation.workspaceDescription")}</span>
              </p>
            )}
            {detail.error && !d ? (
              <div className="banner danger" role="alert">
                <span className="grow">{detail.error}</span>
                <button className="btn btn-secondary btn-sm" onClick={detail.reload}>
                  {l10n("common.actions.retry")}
                </button>
              </div>
            ) : !d ? (
              <div aria-busy="true" className="skeleton" style={{ height: 160, borderRadius: 16 }} />
            ) : !available ? (
              <SettingsUnavailable />
            ) : page === "discovery" ? (
              <DiscoverySettingsPage detail={d} />
            ) : page === "bots" ? (
              <div className="ws-page workspace-bots-page">
                <BotsPage detail={d} />
              </div>
            ) : page === "ping-roles" ? (
              <PingRolesPage orgId={orgId} />
            ) : page === "partner" ? (
              <div className="ws-page">
                <PartnerApplicationCard orgId={orgId} />
              </div>
            ) : page === "integrations" ? (
              <IntegrationsSettingsPage detail={d} />
            ) : page === "notifications" ? (
              <CommunityNotificationSettings orgId={orgId} />
            ) : page === "people" ? (
              <PeoplePage detail={d} />
            ) : page === "invitations" ? (
              <InvitationsPage detail={d} />
            ) : page === "channels" ? (
              <ChannelsPage detail={d} />
            ) : page === "roles" ? (
              <RolesPage detail={d} />
            ) : page === "audit" ? (
              <AuditPage detail={d} />
            ) : page === "usage" ? (
              <UsagePage detail={d} />
            ) : page === "meetings" ? (
              <MeetingsPage detail={d} />
            ) : page === "pins" ? (
              <PinsPage detail={d} />
            ) : page === "expressions" || page === "stickers" ? (
              <ExpressionsPage detail={d} category={page === "stickers" ? "sticker" : "emoji"} />
            ) : page === "guide" ? (
              <GuidePage detail={d} />
            ) : page === "lobby" ? (
              <LobbySettingsPage detail={d} />
            ) : page === "rules" ? (
              <RulesPage detail={d} />
            ) : page === "onboarding" ? (
              <OnboardingPage detail={d} />
            ) : page === "applications" ? (
              <ApplicationsPage detail={d} />
            ) : page === "reports" ? (
              <ReportsPage detail={d} />
            ) : page === "security" ? (
              community ? (
                <ProfileSafety detail={d} focused={false} />
              ) : (
                <SecurityPage detail={d} />
              )
            ) : page === "theme" ? (
              <ThemePage detail={d} onChanged={detail.reload} />
            ) : page === "sparks" ? (
              <CommunitySparksPage detail={d} />
            ) : page === "promote" ? (
              <PromotePage detail={d} />
            ) : page === "bans" ? (
              <BansPage detail={d} />
            ) : (
              <OverviewPage detail={d} onChanged={detail.reload} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
