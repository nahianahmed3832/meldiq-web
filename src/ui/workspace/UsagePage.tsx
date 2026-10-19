import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../app/orbit";
import { workspacePlan, workspaceUsage } from "../../sync/usage";
import { bytes } from "../format";
import { useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

/** Workspace › Usage (android UsageScreen): people, structure, files, apps and any server-wide limits, counted by the server. */
export function UsagePage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const hasApps = useOrbit((s) => s.server?.features.includes("integrations") ?? false);
  const usage = useLoad(() => workspaceUsage(engine, orgId), [engine, orgId]);
  const plan = useLoad(() => (hasApps ? workspacePlan(engine, orgId) : Promise.resolve(null)), [engine, orgId, hasApps]);
  const u = usage.data;
  const limited = plan.data?.capabilities.filter((c) => c.limit !== null) ?? [];
  return (
    <div className="ws-page">
      <ErrorLine text={usage.error} />
      {!u ? (
        !usage.error && <div aria-busy="true" className="skeleton" style={{ height: 160, borderRadius: 16 }} />
      ) : (
        <>
          <Card title="People" sub={`${count(u.members.owners, "owner")} and ${count(u.members.admins, "admin")} · ${count(u.members.members, "member")} and ${count(u.members.guests, "guest")}`}>
            <p className="usage-figure">{u.members.total}</p>
          </Card>
          <Card title="Structure" sub={`Archived channels: ${u.structure.archivedChannels} · Departments: ${u.structure.departments}`}>
            <div className="usage-stats">
              <Stat label="Branches" value={u.structure.branches} />
              <Stat label="Teams" value={u.structure.teams} />
              <Stat label="Channels" value={u.structure.channels} />
            </div>
          </Card>
          <Card title="Files" sub="Encrypted files the server still holds for this workspace's channels. It never sees what's in them.">
            <p className="usage-figure">
              {bytes(u.files.bytes)} <small>· {count(u.files.count, "file")}</small>
            </p>
          </Card>
          <Card title="Apps, roles and invitations">
            <p className="faint" style={{ margin: 0 }}>
              {count(u.apps.installed, "app")} installed · {count(u.apps.connectedAccounts, "connected account")} · {count(u.apps.notifications, "app notification")}
            </p>
            <p className="faint" style={{ margin: "4px 0 0" }}>
              Custom roles: {u.roles.custom} · Active invitations: {u.invitations.active}
            </p>
          </Card>
          {plan.data && (
            <Card title="Limits">
              {limited.length === 0 ? (
                <p className="faint" style={{ margin: 0 }}>
                  No plan or limits apply to this workspace.
                </p>
              ) : (
                <ul className="ws-list">
                  {limited.map((c) => (
                    <li key={c.key} className={`ws-row${c.available ? "" : " warn-text"}`}>
                      <span className="grow">{c.label}</span>
                      <span>
                        {c.used} of {c.limit}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

const count = (n: number, word: string): string => `${n} ${n === 1 ? word : `${word}s`}`;

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="usage-stat">
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}
