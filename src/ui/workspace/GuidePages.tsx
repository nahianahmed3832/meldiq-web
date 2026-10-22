import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { type GuideItemInput, ONBOARDING_LIMITS, onboarding, type OnboardingPromptInput, setGuide, setOnboarding } from "../../sync/guide";
import { rolesOverview } from "../../sync/roles";
import { workspaceChannels } from "../../sync/workspaces";
import { Toggle } from "../components/Toggle";
import { OnboardingDialog } from "../community/GuideOnboarding";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

const MAX_ITEMS = 5;

/** Community guide (batch B8b, android GuideEditorSheet): a welcome line, up to five tasks and five resources. */
export function GuidePage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const org = useOrbit((s) => s.orgs.find((o) => o.id === detail.org.id)) ?? detail.org;
  const channels = useLoad(() => workspaceChannels(engine, org.id, false), [engine, org.id]);
  const [welcome, setWelcome] = useState(org.guide?.welcome ?? "");
  const [tasks, setTasks] = useState<GuideItemInput[]>((org.guide?.tasks ?? []).map((t) => ({ id: t.id, title: t.title, channelId: t.channelId ?? "" })));
  const [resources, setResources] = useState<GuideItemInput[]>((org.guide?.resources ?? []).map((t) => ({ id: t.id, title: t.title, channelId: t.channelId ?? "" })));
  const save = useAction();
  const options = (channels.data ?? []).filter((c) => !c.voice);
  const list = (items: GuideItemInput[], set: (x: GuideItemInput[]) => void, label: string) => (
    <div style={{ display: "grid", gap: 6 }}>
      {items.map((it, i) => (
        <div key={i} className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <input
            className="input"
            style={{ flex: "2 1 200px" }}
            aria-label={`${label} ${i + 1}`}
            placeholder={label === "Task" ? "Read the welcome" : "Rules and FAQ"}
            maxLength={80}
            value={it.title}
            onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
          />
          <select
            className="input"
            style={{ flex: "1 1 160px" }}
            aria-label={`${label} ${i + 1} channel`}
            value={it.channelId}
            onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, channelId: e.target.value } : x)))}
          >
            <option value="">Choose a channel</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
          <button className="icon-btn" aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => set(items.filter((_, j) => j !== i))}>
            <Minus size={16} />
          </button>
        </div>
      ))}
      {items.length < MAX_ITEMS && (
        <button className="btn btn-secondary btn-sm" style={{ justifySelf: "start" }} onClick={() => set([...items, { title: "", channelId: "" }])}>
          <Plus size={14} /> Add a {label.toLowerCase()}
        </button>
      )}
    </div>
  );
  const complete = (x: GuideItemInput) => x.title.trim() && x.channelId;
  return (
    <div className="ws-page">
      <Card title="Community guide" sub="Shown on the community's home. Each task opens a channel and is ticked once someone opens it, on their own device.">
        <ErrorLine text={channels.error ?? save.error} />
        <div className="field">
          <label htmlFor="g-welcome">Welcome</label>
          <textarea id="g-welcome" className="textarea" rows={3} maxLength={500} value={welcome} onChange={(e) => setWelcome(e.target.value)} />
        </div>
        <h3 className="ws-subhead">Get started tasks</h3>
        {list(tasks, setTasks, "Task")}
        <h3 className="ws-subhead">Resources</h3>
        {list(resources, setResources, "Resource")}
        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn btn-primary btn-sm"
            disabled={save.busy}
            onClick={() =>
              void save.act(() =>
                setGuide(engine, org.id, {
                  welcome: welcome.trim() || null,
                  tasks: tasks.filter(complete).map((t) => ({ ...t, title: t.title.trim() })),
                  resources: resources.filter(complete).map((t) => ({ ...t, title: t.title.trim() })),
                }),
              )
            }
          >
            Save
          </button>
          {org.guide && (
            <button
              className="btn btn-ghost btn-sm"
              disabled={save.busy}
              onClick={() => void save.act(() => setGuide(engine, org.id, null).then(() => (setWelcome(""), setTasks([]), setResources([]))))}
            >
              Remove the guide
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

type EditPrompt = { id?: string; title: string; single: boolean; required: boolean; options: { id?: string; title: string; emoji: string; roleIds: string[]; channelIds: string[] }[] };

/**
 * Onboarding questions (batch B8b, android OnboardingEditorSheet): up to five, one answer or several, required or not;
 * an answer can give roles without administrative permissions and open public channels (the server checks both).
 */
export function OnboardingPage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const canEdit = detail.permissions.isOwner || detail.permissions.effective.includes("workspace.edit");
  const current = useLoad(() => onboarding(engine, orgId), [engine, orgId]);
  const roles = useLoad(() => (canEdit ? rolesOverview(engine, orgId) : Promise.resolve(null)), [engine, orgId, canEdit]);
  const channels = useLoad(() => (canEdit ? workspaceChannels(engine, orgId, false) : Promise.resolve([])), [engine, orgId, canEdit]);
  const [enabled, setEnabled] = useState(false);
  const [prompts, setPrompts] = useState<EditPrompt[]>([]);
  const [answering, setAnswering] = useState(false);
  const save = useAction();
  useEffect(() => {
    if (!current.data) return;
    setEnabled(current.data.enabled);
    setPrompts(current.data.prompts.map((p) => ({ ...p, options: p.options.map((o) => ({ ...o, emoji: o.emoji ?? "" })) })));
  }, [current.data]);
  const publicChannels = (channels.data ?? []).filter((c) => c.kind === "PUBLIC");
  const givable = (roles.data?.roles ?? []).filter((r) => !r.archived);
  const setPrompt = (i: number, p: Partial<EditPrompt>) => setPrompts(prompts.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const clean = (): OnboardingPromptInput[] =>
    prompts
      .filter((p) => p.title.trim() && p.options.some((o) => o.title.trim()))
      .map((p) => ({
        ...(p.id ? { id: p.id } : {}),
        title: p.title.trim(),
        single: p.single,
        required: p.required,
        options: p.options
          .filter((o) => o.title.trim())
          .map((o) => ({ ...(o.id ? { id: o.id } : {}), title: o.title.trim(), emoji: o.emoji.trim() || null, roleIds: o.roleIds, channelIds: o.channelIds })),
      }));
  return (
    <div className="ws-page">
      {current.data?.enabled && detail.org.myRole !== "GUEST" && (
        <Card title="My onboarding answers" sub={current.data.answered ? "You answered. Change your answers any time." : "You haven't answered yet."}>
          <div>
            <button className="btn btn-secondary btn-sm" onClick={() => setAnswering(true)}>
              {current.data.answered ? "Change my answers" : "Answer"}
            </button>
          </div>
        </Card>
      )}
      {canEdit && (
        <Card title="Onboarding questions" sub="New members answer these when they join. Answers can give roles without administrative permissions and open public channels.">
          <ErrorLine text={current.error ?? save.error} />
          <div className="setting">
            <span className="lines">
              <strong>Ask new members</strong>
              <small>{enabled ? "On" : "Off"}</small>
            </span>
            <Toggle checked={enabled} onChange={setEnabled} label="Ask new members" />
          </div>
          {prompts.map((p, i) => (
            <section key={i} className="card" style={{ padding: 12, display: "grid", gap: 8 }} aria-label={`Question ${i + 1}`}>
              <div className="row" style={{ gap: 6 }}>
                <input
                  className="input"
                  aria-label={`Question ${i + 1}`}
                  placeholder="What brings you here?"
                  maxLength={ONBOARDING_LIMITS.title}
                  value={p.title}
                  onChange={(e) => setPrompt(i, { title: e.target.value })}
                />
                <button className="icon-btn" aria-label={`Remove question ${i + 1}`} onClick={() => setPrompts(prompts.filter((_, j) => j !== i))}>
                  <Minus size={16} />
                </button>
              </div>
              <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
                <label className="row" style={{ gap: 6 }}>
                  <input type="checkbox" checked={p.single} onChange={(e) => setPrompt(i, { single: e.target.checked })} /> One answer only
                </label>
                <label className="row" style={{ gap: 6 }}>
                  <input type="checkbox" checked={p.required} onChange={(e) => setPrompt(i, { required: e.target.checked })} /> Required
                </label>
              </div>
              {p.options.map((o, k) => (
                <div key={k} className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  <input
                    className="input"
                    style={{ width: 64 }}
                    aria-label="Emoji"
                    placeholder="🙂"
                    maxLength={16}
                    value={o.emoji}
                    onChange={(e) => setPrompt(i, { options: p.options.map((x, m) => (m === k ? { ...x, emoji: e.target.value } : x)) })}
                  />
                  <input
                    className="input"
                    style={{ flex: "2 1 160px" }}
                    aria-label={`Answer ${k + 1}`}
                    placeholder="Painting"
                    maxLength={ONBOARDING_LIMITS.title}
                    value={o.title}
                    onChange={(e) => setPrompt(i, { options: p.options.map((x, m) => (m === k ? { ...x, title: e.target.value } : x)) })}
                  />
                  <select
                    className="input"
                    style={{ flex: "1 1 140px" }}
                    aria-label="Gives the role"
                    value={o.roleIds[0] ?? ""}
                    onChange={(e) => setPrompt(i, { options: p.options.map((x, m) => (m === k ? { ...x, roleIds: e.target.value ? [e.target.value] : [] } : x)) })}
                  >
                    <option value="">No role</option>
                    {givable.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    style={{ flex: "1 1 140px" }}
                    aria-label="Opens the channel"
                    value={o.channelIds[0] ?? ""}
                    onChange={(e) => setPrompt(i, { options: p.options.map((x, m) => (m === k ? { ...x, channelIds: e.target.value ? [e.target.value] : [] } : x)) })}
                  >
                    <option value="">No channel</option>
                    {publicChannels.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.name}
                      </option>
                    ))}
                  </select>
                  <button className="icon-btn" aria-label={`Remove answer ${k + 1}`} onClick={() => setPrompt(i, { options: p.options.filter((_, m) => m !== k) })}>
                    <Minus size={16} />
                  </button>
                </div>
              ))}
              {p.options.length < ONBOARDING_LIMITS.options && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ justifySelf: "start" }}
                  onClick={() => setPrompt(i, { options: [...p.options, { title: "", emoji: "", roleIds: [], channelIds: [] }] })}
                >
                  <Plus size={14} /> Add an answer
                </button>
              )}
            </section>
          ))}
          {prompts.length < ONBOARDING_LIMITS.prompts && (
            <button
              className="btn btn-secondary btn-sm"
              style={{ justifySelf: "start" }}
              onClick={() => setPrompts([...prompts, { title: "", single: true, required: false, options: [{ title: "", emoji: "", roleIds: [], channelIds: [] }] }])}
            >
              <Plus size={14} /> Add a question
            </button>
          )}
          <div>
            <button className="btn btn-primary btn-sm" disabled={save.busy} onClick={() => void save.act(() => setOnboarding(engine, orgId, enabled, clean()).then(current.reload))}>
              Save
            </button>
          </div>
        </Card>
      )}
      {answering && current.data && <OnboardingDialog orgId={orgId} data={current.data} onClose={() => setAnswering(false)} onDone={() => current.reload()} />}
    </div>
  );
}
