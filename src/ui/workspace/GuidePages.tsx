import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
import { Card, ErrorLine } from "../components/SettingsCard";
import { OnboardingGateCard } from "./OnboardingGateCard";
import { PARITY_FEATURES } from "../../sync/communityParity";
const MAX_ITEMS = 5;
/** Community guide (batch B8b, android GuideEditorSheet): a welcome line, up to five tasks and five resources. */
export function GuidePage({ detail }: { detail: OrgAdminDetail }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const org = useOrbit((s) => s.orgs.find((o) => o.id === detail.org.id)) ?? detail.org;
  const channels = useLoad(() => workspaceChannels(engine, org.id, false), [engine, org.id]);
  const [welcome, setWelcome] = useState(org.guide?.welcome ?? "");
  const [tasks, setTasks] = useState<GuideItemInput[]>((org.guide?.tasks ?? []).map((t) => ({ id: t.id, title: t.title, channelId: t.channelId ?? "" })));
  const [resources, setResources] = useState<GuideItemInput[]>((org.guide?.resources ?? []).map((t) => ({ id: t.id, title: t.title, channelId: t.channelId ?? "" })));
  const save = useAction();
  const options = (channels.data ?? []).filter((c) => !c.voice);
  const list = (items: GuideItemInput[], set: (x: GuideItemInput[]) => void, label: string, kind: "task" | "resource") => (
    <div style={{ display: "grid", gap: 6 }}>
      {items.map((it, i) => (
        <div key={i} className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <input
            className="input"
            style={{ flex: "2 1 200px" }}
            aria-label={uiText("auth.interface.value0_value1_54ef3bb", { value0: label, value1: i + 1 })}
            placeholder={kind === "task" ? uiText("workspace.interface.read_the_welcome_63879a5") : uiText("workspace.interface.rules_and_faq_330615d")}
            maxLength={80}
            value={it.title}
            onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
          />
          <select
            className="input"
            style={{ flex: "1 1 160px" }}
            aria-label={uiText("workspace.interface.value0_value1_channel_57f5822", { value0: label, value1: i + 1 })}
            value={it.channelId}
            onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, channelId: e.target.value } : x)))}
          >
            <option value="">
              <Localized k="workspace.interface.choose_a_channel_8630689" />
            </option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
          <button
            className="icon-btn"
            aria-label={uiText("workspace.interface.remove_value0_value1_509d5b1", { value0: label.toLowerCase(), value1: i + 1 })}
            onClick={() => set(items.filter((_, j) => j !== i))}
          >
            <Minus size={16} />
          </button>
        </div>
      ))}
      {items.length < MAX_ITEMS && (
        <button className="btn btn-secondary btn-sm" style={{ justifySelf: "start" }} onClick={() => set([...items, { title: "", channelId: "" }])}>
          <Localized k="workspace.interface.add_a_6fc20e7" slots={[<Plus size={14} />, label.toLowerCase()]} />
        </button>
      )}
    </div>
  );
  const complete = (x: GuideItemInput) => x.title.trim() && x.channelId;
  return (
    <div className="ws-page">
      <Card title={uiText("organization.interface.community_guide_0fdcaac")} sub={uiText("workspace.interface.shown_on_the_community_s_home_each_task_opens_a_channel_and_is_ti_4a61d8a")}>
        <ErrorLine text={channels.error ?? save.error} />
        <div className="field">
          <label htmlFor="g-welcome">
            <Localized k="workspace.interface.welcome_0e2226b" />
          </label>
          <textarea id="g-welcome" className="textarea" rows={3} maxLength={500} value={welcome} onChange={(e) => setWelcome(e.target.value)} />
        </div>
        <h3 className="ws-subhead">
          <Localized k="workspace.interface.get_started_tasks_71b6742" />
        </h3>
        {list(tasks, setTasks, uiText("workspace.interface.task_4bc74b2"), "task")}
        <h3 className="ws-subhead">
          <Localized k="organization.interface.resources_e89b30a" />
        </h3>
        {list(resources, setResources, uiText("workspace.interface.resource_eb7a842"), "resource")}
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
            {l10n("common.actions.save")}
          </button>
          {org.guide && (
            <button
              className="btn btn-ghost btn-sm"
              disabled={save.busy}
              onClick={() => void save.act(() => setGuide(engine, org.id, null).then(() => (setWelcome(""), setTasks([]), setResources([]))))}
            >
              <Localized k="workspace.interface.remove_the_guide_ea320ee" />
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
type EditPrompt = {
  id?: string;
  title: string;
  single: boolean;
  required: boolean;
  options: {
    id?: string;
    title: string;
    emoji: string;
    roleIds: string[];
    channelIds: string[];
  }[];
};
/**
 * Onboarding questions (batch B8b, android OnboardingEditorSheet): up to five, one answer or several, required or not;
 * an answer can give roles without administrative permissions and open public channels (the server checks both).
 */
export function OnboardingPage({ detail }: { detail: OrgAdminDetail }) {
  useLocaleRender();
  const l10n = useLocalization();
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
  const gate = useOrbit((s) => s.server?.features.includes(PARITY_FEATURES.settings) ?? false);
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
        <Card
          title={uiText("workspace.interface.my_onboarding_answers_9029e71")}
          sub={current.data.answered ? uiText("workspace.interface.you_answered_change_your_answers_any_time_12ecd88") : uiText("workspace.interface.you_haven_t_answered_yet_7899796")}
        >
          <div>
            <button className="btn btn-secondary btn-sm" onClick={() => setAnswering(true)}>
              {current.data.answered ? uiText("workspace.interface.change_my_answers_ab52de6") : uiText("calls.interface.answer_b2a3aa6")}
            </button>
          </div>
        </Card>
      )}
      {canEdit && (
        <Card title={uiText("workspace.interface.onboarding_questions_a63e4d3")} sub={uiText("workspace.interface.new_members_answer_these_when_they_join_answers_can_give_roles_wi_ca60c21")}>
          <ErrorLine text={current.error ?? save.error} />
          <div className="setting">
            <span className="lines">
              <strong>
                <Localized k="workspace.interface.ask_new_members_004ce0b" />
              </strong>
              <small>{enabled ? uiText("settings.interface.on_1300117") : uiText("messaging.interface.off_ca7981b")}</small>
            </span>
            <Toggle checked={enabled} onChange={setEnabled} label={uiText("workspace.interface.ask_new_members_004ce0b")} />
          </div>
          {prompts.map((p, i) => (
            <section key={i} className="card" style={{ padding: 12, display: "grid", gap: 8 }} aria-label={uiText("workspace.interface.question_value0_74865a9", { value0: i + 1 })}>
              <div className="row" style={{ gap: 6 }}>
                <input
                  className="input"
                  aria-label={uiText("workspace.interface.question_value0_74865a9", { value0: i + 1 })}
                  placeholder={uiText("workspace.interface.what_brings_you_here_7cdf02f")}
                  maxLength={ONBOARDING_LIMITS.title}
                  value={p.title}
                  onChange={(e) => setPrompt(i, { title: e.target.value })}
                />
                <button className="icon-btn" aria-label={uiText("workspace.interface.remove_question_value0_3cde74b", { value0: i + 1 })} onClick={() => setPrompts(prompts.filter((_, j) => j !== i))}>
                  <Minus size={16} />
                </button>
              </div>
              <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
                <label className="row" style={{ gap: 6 }}>
                  <input type="checkbox" checked={p.single} onChange={(e) => setPrompt(i, { single: e.target.checked })} />
                  <Localized k="workspace.interface.one_answer_only_97de588" />
                </label>
                <label className="row" style={{ gap: 6 }}>
                  <input type="checkbox" checked={p.required} onChange={(e) => setPrompt(i, { required: e.target.checked })} />
                  <Localized k="workspace.interface.required_4850b17" />
                </label>
              </div>
              {p.options.map((o, k) => (
                <div key={k} className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  <input
                    className="input"
                    style={{ width: 64 }}
                    aria-label={uiText("messaging.interface.emoji_61ad897")}
                    placeholder="🙂"
                    maxLength={16}
                    value={o.emoji}
                    onChange={(e) => setPrompt(i, { options: p.options.map((x, m) => (m === k ? { ...x, emoji: e.target.value } : x)) })}
                  />
                  <input
                    className="input"
                    style={{ flex: "2 1 160px" }}
                    aria-label={uiText("workspace.interface.answer_value0_08c81e7", { value0: k + 1 })}
                    placeholder={uiText("workspace.interface.painting_3c080b8")}
                    maxLength={ONBOARDING_LIMITS.title}
                    value={o.title}
                    onChange={(e) => setPrompt(i, { options: p.options.map((x, m) => (m === k ? { ...x, title: e.target.value } : x)) })}
                  />
                  <select
                    className="input"
                    style={{ flex: "1 1 140px" }}
                    aria-label={uiText("workspace.interface.gives_the_role_47dc18b")}
                    value={o.roleIds[0] ?? ""}
                    onChange={(e) => setPrompt(i, { options: p.options.map((x, m) => (m === k ? { ...x, roleIds: e.target.value ? [e.target.value] : [] } : x)) })}
                  >
                    <option value="">
                      <Localized k="workspace.interface.no_role_784a720" />
                    </option>
                    {givable.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    style={{ flex: "1 1 140px" }}
                    aria-label={uiText("workspace.interface.opens_the_channel_5df7b33")}
                    value={o.channelIds[0] ?? ""}
                    onChange={(e) => setPrompt(i, { options: p.options.map((x, m) => (m === k ? { ...x, channelIds: e.target.value ? [e.target.value] : [] } : x)) })}
                  >
                    <option value="">
                      <Localized k="workspace.interface.no_channel_cbce2b0" />
                    </option>
                    {publicChannels.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="icon-btn"
                    aria-label={uiText("workspace.interface.remove_answer_value0_32dda66", { value0: k + 1 })}
                    onClick={() => setPrompt(i, { options: p.options.filter((_, m) => m !== k) })}
                  >
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
                  <Localized k="workspace.interface.add_an_answer_aaf67b5" slots={[<Plus size={14} />]} />
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
              <Localized k="workspace.interface.add_a_question_2727c61" slots={[<Plus size={14} />]} />
            </button>
          )}
          <div>
            <button className="btn btn-primary btn-sm" disabled={save.busy} onClick={() => void save.act(() => setOnboarding(engine, orgId, enabled, clean()).then(current.reload))}>
              {l10n("common.actions.save")}
            </button>
          </div>
        </Card>
      )}
      {canEdit && gate && <OnboardingGateCard orgId={orgId} channels={channels.data ?? []} />}
      {answering && current.data && <OnboardingDialog orgId={orgId} data={current.data} onClose={() => setAnswering(false)} onDone={() => current.reload()} />}
    </div>
  );
}
