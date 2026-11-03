import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { useState } from "react";
import { useEngine } from "../../application/orbit";
import { type AdminUsage, adminUsage, isBytes, LIMIT_LABEL, setWorkspaceLimits } from "../../sync/usage";
import { Dialog } from "../components/Overlay";
import { bytes, dayLabel } from "../format";
import { useAction, useLoad } from "../workspace/useLoad";
import { ErrorLine } from "../workspace/WorkspaceView";
type Workspace = AdminUsage["workspaces"][number];
const PERIODS = [7, 30, 90] as const;
/** The measured figures shown per workspace in the list (the rest are in its dialog). */
const SUMMARY = ["seats.members", "seats.active_30d", "storage.bytes", "api.requests", "workflows.runs"] as const;
const SUMMARY_LABEL: Record<string, string> = {
  "seats.members": "members",
  "seats.active_30d": "active",
  "storage.bytes": "stored",
  get "api.requests"() {
    return uiText("settings.interface.api_requests_746fd95");
  },
  get "workflows.runs"() {
    return uiText("settings.interface.workflow_runs_659f945");
  },
};
const MB = 1048576;
const figure = (key: string, n: number): string => (isBytes(key) ? bytes(n) : String(n));
/**
 * Settings › Workspace usage, for platform administrators (server docs/USAGE_AND_PLANS.md): every workspace's measured
 * totals, counts only, and its own limits. No plan, price or charge exists; a workspace can never raise its own limits.
 */
export function AdminUsagePage() {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [days, setDays] = useState<number>(30);
  const [tick, setTick] = useState(0);
  const usage = useLoad(() => adminUsage(engine, days), [engine, days, tick]);
  const [open, setOpen] = useState<Workspace | null>(null);
  return (
    <>
      <h1>{l10n("admin.usage")}</h1>
      <p className="faint">
        <Localized k="settings.interface.counts_and_sizes_the_server_measured_never_content_file_names_or_1c783d1" />
      </p>
      <span className="segmented" role="group" aria-label={uiText("settings.interface.period_6e795d4")}>
        {PERIODS.map((d) => (
          <button key={d} aria-pressed={days === d} onClick={() => setDays(d)}>
            <Localized k="settings.interface.days_596bf50" slots={[d]} />
          </button>
        ))}
      </span>
      <ErrorLine text={usage.error} />
      {!usage.data && !usage.error && <div className="skeleton" style={{ height: 120 }} aria-busy="true" />}
      <ul className="ws-list">
        {(usage.data?.workspaces ?? []).map((w) => (
          <li key={w.id}>
            <button className="list-row" onClick={() => setOpen(w)}>
              <span className="lines grow">
                <strong>{w.name}</strong>
                <small>{SUMMARY.map((k) => `${figure(k, w.usage[k] ?? 0)} ${SUMMARY_LABEL[k]}`).join(" · ")}</small>
                <small className="faint">
                  <Localized
                    k="settings.interface.made_b5adcbe"
                    slots={[
                      dayLabel(w.createdAt),
                      w.limits.length
                        ? uiText("settings.interface.own_limits_value0_f1ec3e0", { value0: w.limits.map((l) => `${LIMIT_LABEL[l.key] ?? l.key} ${figure(l.key, l.limit)}`).join(", ") })
                        : "",
                    ]}
                  />
                </small>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <LimitsDialog
          w={open}
          days={days}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null);
            setTick((t) => t + 1);
          }}
        />
      )}
    </>
  );
}
/** A workspace's measured totals and its own limits; an empty field means the server-wide limit (or none) applies. */
function LimitsDialog({ w, days, onClose, onSaved }: { w: Workspace; days: number; onClose: () => void; onSaved: () => void }) {
  useLocaleRender();
  const engine = useEngine();
  const own = Object.fromEntries(w.limits.map((l) => [l.key, l.limit]));
  const shown = (key: string, v: number | undefined) => (v === undefined ? "" : String(isBytes(key) ? Math.round(v / MB) : v));
  const [draft, setDraft] = useState<Record<string, string>>(Object.fromEntries(Object.keys(LIMIT_LABEL).map((k) => [k, shown(k, own[k])])));
  const act = useAction();
  const parsed = Object.entries(draft).map(([k, v]) => [k, v.trim() === "" ? null : Number(v)] as const);
  const invalid = parsed.some(([, v]) => v !== null && (!Number.isInteger(v) || v < 0));
  const changes = Object.fromEntries(
    parsed.filter(([k, v]) => (v === null ? own[k] !== undefined : (isBytes(k) ? v * MB : v) !== own[k])).map(([k, v]) => [k, v === null ? null : isBytes(k) ? v * MB : v]),
  );
  return (
    <Dialog
      title={w.name}
      wide
      onClose={onClose}
      footer={
        <button
          className="btn btn-primary"
          disabled={invalid || Object.keys(changes).length === 0 || act.busy}
          onClick={() => void act.act(() => setWorkspaceLimits(engine, w.id, changes).then(onSaved))}
        >
          <Localized k="settings.interface.save_limits_237e964" />
        </button>
      }
    >
      <div className="dialog-body">
        <strong style={{ fontSize: 13 }}>
          <Localized k="settings.interface.measured_over_days_093f0f1" slots={[days]} />
        </strong>
        <ul className="ws-list">
          {Object.entries(w.usage).map(([k, v]) => (
            <li key={k} className="ws-row" style={{ fontSize: 13 }}>
              <span className="grow faint">{k}</span>
              <span>{figure(k, v)}</span>
            </li>
          ))}
        </ul>
        <strong style={{ fontSize: 13 }}>
          <Localized k="settings.interface.this_community_s_own_limits_f57528b" />
        </strong>
        <small className="faint">
          <Localized k="settings.interface.leave_a_field_empty_for_the_server_wide_limit_if_any_lowering_a_l_9a6e0d2" />
        </small>
        <div className="limits-grid">
          {Object.entries(LIMIT_LABEL).map(([k, label]) => (
            <label key={k} className="field">
              <span>
                {label}
                {isBytes(k) ? uiText("settings.interface.mb_68a0f7c") : ""}
              </span>
              <input
                className="input"
                inputMode="numeric"
                value={draft[k]}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                placeholder={uiText("settings.interface.no_own_limit_7940df7")}
              />
            </label>
          ))}
        </div>
        <ErrorLine text={invalid ? uiText("settings.interface.limits_are_whole_numbers_0_or_more_f4e3009") : act.error} />
      </div>
    </Dialog>
  );
}
