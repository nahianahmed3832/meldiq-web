import { MeldlingArt } from "../components/MeldlingArt";
import { ArrowLeft, CalendarDays, Gauge, Hash, Laptop, LayoutGrid, ScrollText, ShieldCheck, Ticket, UsersRound } from "lucide-react";
import { ApplicationsPage, BansPage, SecurityPage } from "./ModerationPages";
import { COMMUNITY_RAIL_GROUPS, communityPageTitle, communityRailKey, visibleCommunityRail } from "./communityRail";
import { ThemePage } from "./ThemePage";
import { CommunitySparksPage } from "./SparksPromotePages";
import { PromotePage } from "./promote/PromotePage";
import { ReportsPage } from "./ReportsPage";
import { GuidePage, OnboardingPage } from "./GuidePages";
import { ExpressionsPage } from "./ExpressionsPage";
import { PinsPage } from "./PinsPage";
import { BotsPage } from "./BotsPage";
import { RulesPage } from "./RulesPage";
import { LobbySettingsPage } from "./LobbySettingsPage";
import type { ReactNode } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate, type WorkspacePage } from "../../application/router";
import { workspaceDetail } from "../../sync/workspaces";
import type { ShellDialog } from "../shell/Shell";
import { ChannelsPage } from "./ChannelsPage";
import { InvitationsPage } from "./InvitationsPage";
import { OverviewPage } from "./OverviewPage";
import { PeoplePage } from "./PeoplePage";
import { useLoad } from "./useLoad";
import { RolesPage } from "./RolesPage";
import { AuditPage } from "./AuditPage";
import { UsagePage } from "./UsagePage";
import { MeetingsPage } from "./MeetingsPage";
import type { OrgAdminDetail, OrgPermissions } from "../../api/workspaceSchemas";

/** Pages, with the permission flag that shows them (the server decides; older servers don't send the newer flags). */
/** Meldiq 2.0: the pages in three groups (people and channels; tools; administration) instead of one long list. */
type PageGroup = "workspace" | "tools" | "admin";
const GROUPS: { key: PageGroup; label: string }[] = [
  { key: "workspace", label: "Workspace" },
  { key: "tools", label: "Tools" },
  { key: "admin", label: "Administration" },
];

const PAGES: { key: WorkspacePage; label: string; icon: ReactNode; group: PageGroup; shown?: (p: OrgPermissions, d: OrgAdminDetail) => boolean; feature?: string }[] = [
  { key: "overview", label: "Overview", icon: <LayoutGrid size={17} />, group: "workspace" },
  { key: "people", label: "People", icon: <UsersRound size={17} />, group: "workspace" },
  { key: "invitations", label: "Invitations", icon: <Ticket size={17} />, group: "workspace" },
  { key: "channels", label: "Channels", icon: <Hash size={17} />, group: "workspace" },
  { key: "meetings", label: "Meetings", icon: <CalendarDays size={17} />, group: "tools", feature: "meetings" },
  { key: "roles", label: "Roles", icon: <ShieldCheck size={17} />, group: "admin", shown: (p) => p.canViewRoles },
  { key: "audit", label: "Audit log", icon: <ScrollText size={17} />, group: "admin", shown: (p) => p.canViewAudit },
  { key: "usage", label: "Usage", icon: <Gauge size={17} />, group: "admin", shown: (p) => p.canViewUsage },
];

/**
 * The current workspace's settings and administration (docs/WORKSPACE_ADMINISTRATION.md). What each page offers follows
 * the permissions the server sends; the server decides every change.
 */
export function WorkspaceView({ orgId, page, onDialog }: { orgId: string | null; page: WorkspacePage; onDialog: (d: ShellDialog) => void }) {
  const engine = useEngine();
  const features = useOrbit((s) => s.server?.features ?? []);
  // Any change to the workspace (here, on another device, by an admin) refreshes the org list; that reloads the detail.
  const org = useOrbit((s) => s.orgs.find((o) => o.id === orgId) ?? null);
  const detail = useLoad(() => (orgId ? workspaceDetail(engine, orgId) : Promise.resolve(null)), [engine, orgId, org]);

  if (!orgId || !org) {
    return (
      <section className="main" aria-label="Workspace">
        <div className="empty" style={{ margin: "auto" }}>
          <MeldlingArt pose="hello" />
          <h2>No community yet</h2>
          <p className="muted">Create one for your organisation, start a community, or join one with an invitation code.</p>
          <div className="row" style={{ gap: 8, justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={() => onDialog({ kind: "createWorkspace" })}>
              Create a community
            </button>
            <button className="btn btn-secondary" onClick={() => onDialog({ kind: "joinWorkspace" })}>
              Join with a code
            </button>
          </div>
        </div>
      </section>
    );
  }

  const d = detail.data;
  const community = features.includes("community-channels");
  const workspacePages = PAGES.filter((p) => (!p.shown || (d && p.shown(d.permissions, d))) && (!p.feature || features.includes(p.feature)));
  const mobilePages = community ? visibleCommunityRail(features, d?.permissions ?? null) : workspacePages;
  const mobileGroups = community ? COMMUNITY_RAIL_GROUPS : GROUPS;
  const currentPage = community ? communityRailKey(page) : page;
  return (
    <section className="main main-split" aria-label={`${org.name} settings`} style={{ display: "flex", flexDirection: "column" }}>
      <div className={`settings workspace-settings${community ? " community-settings" : ""}`}>
        <nav className="settings-nav" aria-label={community ? "Community settings" : "Community pages"}>
          <div className="mobile-workspace-nav">
            <button className="icon-btn" aria-label="Back to community" onClick={() => navigate({ section: "home" })}>
              <ArrowLeft size={20} />
            </button>
            <label className="grow">
              <span className="sr-only">Community settings page</span>
              <select
                className="input"
                value={mobilePages.some((p) => p.key === currentPage) ? currentPage : ""}
                onChange={(e) => navigate({ section: "workspace", workspacePage: e.target.value as WorkspacePage })}
              >
                <option value="" disabled>
                  Choose a settings page
                </option>
                {mobileGroups.map((group) => {
                  const pages = mobilePages.filter((p) => p.group === group.key);
                  return pages.length ? (
                    <optgroup key={group.key} label={group.label ?? org.name}>
                      {pages.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.label}
                        </option>
                      ))}
                    </optgroup>
                  ) : null;
                })}
              </select>
            </label>
          </div>
          {!community && <h2 className="ellipsis">{org.name}</h2>}
          {community && <CommunityRail name={org.name} page={page} features={features} permissions={d?.permissions ?? null} />}
          {!community &&
            GROUPS.map((g) => {
              const pages = workspacePages.filter((p) => p.group === g.key);
              if (pages.length === 0) return null;
              return (
                <div key={g.key} role="group" aria-labelledby={`ws-group-${g.key}`} className="settings-nav-group">
                  <h3 id={`ws-group-${g.key}`} className="ws-subhead">
                    {g.label}
                  </h3>
                  {pages.map((p) => (
                    <button key={p.key} className="side-item" aria-current={page === p.key ? "page" : undefined} onClick={() => navigate({ section: "workspace", workspacePage: p.key })}>
                      <span className="glyph">{p.icon}</span>
                      <span className="grow">{p.label}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          <button className="side-item" onClick={() => navigate({ section: "home" })} style={{ marginTop: 8 }}>
            <span className="glyph">
              <Laptop size={17} />
            </span>
            <span className="grow">Back to conversations</span>
          </button>
        </nav>
        <div className="settings-page scroll">
          <div className="inner">
            {community && <h1>{communityPageTitle(page, features)}</h1>}
            {detail.error && !d ? (
              <div className="banner danger" role="alert">
                <span className="grow">{detail.error}</span>
                <button className="btn btn-secondary btn-sm" onClick={detail.reload}>
                  Try again
                </button>
              </div>
            ) : !d ? (
              <div aria-busy="true" className="skeleton" style={{ height: 160, borderRadius: 16 }} />
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
            ) : page === "bots" ? (
              <BotsPage detail={d} />
            ) : page === "expressions" ? (
              <ExpressionsPage detail={d} />
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
            ) : page === "security" && !community ? (
              <SecurityPage detail={d} />
            ) : page === "theme" ? (
              <ThemePage detail={d} onChanged={detail.reload} />
            ) : page === "sparks" ? (
              <CommunitySparksPage detail={d} />
            ) : page === "promote" ? (
              <PromotePage detail={d} />
            ) : page === "bans" ? (
              <BansPage detail={d} />
            ) : (
              <OverviewPage detail={d} onChanged={detail.reload} focusSafety={page === "security"} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

interface CommunityRailProps {
  name: string;
  page: WorkspacePage;
  features: readonly string[];
  permissions: OrgPermissions | null;
}

/** Community settings' left rail: the community's own group under its name, then small uppercase group titles. */
function CommunityRail({ name, page, features, permissions }: CommunityRailProps) {
  const visible = visibleCommunityRail(features, permissions);
  const current = communityRailKey(page);
  return (
    <>
      {COMMUNITY_RAIL_GROUPS.map((g) => {
        const pages = visible.filter((p) => p.group === g.key);
        if (pages.length === 0) return null;
        return (
          <div key={g.key} role="group" aria-labelledby={`ws-group-${g.key}`} className="settings-nav-group">
            <div id={`ws-group-${g.key}`} className="settings-nav-title ellipsis">
              {g.label ?? name}
            </div>
            {pages.map((p) => (
              <button key={p.key} className="side-item" aria-current={current === p.key ? "page" : undefined} onClick={() => navigate({ section: "workspace", workspacePage: p.key })}>
                <span className="glyph">{p.icon}</span>
                <span className="grow">{p.label}</span>
              </button>
            ))}
          </div>
        );
      })}
    </>
  );
}

/** A settings card with a title, used by every workspace page. */
export function Card({ title, sub, children, actions }: { title: string; sub?: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card ws-card" aria-label={title}>
      <header className="ws-card-head">
        <div className="grow">
          <h3>{title}</h3>
          {sub && <p className="muted">{sub}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function ErrorLine({ text }: { text: string | null }) {
  return text ? (
    <div className="banner danger" role="alert">
      {text}
    </div>
  ) : null;
}
