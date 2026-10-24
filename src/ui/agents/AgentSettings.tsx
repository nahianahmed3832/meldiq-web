import { ArrowLeft, ImageUp, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { agentDetail, agentTriggers, assignChannel, type Assignment, type Install, setAgentAvatar, unassignChannel, updateAgent } from "../../sync/aiWorkforce";
import { rolesOverview } from "../../sync/roles";
import { Card, ErrorLine } from "../workspace/WorkspaceView";
import { useAction, useLoad } from "../workspace/useLoad";
import { AgentAvatar, RemoveAgentDialog } from "./AgentBits";
import { AutonomyStep, LimitsStep, TriggersStep } from "./AgentAutomation";
import { ReadinessList, ReadinessPill, TestStep, useReadiness } from "./AgentHealth";

const STYLES = ["balanced", "concise", "detailed", "friendly", "formal"] as const;
const ACTIVATION: Record<Assignment["activation"], string> = { mention: "When @mentioned", command: "By /command", explicit: "Only from Ask an agent" };

/** The configuration steps, in the order an admin goes through them. */
const STEPS = [
  ["identity", "Identity"],
  ["models", "Models"],
  ["skills", "Skills"],
  ["connections", "Channels"],
  ["permissions", "Permissions"],
  ["autonomy", "Autonomy"],
  ["triggers", "Triggers"],
  ["limits", "Limits"],
  ["test", "Test & activate"],
] as const;
type Step = (typeof STEPS)[number][0];

/**
 * Configure one installed agent (server docs/AI_WORKFORCE.md §3, §5b), step by step: its identity here, the verified
 * models it runs on, its skill and tools, channels, permissions, autonomy, triggers, limits, then a real test and its
 * readiness. Only this community's copy changes; the platform's definition and other communities' copies don't.
 */
export function AgentSettings({ orgId, installId, onBack, onChanged }: { orgId: string; installId: string; onBack: () => void; onChanged: () => void }) {
  const engine = useEngine();
  const loaded = useLoad(() => agentDetail(engine, orgId, installId), [engine, orgId, installId]);
  const readiness = useReadiness(orgId, installId);
  const roles = useLoad(() => rolesOverview(engine, orgId).catch(() => null), [engine, orgId]);
  const triggers = useLoad(() => agentTriggers(engine, orgId, installId).catch(() => []), [engine, orgId, installId]);
  const channels = useOrbit(
    (s) =>
      Object.values(s.conversations)
        .filter((c) => c.orgId === orgId && c.type === "CHANNEL" && !c.archived && !c.voice)
        .map((c) => ({ id: c.id, name: c.name ?? c.id })),
    shallowEqual,
  );
  const act = useAction();
  const [step, setStep] = useState<Step>("identity");
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
      });
  }, [d]);
  if (!d) return <div className="ws-page">{loaded.error ? <ErrorLine text={loaded.error} /> : <div className="skeleton" style={{ height: 200 }} aria-busy="true" />}</div>;
  const a = d.agent;
  const manage = d.permissions.canManage;
  const run = (fn: () => Promise<unknown>, message?: string) =>
    void act.act(async () => {
      await fn();
      loaded.reload();
      readiness.reload();
      triggers.reload();
      onChanged();
      if (message) setSaved(message);
    });
  const patch = (p: Record<string, unknown>, message = "Saved.") => run(() => updateAgent(engine, orgId, a.id, { rev: a.rev, ...p }), message);
  const set = <K extends keyof Install>(k: K, v: Install[K]) => setForm((f) => ({ ...f, [k]: v }));
  const assigned = new Map(d.channels.map((c) => [c.conversationId, c]));
  const channelNames = new Map(channels.map((c) => [c.id, c.name]));
  const limits = d.definition?.skill.limits;
  const skillLimits = limits && typeof limits.maxRuntimeSec === "number" && typeof limits.maxAttempts === "number" ? { maxRuntimeSec: limits.maxRuntimeSec, maxAttempts: limits.maxAttempts } : null;

  return (
    <div className="ws-page">
      <button className="btn btn-secondary btn-sm" style={{ justifySelf: "start" }} onClick={onBack}>
        <ArrowLeft size={14} /> AI agents
      </button>
      <div className="row agent-config-head" style={{ gap: 12 }}>
        <AgentAvatar orgId={orgId} installId={a.id} name={a.displayName} color={a.avatarColor} hasAvatar={!!a.avatar} size={40} />
        <span className="lines grow">
          <strong>Configure {a.displayName}</strong>
          <small className="faint">
            {d.definition?.name ?? a.agentId} · skill {a.skill?.id ?? "?"} v{a.version} · {a.state === "active" ? "on" : "off"}
          </small>
        </span>
        <ReadinessPill r={readiness.data ?? null} />
      </div>
      <span className="segmented agent-steps" role="tablist" aria-label="Configure agent">
        {STEPS.map(([k, label], i) => (
          <button key={k} role="tab" aria-selected={step === k} aria-pressed={step === k} onClick={() => setStep(k)}>
            {i + 1}. {label}
          </button>
        ))}
      </span>
      <ErrorLine text={act.error} />
      {saved && !act.error && (
        <div className="banner info" role="status">
          {saved}
        </div>
      )}

      {step === "identity" && (
        <Card title={a.displayName} sub={`Its name and voice in this community. The catalog's ${d.definition?.name ?? a.agentId} stays as it is.`}>
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
          {manage && (
            <button className="btn btn-primary" style={{ justifySelf: "start" }} disabled={act.busy} onClick={() => patch(form)}>
              Save
            </button>
          )}
        </Card>
      )}

      {step === "models" && (
        <Card
          title="AI models"
          sub="It runs on the platform's shared models, routed automatically to a model that passed a real verification request. Platform operators approve and verify models in the AI Control Center; keys are never shown here."
        >
          {readiness.data ? <ReadinessList r={readiness.data} only={["model.", "ai", "platform", "paused"]} /> : <div className="skeleton" style={{ height: 80 }} aria-busy="true" />}
        </Card>
      )}

      {step === "skills" && d.definition && (
        <Card title={`Skill: ${d.definition.skill.id} v${d.definition.skill.version}`} sub={d.definition.description}>
          <ul className="agent-caps">
            {d.definition.capabilities.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="faint" style={{ margin: 0 }}>
            Takes {d.definition.skill.files.min ? `at least ${d.definition.skill.files.min} and ` : ""}up to {d.definition.skill.files.max} files (
            {d.definition.skill.files.types.slice(0, 5).join(", ")}
            {d.definition.skill.files.types.length > 5 ? "…" : ""}). Its options are set per request in the Ask form, checked against its schema.
          </p>
          <h4 className="ws-subhead">What it needs</h4>
          {readiness.data && <ReadinessList r={readiness.data} only={["tool.", "media", "version", "state"]} />}
          {d.definition.skill.approvals.length > 0 && (
            <>
              <h4 className="ws-subhead">Approvals</h4>
              <ul className="agent-caps">
                {d.definition.skill.approvals.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </>
          )}
          {d.definition.skill.errors.length > 0 && (
            <>
              <h4 className="ws-subhead">When something's missing or fails</h4>
              <ul className="agent-caps">
                {d.definition.skill.errors.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      {step === "connections" && (
        <>
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
          <Card title="Outside services" sub="Connections to accounts outside Meldiq. Nothing is shown as working unless it's connected and verified.">
            {(d.definition?.integrations ?? []).length === 0 ? (
              <p className="muted">This agent doesn't use outside services.</p>
            ) : (
              <ul className="ws-list">
                {(d.definition?.integrations ?? []).map((i) => (
                  <li key={i.tool} className="ws-row">
                    <span className="lines grow">
                      <span>{i.label}</span>
                      <small>Not available on this platform yet: it prepares drafts for a person to use instead.</small>
                    </span>
                    <span className="status-pill muted">Not connected</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {step === "permissions" && (
        <>
          <Card title="What it may do" sub="Least privilege: only what's ticked. The platform sets the ceiling, and every use is checked again on the server.">
            <ul className="ws-list">
              <li className="ws-row">
                <span className="lines grow">
                  <span>Read channel messages and history</span>
                  <small>Not possible: messages are end-to-end encrypted. It sees only what people send it, and messages someone chooses to share with a request.</small>
                </span>
                <span className="status-pill muted">Never</span>
              </li>
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
          <Card title="Who may ask it" sub="Members need the 'Ask AI agents' permission, and one of these roles when roles are chosen.">
            <label className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={a.invokers.everyone} disabled={!manage || act.busy} onChange={(e) => patch({ invokers: { everyone: e.target.checked, roles: a.invokers.roles } })} />{" "}
              Everyone who may use AI agents
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
        </>
      )}

      {step === "autonomy" && <AutonomyStep agent={a} manage={manage} busy={act.busy} patch={patch} triggers={(triggers.data ?? []).filter((t) => t.enabled).length} />}
      {step === "triggers" && <TriggersStep orgId={orgId} detail={d} manage={manage} channelNames={channelNames} />}
      {step === "limits" && <LimitsStep key={a.rev} agent={a} manage={manage} busy={act.busy} patch={patch} skillLimits={skillLimits} />}

      {step === "test" && (
        <>
          <TestStep orgId={orgId} installId={a.id} canManage={manage} canApprove={d.permissions.canApprove} readiness={readiness} />
          {manage && (
            <Card title="Activate">
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
                  onClick={() =>
                    patch({ state: a.state === "active" ? "disabled" : "active" }, a.state === "active" ? "Turned off: its requests in progress were cancelled and its triggers stop." : "Turned on.")
                  }
                >
                  {a.state === "active" ? "Turn off" : "Turn on"}
                </button>
                <button className="btn btn-danger" disabled={act.busy} onClick={() => setRemoving(true)}>
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            </Card>
          )}
        </>
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
