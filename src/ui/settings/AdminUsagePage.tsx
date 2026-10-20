import { useState } from "react";
import { useEngine } from "../../app/orbit";
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
  "api.requests": "API requests",
  "workflows.runs": "workflow runs",
};
const MB = 1_048_576;

const figure = (key: string, n: number): string => (isBytes(key) ? bytes(n) : String(n));

/**
 * Settings › Workspace usage, for platform administrators (server docs/USAGE_AND_PLANS.md): every workspace's measured
 * totals, counts only, and its own limits. No plan, price or charge exists; a workspace can never raise its own limits.
 */
export function AdminUsagePage() {
  const engine = useEngine();
  const [days, setDays] = useState<number>(30);
  const [tick, setTick] = useState(0);
  const usage = useLoad(() => adminUsage(engine, days), [engine, days, tick]);
  const [open, setOpen] = useState<Workspace | null>(null);
  return (
    <>
      <h1>Workspace usage</h1>
      <p className="faint">Counts and sizes the server measured: never content, file names or who did what. Nothing charges anyone.</p>
      <span className="segmented" role="group" aria-label="Period">
        {PERIODS.map((d) => (
          <button key={d} aria-pressed={days === d} onClick={() => setDays(d)}>
            {d} days
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
                  Made {dayLabel(w.createdAt)}
                  {w.limits.length ? ` · own limits: ${w.limits.map((l) => `${LIMIT_LABEL[l.key] ?? l.key} ${figure(l.key, l.limit)}`).join(", ")}` : ""}
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
          Save limits
        </button>
      }
    >
      <div className="dialog-body">
        <strong style={{ fontSize: 13 }}>Measured over {days} days</strong>
        <ul className="ws-list">
          {Object.entries(w.usage).map(([k, v]) => (
            <li key={k} className="ws-row" style={{ fontSize: 13 }}>
              <span className="grow faint">{k}</span>
              <span>{figure(k, v)}</span>
            </li>
          ))}
        </ul>
        <strong style={{ fontSize: 13 }}>This workspace's own limits</strong>
        <small className="faint">Leave a field empty for the server-wide limit, if any. Lowering a limit never removes anything; only adding more is refused.</small>
        <div className="limits-grid">
          {Object.entries(LIMIT_LABEL).map(([k, label]) => (
            <label key={k} className="field">
              <span>
                {label}
                {isBytes(k) ? " (MB)" : ""}
              </span>
              <input className="input" inputMode="numeric" value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} placeholder="No own limit" />
            </label>
          ))}
        </div>
        <ErrorLine text={invalid ? "Limits are whole numbers, 0 or more." : act.error} />
      </div>
    </Dialog>
  );
}
