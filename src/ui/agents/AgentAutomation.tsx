import { Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useEngine } from "../../application/orbit";
import {
  addTrigger,
  type AgentDetail,
  AUTONOMY_LABEL,
  agentTriggers,
  aiOverview,
  type Autonomy,
  type Install,
  type NewTrigger,
  removeTrigger,
  runTrigger,
  type Trigger,
  updateTrigger,
} from "../../sync/aiWorkforce";
import { relative } from "../format";
import { Card, ErrorLine } from "../workspace/WorkspaceView";
import { useAction, useLoad } from "../workspace/useLoad";

/**
 * How an agent works on its own (server docs/AI_WORKFORCE.md §5b): its autonomy level, its triggers, and its limits.
 * The server enforces all of it; a higher level never grants a tool or a channel by itself.
 */
type Patch = (p: Record<string, unknown>, message?: string) => void;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LOCAL_TZ = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
})();

export function AutonomyStep({ agent: a, manage, busy, patch, triggers }: { agent: Install; manage: boolean; busy: boolean; patch: Patch; triggers: number }) {
  return (
    <Card title="Autonomy" sub="How much it does on its own. The server enforces each level; choosing more never gives it new tools or channels.">
      <div className="autonomy-options" role="radiogroup" aria-label="Autonomy">
        {(Object.keys(AUTONOMY_LABEL) as Autonomy[]).map((k) => (
          <label key={k} className={`autonomy-option${a.autonomy === k ? " on" : ""}`}>
            <input type="radio" name="autonomy" value={k} checked={a.autonomy === k} disabled={!manage || busy} onChange={() => patch({ autonomy: k }, `Autonomy: ${AUTONOMY_LABEL[k].title}.`)} />
            <span className="lines">
              <strong>{AUTONOMY_LABEL[k].title}</strong>
              <small>{AUTONOMY_LABEL[k].body}</small>
            </span>
          </label>
        ))}
      </div>
      {(a.autonomy === "guarded" || a.autonomy === "continuous") && a.effectiveMode === "review" && (
        <div className="banner warn">The platform requires review for now, so its results are still reviewed.</div>
      )}
      {a.autonomy === "continuous" && triggers === 0 && <div className="banner">Continuous, but it has no trigger yet: add one under Triggers, or it only works when asked.</div>}
    </Card>
  );
}

const describe = (t: Trigger, agentName: (id: string) => string) => {
  if (t.kind === "webhook") return "When an outside system calls its webhook";
  if (t.kind === "after_agent") return `When ${t.sourceInstallId ? agentName(t.sourceInstallId) : "another agent"} finishes a request`;
  const c = (t.config ?? {}) as { every?: string; at?: string; weekday?: number; timeZone?: string };
  const when = c.every === "hour" ? `every hour at :${(c.at ?? "00:00").slice(3)}` : c.every === "week" ? `every ${WEEKDAYS[c.weekday ?? 1]} at ${c.at}` : `every day at ${c.at}`;
  return `${when} (${c.timeZone})`;
};

export function TriggersStep({ orgId, detail, manage, channelNames }: { orgId: string; detail: AgentDetail; manage: boolean; channelNames: Map<string, string> }) {
  const engine = useEngine();
  const a = detail.agent;
  const list = useLoad(() => (manage ? agentTriggers(engine, orgId, a.id) : Promise.resolve([] as Trigger[])), [engine, orgId, a.id, manage]);
  const others = useLoad(() => aiOverview(engine, orgId).then((o) => o.agents.filter((x) => x.id !== a.id)), [engine, orgId, a.id]);
  const act = useAction();
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<{ url: string; secret: string } | null>(null);
  const [form, setForm] = useState({ kind: "schedule" as Trigger["kind"], label: "", brief: "", conversationId: "", every: "day", at: "09:00", weekday: 1, timeZone: LOCAL_TZ, sourceInstallId: "" });
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));
  const nameOf = (id: string) => others.data?.find((x) => x.id === id)?.displayName ?? "another agent";
  const run = (fn: () => Promise<unknown>) =>
    void act.act(async () => {
      await fn();
      list.reload();
    });
  if (!manage) return <Card title="Triggers" sub="Only people who manage AI agents see and change triggers." />;
  const create = () =>
    run(async () => {
      const t: NewTrigger = {
        kind: form.kind,
        label: form.label.trim(),
        brief: form.brief.trim(),
        conversationId: form.conversationId || null,
        config: form.kind === "schedule" ? { every: form.every, at: form.at, weekday: form.weekday, timeZone: form.timeZone } : {},
        sourceInstallId: form.kind === "after_agent" ? form.sourceInstallId || null : null,
      };
      const r = await addTrigger(engine, orgId, a.id, t);
      if (r.secret && r.hookUrl) setSecret({ url: `${window.location.origin}${r.hookUrl}`, secret: r.secret });
      setAdding(false);
      set({ label: "", brief: "" });
    });
  return (
    <>
      <Card
        title="Triggers"
        sub="Work it starts with nobody present, as you (your permissions are checked each time). They run only in continuous autonomy, inside its active hours."
        actions={
          <button className="btn btn-sm btn-primary" onClick={() => setAdding((v) => !v)}>
            <Plus size={14} /> Add a trigger
          </button>
        }
      >
        <ErrorLine text={list.error ?? act.error} />
        {a.autonomy !== "continuous" && <div className="banner">Its autonomy is {AUTONOMY_LABEL[a.autonomy].title.toLowerCase()}: triggers are kept but don't run until it's continuous.</div>}
        {secret && (
          <div className="banner warn" role="status">
            <span className="lines grow">
              <strong>Copy the webhook secret now: it isn't shown again.</strong>
              <small>
                POST {secret.url} with the header <code>Authorization: Bearer {secret.secret}</code> and a JSON body <code>{'{"text": "…"}'}</code>.
              </small>
            </span>
            <button className="btn btn-sm btn-secondary" onClick={() => setSecret(null)}>
              Done
            </button>
          </div>
        )}
        {adding && (
          <div className="card trigger-form">
            <label className="field">
              <span>When</span>
              <select value={form.kind} onChange={(e) => set({ kind: e.target.value as Trigger["kind"] })}>
                <option value="schedule">On a schedule</option>
                <option value="after_agent">When another agent finishes a request</option>
                <option value="webhook">When an outside system calls a webhook</option>
              </select>
            </label>
            {form.kind === "schedule" && (
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <label className="field">
                  <span>Every</span>
                  <select value={form.every} onChange={(e) => set({ every: e.target.value })}>
                    <option value="hour">hour</option>
                    <option value="day">day</option>
                    <option value="week">week</option>
                  </select>
                </label>
                {form.every === "week" && (
                  <label className="field">
                    <span>On</span>
                    <select value={form.weekday} onChange={(e) => set({ weekday: Number(e.target.value) })}>
                      {WEEKDAYS.map((d, i) => (
                        <option key={d} value={i}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="field">
                  <span>{form.every === "hour" ? "At minute (HH:MM)" : "At"}</span>
                  <input type="time" value={form.at} onChange={(e) => set({ at: e.target.value })} />
                </label>
                <label className="field">
                  <span>Time zone</span>
                  <input value={form.timeZone} onChange={(e) => set({ timeZone: e.target.value })} />
                </label>
              </div>
            )}
            {form.kind === "after_agent" && (
              <label className="field">
                <span>After which agent</span>
                <select value={form.sourceInstallId} onChange={(e) => set({ sourceInstallId: e.target.value })}>
                  <option value="">Choose…</option>
                  {(others.data ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.displayName}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              <span>Name</span>
              <input value={form.label} maxLength={80} placeholder="e.g. Weekly research report" onChange={(e) => set({ label: e.target.value })} />
            </label>
            <label className="field">
              <span>What it should do each time</span>
              <textarea rows={3} maxLength={4000} value={form.brief} onChange={(e) => set({ brief: e.target.value })} />
            </label>
            <label className="field">
              <span>Post the request and answers in</span>
              <select value={form.conversationId} onChange={(e) => set({ conversationId: e.target.value })}>
                <option value="">No channel (see them under Requests)</option>
                {detail.channels.map((c) => (
                  <option key={c.conversationId} value={c.conversationId}>
                    #{channelNames.get(c.conversationId) ?? c.conversationId}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn btn-primary"
              style={{ justifySelf: "start" }}
              disabled={act.busy || !form.label.trim() || !form.brief.trim() || (form.kind === "after_agent" && !form.sourceInstallId)}
              onClick={create}
            >
              Save trigger
            </button>
          </div>
        )}
        {(list.data ?? []).length === 0 ? (
          <p className="muted">No trigger yet.</p>
        ) : (
          <ul className="ws-list">
            {(list.data ?? []).map((t) => (
              <li key={t.id} className="ws-row">
                <span className="lines grow">
                  <span>
                    <strong>{t.label}</strong> <small className="faint">{describe(t, nameOf)}</small>
                  </span>
                  <small>
                    {t.enabled ? (t.nextRunAt && a.autonomy === "continuous" ? `Next: ${new Date(t.nextRunAt).toLocaleString()}` : "On") : "Off"}
                    {t.lastFiredAt ? ` · last ran ${relative(t.lastFiredAt)}` : " · hasn't run yet"}
                    {t.conversationId ? ` · posts in #${channelNames.get(t.conversationId) ?? "a channel"}` : ""}
                    {t.lastError ? ` · ${t.lastError}` : ""}
                  </small>
                </span>
                <button className="btn btn-sm btn-secondary" disabled={act.busy} onClick={() => run(() => runTrigger(engine, orgId, a.id, t.id))} title="Run its request now, as you">
                  <Play size={14} /> Run now
                </button>
                <input
                  type="checkbox"
                  aria-label={`${t.label} on`}
                  checked={t.enabled}
                  disabled={act.busy}
                  onChange={(e) => run(() => updateTrigger(engine, orgId, a.id, t.id, { rev: t.rev, enabled: e.target.checked }))}
                />
                <button className="btn btn-sm btn-secondary" aria-label={`Remove ${t.label}`} disabled={act.busy} onClick={() => run(() => removeTrigger(engine, orgId, a.id, t.id))}>
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export function LimitsStep({
  agent: a,
  manage,
  busy,
  patch,
  skillLimits,
}: {
  agent: Install;
  manage: boolean;
  busy: boolean;
  patch: Patch;
  skillLimits: { maxRuntimeSec: number; maxAttempts: number } | null;
}) {
  const [f, setF] = useState({
    maxJobsPerDay: a.maxJobsPerDay,
    maxConcurrent: a.maxConcurrent,
    maxRuntimeSec: a.maxRuntimeSec,
    maxAttempts: a.maxAttempts,
    hours: a.activeHours !== null,
    from: a.activeHours?.from ?? "09:00",
    to: a.activeHours?.to ?? "18:00",
    timeZone: a.activeHours?.timeZone ?? LOCAL_TZ,
  });
  const num = (v: string) => (v === "" ? null : Number(v));
  return (
    <Card title="Limits and recovery" sub="The server enforces these; empty means the platform's or the skill's own. Failed requests are retried with backoff, then reported where they were asked.">
      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <label className="field">
          <span>Requests per day</span>
          <input type="number" min={0} value={f.maxJobsPerDay ?? ""} placeholder="no limit" disabled={!manage} onChange={(e) => setF({ ...f, maxJobsPerDay: num(e.target.value) })} />
        </label>
        <label className="field">
          <span>At the same time</span>
          <input type="number" min={1} max={16} value={f.maxConcurrent ?? ""} placeholder="platform's" disabled={!manage} onChange={(e) => setF({ ...f, maxConcurrent: num(e.target.value) })} />
        </label>
        <label className="field">
          <span>Longest run (seconds)</span>
          <input
            type="number"
            min={10}
            max={skillLimits?.maxRuntimeSec}
            value={f.maxRuntimeSec ?? ""}
            placeholder={skillLimits ? `skill's: ${skillLimits.maxRuntimeSec}` : ""}
            disabled={!manage}
            onChange={(e) => setF({ ...f, maxRuntimeSec: num(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Tries</span>
          <input
            type="number"
            min={1}
            max={skillLimits?.maxAttempts}
            value={f.maxAttempts ?? ""}
            placeholder={skillLimits ? `skill's: ${skillLimits.maxAttempts}` : ""}
            disabled={!manage}
            onChange={(e) => setF({ ...f, maxAttempts: num(e.target.value) })}
          />
        </label>
      </div>
      <label className="row" style={{ gap: 8 }}>
        <input type="checkbox" checked={f.hours} disabled={!manage} onChange={(e) => setF({ ...f, hours: e.target.checked })} /> Triggers run only during active hours
      </label>
      {f.hours && (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <label className="field">
            <span>From</span>
            <input type="time" value={f.from} disabled={!manage} onChange={(e) => setF({ ...f, from: e.target.value })} />
          </label>
          <label className="field">
            <span>To</span>
            <input type="time" value={f.to} disabled={!manage} onChange={(e) => setF({ ...f, to: e.target.value })} />
          </label>
          <label className="field">
            <span>Time zone</span>
            <input value={f.timeZone} disabled={!manage} onChange={(e) => setF({ ...f, timeZone: e.target.value })} />
          </label>
        </div>
      )}
      {manage && (
        <button
          className="btn btn-primary"
          style={{ justifySelf: "start" }}
          disabled={busy}
          onClick={() =>
            patch(
              {
                maxJobsPerDay: f.maxJobsPerDay,
                maxConcurrent: f.maxConcurrent,
                maxRuntimeSec: f.maxRuntimeSec,
                maxAttempts: f.maxAttempts,
                activeHours: f.hours ? { from: f.from, to: f.to, timeZone: f.timeZone } : null,
              },
              "Limits saved.",
            )
          }
        >
          Save limits
        </button>
      )}
    </Card>
  );
}
