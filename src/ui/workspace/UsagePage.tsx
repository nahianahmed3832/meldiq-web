import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../application/orbit";
import { isBytes, workspacePlan, workspaceUsage, type WorkspaceUsage } from "../../sync/usage";
import { bytes } from "../format";
import { useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

/** Community › Usage (android UsageScreen): people, channels, files and any server-wide limits, counted by the server. */
export function UsagePage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const usage = useLoad(() => workspaceUsage(engine, orgId), [engine, orgId]);
  // Every member may see the plan and its limits; a server without plans answers 404, which just leaves the card out.
  const plan = useLoad(() => workspacePlan(engine, orgId).catch(() => null), [engine, orgId]);
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
          {u.structure.categories !== undefined ? (
            <Card title="Channels" sub={`Archived channels: ${u.structure.archivedChannels}`}>
              <div className="usage-stats">
                <Stat label="Channels" value={u.structure.channels} />
                <Stat label="Categories" value={u.structure.categories} />
              </div>
            </Card>
          ) : (
            <Card title="Structure" sub={`Archived channels: ${u.structure.archivedChannels} · Departments: ${u.structure.departments}`}>
              <div className="usage-stats">
                <Stat label="Branches" value={u.structure.branches} />
                <Stat label="Teams" value={u.structure.teams} />
                <Stat label="Channels" value={u.structure.channels} />
              </div>
            </Card>
          )}
          <Card title="Files" sub="Encrypted files the server still holds for this community's channels. It never sees what's in them.">
            <p className="usage-figure">
              {bytes(u.files.bytes)} <small>· {count(u.files.count, "file")}</small>
            </p>
          </Card>
          <Card title={u.apps ? "Apps, roles and invitations" : "Roles and invitations"}>
            {u.apps && (
              <p className="faint" style={{ margin: "0 0 4px" }}>
                {count(u.apps.installed, "app")} installed · {count(u.apps.connectedAccounts, "connected account")} · {count(u.apps.notifications, "app notification")}
              </p>
            )}
            <p className="faint" style={{ margin: 0 }}>
              Custom roles: {u.roles.custom} · Active invitations: {u.invitations.active}
            </p>
          </Card>
          {u.metered && <MeteredCard metered={u.metered} />}
          {plan.data && (
            <Card title="Limits" sub="No plan, price or upgrade exists yet; any limit here was set for this server or this community.">
              {limited.length === 0 ? (
                <p className="faint" style={{ margin: 0 }}>
                  No plan or limits apply to this community.
                </p>
              ) : (
                <ul className="ws-list">
                  {limited.map((c) => (
                    <li key={c.key} className={`ws-row${c.available ? "" : " warn-text"}`}>
                      <span className="grow">{c.label}</span>
                      <span>
                        {amount(c.key, c.used)} of {amount(c.key, c.limit ?? 0)} <small className="faint">({c.source === "workspace" ? "this community's limit" : "this server's limit"})</small>
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
const amount = (key: string, n: number): string => (isBytes(key) ? bytes(n) : String(n));

/** What the server measured per day (android round 7 C7): counts and sizes only, never content or who did what. */
function MeteredCard({ metered }: { metered: NonNullable<WorkspaceUsage["metered"]> }) {
  return (
    <Card title={`Measured over the last ${metered.days} days`} sub="Counts and sizes only: never message content or who did what. Members, active members and stored files are today's figures.">
      <ul className="ws-list">
        {metered.metrics.map((m) => (
          <li key={m.metric} className="ws-row">
            <span className="grow">{m.label}</span>
            {m.kind === "counter" && <Spark values={m.daily.map((d) => d.value)} label={`${m.label} per day`} />}
            <strong style={{ minWidth: 72, textAlign: "right" }}>{amount(m.metric, m.total)}</strong>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const SPARK_W = 90;
const SPARK_H = 20;

/** A day-by-day bar strip; empty days are a hairline. */
function Spark({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  const w = SPARK_W / Math.max(1, values.length);
  return (
    <svg width={SPARK_W} height={SPARK_H} role="img" aria-label={label} className="usage-spark">
      {values.map((v, i) => {
        const h = v ? Math.max(2, (v / max) * SPARK_H) : 1;
        return <rect key={i} x={i * w} y={SPARK_H - h} width={Math.max(1, w - 1)} height={h} rx={1} />;
      })}
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="usage-stat">
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}
