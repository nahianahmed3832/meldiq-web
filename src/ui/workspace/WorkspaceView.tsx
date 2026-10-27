import { BookOpen, HelpCircle, Smile, Ban, Building2, CalendarDays, Flag, Gauge, Hash, Laptop, LayoutGrid, ScrollText, Shield, ShieldCheck, Ticket, UserCheck, UsersRound } from "lucide-react";
import { ApplicationsPage, BansPage, SecurityPage } from "./ModerationPages";
import { ReportsPage } from "./ReportsPage";
import { GuidePage, OnboardingPage } from "./GuidePages";
import { ExpressionsPage } from "./ExpressionsPage";
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

/**
 * Community servers (API 0.12+): Community settings in Android's groups (android CommunitySettingsScreen): Community,
 * People, Channels, Moderation, More. Each page shows only for people allowed to use it, on servers that have it.
 */
type CommunityGroup = "community" | "people" | "channels" | "moderation" | "more";
const COMMUNITY_GROUPS: { key: CommunityGroup; label: string }[] = [
  { key: "community", label: "Community" },
  { key: "people", label: "People" },
  { key: "channels", label: "Channels" },
  { key: "moderation", label: "Moderation" },
  { key: "more", label: "More" },
];
const can = (p: OrgPermissions, perm: string) => p.isOwner || p.effective.includes(perm);
const COMMUNITY_PAGES: { key: WorkspacePage; label: string; icon: ReactNode; group: CommunityGroup; shown?: (p: OrgPermissions) => boolean; feature?: string }[] = [
  { key: "overview", label: "Overview", icon: <LayoutGrid size={17} />, group: "community" },
  { key: "guide", label: "Community guide", icon: <BookOpen size={17} />, group: "community", feature: "community-guide", shown: (p) => p.canManageOrg },
  { key: "onboarding", label: "Onboarding questions", icon: <HelpCircle size={17} />, group: "community", feature: "onboarding" },
  { key: "expressions", label: "Emoji & stickers", icon: <Smile size={17} />, group: "community", feature: "community-expressions", shown: (p) => can(p, "expressions.manage") },
  { key: "people", label: "Members", icon: <UsersRound size={17} />, group: "people", shown: (p) => p.canViewDirectory },
  { key: "roles", label: "Roles", icon: <ShieldCheck size={17} />, group: "people", shown: (p) => p.canViewRoles },
  { key: "invitations", label: "Invitations", icon: <Ticket size={17} />, group: "people", shown: (p) => p.canInvite },
  { key: "channels", label: "Channels & categories", icon: <Hash size={17} />, group: "channels" },
  { key: "applications", label: "Applications", icon: <UserCheck size={17} />, group: "moderation", feature: "join-applications", shown: (p) => can(p, "members.approve") },
  { key: "reports", label: "Reports", icon: <Flag size={17} />, group: "moderation", feature: "reports", shown: (p) => can(p, "reports.view") },
  { key: "security", label: "Security actions", icon: <Shield size={17} />, group: "moderation", feature: "security-actions", shown: (p) => p.canManageOrg || p.canBan },
  { key: "bans", label: "Bans", icon: <Ban size={17} />, group: "moderation", feature: "community-moderation", shown: (p) => p.canBan },
  { key: "audit", label: "Audit log", icon: <ScrollText size={17} />, group: "moderation", shown: (p) => p.canViewAudit },
  { key: "meetings", label: "Events", icon: <CalendarDays size={17} />, group: "more", feature: "meetings" },
  { key: "usage", label: "Usage", icon: <Gauge size={17} />, group: "more", shown: (p) => p.canViewUsage },
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
          <span className="empty-orb">
            <Building2 size={26} />
          </span>
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
  return (
    <section className="main" aria-label={`${org.name} settings`} style={{ display: "flex", flexDirection: "column" }}>
      <div className="settings">
        <nav className="settings-nav" aria-label={community ? "Community settings" : "Community pages"}>
          <h2 className="ellipsis">{org.name}</h2>
          {community &&
            COMMUNITY_GROUPS.map((g) => {
              const pages = COMMUNITY_PAGES.filter((p) => p.group === g.key && (!p.shown || (d && p.shown(d.permissions))) && (!p.feature || features.includes(p.feature)));
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
          {!community &&
            GROUPS.map((g) => {
              const pages = PAGES.filter((p) => p.group === g.key && (!p.shown || (d && p.shown(d.permissions, d))) && (!p.feature || features.includes(p.feature)));
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
            ) : page === "expressions" ? (
              <ExpressionsPage detail={d} />
            ) : page === "guide" ? (
              <GuidePage detail={d} />
            ) : page === "onboarding" ? (
              <OnboardingPage detail={d} />
            ) : page === "applications" ? (
              <ApplicationsPage detail={d} />
            ) : page === "reports" ? (
              <ReportsPage detail={d} />
            ) : page === "security" ? (
              <SecurityPage detail={d} />
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
