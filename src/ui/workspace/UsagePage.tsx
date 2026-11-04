import { formatNumber, formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../application/orbit";
import { usageMetricLabel, usageLimitLabel, isBytes, workspacePlan, workspaceUsage, type WorkspaceUsage } from "../../sync/usage";
import { bytes } from "../format";
import { useLoad } from "./useLoad";
import { Card, ErrorLine } from "../components/SettingsCard";
/** Community › Usage (android UsageScreen): people, channels, files and any server-wide limits, counted by the server. */
export function UsagePage({ detail }: { detail: OrgAdminDetail }) {
  useLocaleRender();
  const l10n = useLocalization();
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
          <Card
            title={uiText("calls.interface.people_7db2089")}
            sub={uiText("workspace.interface.value0_and_value1_value2_and_value3_463fd86", {
              value0: count(u.members.owners, "owner"),
              value1: count(u.members.admins, "admin"),
              value2: count(u.members.members, "member"),
              value3: count(u.members.guests, "guest"),
            })}
          >
            <p className="usage-figure">{formatUiNumber(u.members.total)}</p>
          </Card>
          {u.structure.categories !== undefined ? (
            <Card title={l10n("organization.channels")} sub={uiText("workspace.interface.archived_channels_value0_99ee605", { value0: u.structure.archivedChannels })}>
              <div className="usage-stats">
                <Stat label={l10n("organization.channels")} value={u.structure.channels} />
                <Stat label={uiText("workspace.interface.categories_b8b1d89")} value={u.structure.categories} />
              </div>
            </Card>
          ) : (
            <Card
              title={uiText("workspace.interface.structure_7203c2b")}
              sub={uiText("workspace.interface.archived_channels_value0_departments_value1_c662be3", { value0: u.structure.archivedChannels, value1: u.structure.departments })}
            >
              <div className="usage-stats">
                <Stat label={uiText("workspace.interface.branches_2eee037")} value={u.structure.branches} />
                <Stat label={uiText("workspace.interface.teams_1e1a1c0")} value={u.structure.teams} />
                <Stat label={l10n("organization.channels")} value={u.structure.channels} />
              </div>
            </Card>
          )}
          <Card title={l10n("files.files")} sub={uiText("workspace.interface.encrypted_files_the_server_still_holds_for_this_community_s_chann_61edd78")}>
            <p className="usage-figure">
              {bytes(u.files.bytes)} <small>· {count(u.files.count, "file")}</small>
            </p>
          </Card>
          <Card title={u.apps ? uiText("workspace.interface.apps_roles_and_invitations_f5dc3f3") : uiText("workspace.interface.roles_and_invitations_b061436")}>
            {u.apps && (
              <p className="faint" style={{ margin: "0 0 4px" }}>
                <Localized
                  k="workspace.interface.installed_4b4708d"
                  slots={[count(u.apps.installed, "app"), count(u.apps.connectedAccounts, "connected account"), count(u.apps.notifications, "app notification")]}
                />
              </p>
            )}
            <p className="faint" style={{ margin: 0 }}>
              <Localized k="workspace.interface.custom_roles_active_invitations_e5f9c0b" slots={[u.roles.custom, u.invitations.active]} />
            </p>
          </Card>
          {u.metered && <MeteredCard metered={u.metered} />}
          {plan.data && (
            <Card title={uiText("workspace.interface.limits_dffb64d")} sub={uiText("workspace.interface.no_plan_price_or_upgrade_exists_yet_any_limit_here_was_set_for_th_2817c24")}>
              {limited.length === 0 ? (
                <p className="faint" style={{ margin: 0 }}>
                  <Localized k="workspace.interface.no_plan_or_limits_apply_to_this_community_0677575" />
                </p>
              ) : (
                <ul className="ws-list">
                  {limited.map((c) => (
                    <li key={c.key} className={`ws-row${c.available ? "" : " warn-text"}`}>
                      <span className="grow">{usageLimitLabel(c.key, c.label)}</span>
                      <span>
                        <Localized
                          k="workspace.interface.of_b5ab8e6"
                          slots={[
                            amount(c.key, c.used),
                            amount(c.key, c.limit ?? 0),
                            <small className="faint">
                              ({c.source === "workspace" ? uiText("workspace.interface.this_community_s_limit_577fd83") : uiText("workspace.interface.this_server_s_limit_557aa09")})
                            </small>,
                          ]}
                        />
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
const labels = {
  owner: "workspace.usage.owners",
  admin: "workspace.usage.admins",
  guest: "workspace.interface.guests_3c8e0fd",
  app: "workspace.interface.apps_89dd748",
  "connected account": "workspace.usage.connectedAccounts",
  "app notification": "workspace.usage.appNotifications",
} as const;
const count = (n: number, word: keyof typeof labels | "member" | "file"): string =>
  word === "member" ? uiText("common.counts.members", { count: n }) : word === "file" ? uiText("common.counts.files", { count: n }) : `${uiText(labels[word])}: ${formatNumber(n)}`;
const amount = (key: string, n: number): string => (isBytes(key) ? bytes(n) : formatNumber(n));
/** What the server measured per day (android round 7 C7): counts and sizes only, never content or who did what. */
function MeteredCard({ metered }: { metered: NonNullable<WorkspaceUsage["metered"]> }) {
  useLocaleRender();
  return (
    <Card
      title={uiText("workspace.interface.measured_over_the_last_value0_days_57c8807", { value0: metered.days })}
      sub={uiText("workspace.interface.counts_and_sizes_only_never_message_content_or_who_did_what_membe_0404f68")}
    >
      <ul className="ws-list">
        {metered.metrics.map((m) => (
          <li key={m.metric} className="ws-row">
            <span className="grow">{usageMetricLabel(m.metric, m.label)}</span>
            {m.kind === "counter" && <Spark values={m.daily.map((d) => d.value)} label={uiText("workspace.interface.value0_per_day_e4c5da0", { value0: usageMetricLabel(m.metric, m.label) })} />}
            <strong style={{ minWidth: 72, textAlign: "end" }}>{amount(m.metric, m.total)}</strong>
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
  useLocaleRender();
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
  useLocaleRender();
  return (
    <div className="usage-stat">
      <strong>{formatUiNumber(value)}</strong>
      <small>{label}</small>
    </div>
  );
}
