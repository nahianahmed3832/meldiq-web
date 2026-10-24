import { ArrowLeft, ImageUp, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { agentDetail, assignChannel, type Assignment, type Install, setAgentAvatar, unassignChannel, updateAgent } from "../../sync/aiWorkforce";
import { rolesOverview } from "../../sync/roles";
import { Card, ErrorLine } from "../workspace/WorkspaceView";
import { useAction, useLoad } from "../workspace/useLoad";
import { AgentAvatar, RemoveAgentDialog } from "./AgentBits";

const STYLES = ["balanced", "concise", "detailed", "friendly", "formal"] as const;
const ACTIVATION: Record<Assignment["activation"], string> = { mention: "When @mentioned", command: "By /command", explicit: "Only from Ask an agent" };

/**
 * One installed agent's settings (server docs/AI_WORKFORCE.md §3): its identity in this community, how it works, the
 * tools it may use within the platform's policy, its channels, who may ask it, and its limits. Only this community's
 * copy changes; the platform's definition and other communities' copies don't.
 */
export function AgentSettings({ orgId, installId, onBack, onChanged }: { orgId: string; installId: string; onBack: () => void; onChanged: () => void }) {
  const engine = useEngine();
  const loaded = useLoad(() => agentDetail(engine, orgId, installId), [engine, orgId, installId]);
  const roles = useLoad(() => rolesOverview(engine, orgId).catch(() => null), [engine, orgId]);
  const channels = useOrbit(
    (s) =>
      Object.values(s.conversations)
        .filter((c) => c.orgId === orgId && c.type === "CHANNEL" && !c.archived && !c.voice)
        .map((c) => ({ id: c.id, name: c.name ?? c.id })),
    shallowEqual,
  );
  const act = useAction();
  const [form, setForm] = useState<Partial<Install>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const d = loaded.data;
  useEffect(() => {
    if (d)
      setForm({
        displayName: d.agent.displayName,
        description: d.agent.description,
        roleTitle: d.agent.roleTitle,
        language: d.agent.language,
        style: d.agent.style,
        instructions: d.agent.instructions,
        executionMode: d.agent.executionMode,
        maxJobsPerDay: d.agent.maxJobsPerDay,
        maxConcurrent: d.agent.maxConcurrent,
      });
  }, [d]);
  if (!d) return <div className="ws-page">{loaded.error ? <ErrorLine text={loaded.error} /> : <div className="skeleton" style={{ height: 200 }} aria-busy="true" />}</div>;
  const a = d.agent;
  const manage = d.permissions.canManage;
  const run = (fn: () => Promise<unknown>, message?: string) =>
    void act.act(async () => {
      await fn();
      loaded.reload();
      onChanged();
      if (message) setSaved(message);
    });
  const patch = (p: Record<string, unknown>, message = "Saved.") => run(() => updateAgent(engine, orgId, a.id, { rev: a.rev, ...p }), message);
  const set = <K extends keyof Install>(k: K, v: Install[K]) => setForm((f) => ({ ...f, [k]: v }));
  const assigned = new Map(d.channels.map((c) => [c.conversationId, c]));
  return (
    <div className="ws-page">
      <button className="btn btn-secondary btn-sm" style={{ justifySelf: "start" }} onClick={onBack}>
        <ArrowLeft size={14} /> AI agents
      </button>
      <ErrorLine text={act.error} />
      {saved && !act.error && (
        <div className="banner info" role="status">
          {saved}
        </div>
      )}
      <Card title={a.displayName} sub={`${d.definition?.name ?? a.agentId} · skill ${a.skill?.id ?? "?"} v${a.version}${a.state === "disabled" ? " · off" : ""}`}>
        <div className="row" style={{ gap: 12 }}>
          <AgentAvatar orgId={orgId} installId={a.id} name={a.displayName} color={a.avatarColor} hasAvatar={!!a.avatar} size={56} />
          {manage && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => picker.current?.click()}>
                <ImageUp size={14} /> Change avatar
              </button>
              <input
                ref={picker}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) run(async () => setAgentAvatar(engine, orgId, a.id, new Uint8Array(await f.arrayBuffer())), "Avatar changed.");
                }}
              />
              <input type="color" aria-label="Colour" value={a.avatarColor ?? "#5B5BD6"} onChange={(e) => patch({ avatarColor: e.target.value })} />
            </>
          )}
        </div>
        {d.setup && !d.setup.ready && <div className="banner warn">It can't do all of its work yet: {d.setup.missing.join(" ")}</div>}
        <label className="field">
          <span>Name (always shown with "AI")</span>
          <input value={form.displayName ?? ""} maxLength={40} disabled={!manage} onChange={(e) => set("displayName", e.target.value)} />
        </label>
        <label className="field">
          <span>Role</span>
          <input value={form.roleTitle ?? ""} maxLength={60} disabled={!manage} onChange={(e) => set("roleTitle", e.target.value)} />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea rows={2} value={form.description ?? ""} maxLength={500} disabled={!manage} onChange={(e) => set("description", e.target.value)} />
        </label>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <label className="field">
            <span>Answers in</span>
            <input value={form.language ?? ""} placeholder="the request's language" maxLength={10} disabled={!manage} onChange={(e) => set("language", e.target.value || null)} />
          </label>
          <label className="field">
            <span>Style</span>
            <select value={form.style ?? "balanced"} disabled={!manage} onChange={(e) => set("style", e.target.value)}>
              {STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Instructions from this community</span>
          <textarea
            rows={3}
            value={form.instructions ?? ""}
            maxLength={2000}
            disabled={!manage}
            placeholder="e.g. Use our brand name Acme. Keep posts upbeat."
            onChange={(e) => set("instructions", e.target.value)}
          />
          <small className="faint">They shape how it writes. They can't give it powers or change its rules.</small>
        </label>
        <div className="field">
          <span>Review</span>
          <span className="segmented" role="group" aria-label="Review">
            <button aria-pressed={form.executionMode === "review"} disabled={!manage} onClick={() => set("executionMode", "review")}>
              People approve results
            </button>
            <button aria-pressed={form.executionMode === "auto"} disabled={!manage} onClick={() => set("executionMode", "auto")}>
              Finish without review
            </button>
          </span>
          {a.effectiveMode !== form.executionMode && <small className="warn-text">The platform requires review for now.</small>}
          <small className="faint">Actions outside Meldiq always need approval, whatever is chosen here.</small>
        </div>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <label className="field">
            <span>Requests per day</span>
            <input
              type="number"
              min={0}
              value={form.maxJobsPerDay ?? ""}
              placeholder="no limit"
              disabled={!manage}
              onChange={(e) => set("maxJobsPerDay", e.target.value === "" ? null : Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>At the same time</span>
            <input
              type="number"
              min={1}
              max={16}
              value={form.maxConcurrent ?? ""}
              placeholder="platform's"
              disabled={!manage}
              onChange={(e) => set("maxConcurrent", e.target.value === "" ? null : Number(e.target.value))}
            />
          </label>
        </div>
        {manage && (
          <button className="btn btn-primary" style={{ justifySelf: "start" }} disabled={act.busy} onClick={() => patch(form)}>
            Save
          </button>
        )}
      </Card>

      <Card title="Tools" sub="What it may do. The platform sets the ceiling; outside services have no connection yet.">
        <ul className="ws-list">
          {d.tools.map((t) => (
            <li key={t.key} className="ws-row">
              <span className="lines grow">
                <span>
                  {t.label} {t.required && <small className="faint">(needed)</small>}
                </span>
                <small>
                  {t.description}
                  {!t.connected && " · Not connected: it prepares drafts instead."}
                  {t.platformMode === "approval" && " · Needs approval each time."}
                </small>
              </span>
              <input
                type="checkbox"
                aria-label={t.label}
                checked={t.granted}
                disabled={!manage || act.busy || (t.required && t.granted)}
                onChange={(e) => patch({ tools: e.target.checked ? [...a.tools, t.key] : a.tools.filter((x) => x !== t.key) })}
              />
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Channels" sub="It works only in the channels chosen here, and sees only what people send it there.">
        <ul className="ws-list">
          {channels.length === 0 && <li className="muted">No channel of this community is open in this browser.</li>}
          {channels.map((c) => {
            const on = assigned.get(c.id);
            return (
              <li key={c.id} className="ws-row">
                <span className="grow"># {c.name}</span>
                {on && (
                  <select
                    aria-label={`How ${a.displayName} is asked in #${c.name}`}
                    value={on.activation}
                    disabled={!manage || act.busy}
                    onChange={(e) => run(() => assignChannel(engine, orgId, a.id, c.id, e.target.value as Assignment["activation"]))}
                  >
                    {Object.entries(ACTIVATION).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="checkbox"
                  aria-label={`In #${c.name}`}
                  checked={!!on}
                  disabled={!manage || act.busy}
                  onChange={(e) => run(() => (e.target.checked ? assignChannel(engine, orgId, a.id, c.id, "mention") : unassignChannel(engine, orgId, a.id, c.id)))}
                />
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Who may ask it" sub="Members need the 'Ask AI agents' permission, and one of these roles when roles are chosen.">
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={a.invokers.everyone} disabled={!manage || act.busy} onChange={(e) => patch({ invokers: { everyone: e.target.checked, roles: a.invokers.roles } })} /> Everyone
          who may use AI agents
        </label>
        {!a.invokers.everyone && (
          <ul className="ws-list">
            {(roles.data?.roles ?? []).map((r) => (
              <li key={r.id} className="ws-row">
                <span className="grow">{r.name}</span>
                <input
                  type="checkbox"
                  aria-label={r.name}
                  checked={a.invokers.roles.includes(r.id)}
                  disabled={!manage || act.busy}
                  onChange={(e) => patch({ invokers: { everyone: false, roles: e.target.checked ? [...a.invokers.roles, r.id] : a.invokers.roles.filter((x) => x !== r.id) } })}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {manage && (
        <Card title="Manage">
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {d.upgrade && (
              <button
                className="btn btn-secondary"
                disabled={act.busy}
                onClick={() => patch({ upgradeTo: d.upgrade!.version }, `Updated to version ${d.upgrade!.version}. Its name, avatar and channels stay.`)}
              >
                Update to version {d.upgrade.version}
              </button>
            )}
            <button
              className="btn btn-secondary"
              disabled={act.busy}
              onClick={() => patch({ state: a.state === "active" ? "disabled" : "active" }, a.state === "active" ? "Turned off: its requests in progress were cancelled." : "Turned on.")}
            >
              {a.state === "active" ? "Turn off" : "Turn on"}
            </button>
            <button className="btn btn-danger" disabled={act.busy} onClick={() => setRemoving(true)}>
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </Card>
      )}
      {removing && (
        <RemoveAgentDialog
          orgId={orgId}
          agent={a}
          onClose={() => setRemoving(false)}
          onRemoved={() => {
            onChanged();
            onBack();
          }}
        />
      )}
    </div>
  );
}
