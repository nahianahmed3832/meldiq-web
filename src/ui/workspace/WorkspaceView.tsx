import { Blocks, Building2, Gauge, Hash, Workflow, Laptop, LayoutGrid, ScrollText, ShieldCheck, Ticket, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { useEngine, useOrbit } from "../../app/orbit";
import { navigate, type WorkspacePage } from "../../app/router";
import { workspaceDetail } from "../../sync/workspaces";
import type { ShellDialog } from "../shell/Shell";
import { ChannelsPage } from "./ChannelsPage";
import { InvitationsPage } from "./InvitationsPage";
import { OverviewPage } from "./OverviewPage";
import { PeoplePage } from "./PeoplePage";
import { StructurePage } from "./StructurePage";
import { useLoad } from "./useLoad";
import { RolesPage } from "./RolesPage";
import { AuditPage } from "./AuditPage";
import { AppsPage } from "./AppsPage";
import { UsagePage } from "./UsagePage";
import { WorkflowsPage } from "./WorkflowsPage";
import type { OrgPermissions } from "../../api/workspaceSchemas";

/** Pages, with the permission flag that shows them (the server decides; older servers don't send the newer flags). */
const PAGES: { key: WorkspacePage; label: string; icon: ReactNode; shown?: (p: OrgPermissions) => boolean }[] = [
  { key: "overview", label: "Overview", icon: <LayoutGrid size={17} /> },
  { key: "people", label: "People", icon: <UsersRound size={17} /> },
  { key: "invitations", label: "Invitations", icon: <Ticket size={17} /> },
  { key: "channels", label: "Channels", icon: <Hash size={17} /> },
  { key: "structure", label: "Branches & teams", icon: <Building2 size={17} /> },
  { key: "roles", label: "Roles", icon: <ShieldCheck size={17} />, shown: (p) => p.canViewRoles },
  { key: "apps", label: "Apps", icon: <Blocks size={17} />, shown: (p) => p.canViewApps },
  { key: "audit", label: "Audit log", icon: <ScrollText size={17} />, shown: (p) => p.canViewAudit },
  { key: "workflows", label: "Workflows", icon: <Workflow size={17} />, shown: (p) => p.canManageWorkflows },
  { key: "usage", label: "Usage", icon: <Gauge size={17} />, shown: (p) => p.canViewUsage },
];

/**
 * The current workspace's settings and administration (docs/WORKSPACE_ADMINISTRATION.md). What each page offers follows
 * the permissions the server sends; the server decides every change.
 */
export function WorkspaceView({ orgId, page, onDialog }: { orgId: string | null; page: WorkspacePage; onDialog: (d: ShellDialog) => void }) {
  const engine = useEngine();
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
          <h2>No workspace yet</h2>
          <p className="muted">Create one for your organisation, or join one with an invitation code.</p>
          <div className="row" style={{ gap: 8, justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={() => onDialog({ kind: "createWorkspace" })}>
              Create a workspace
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
  return (
    <section className="main" aria-label={`${org.name} settings`} style={{ display: "flex", flexDirection: "column" }}>
      <div className="settings">
        <nav className="settings-nav" aria-label="Workspace pages">
          <h2 className="ellipsis">{org.name}</h2>
          {PAGES.filter((p) => !p.shown || (d && p.shown(d.permissions))).map((p) => (
            <button key={p.key} className="side-item" aria-current={page === p.key ? "page" : undefined} onClick={() => navigate({ section: "workspace", workspacePage: p.key })}>
              <span className="glyph">{p.icon}</span>
              <span className="grow">{p.label}</span>
            </button>
          ))}
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
            ) : page === "overview" ? (
              <OverviewPage detail={d} onChanged={detail.reload} />
            ) : page === "people" ? (
              <PeoplePage detail={d} />
            ) : page === "invitations" ? (
              <InvitationsPage detail={d} />
            ) : page === "channels" ? (
              <ChannelsPage detail={d} />
            ) : page === "roles" ? (
              <RolesPage detail={d} />
            ) : page === "apps" ? (
              <AppsPage detail={d} />
            ) : page === "audit" ? (
              <AuditPage detail={d} />
            ) : page === "usage" ? (
              <UsagePage detail={d} />
            ) : page === "workflows" ? (
              <WorkflowsPage detail={d} />
            ) : (
              <StructurePage detail={d} onChanged={detail.reload} />
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
