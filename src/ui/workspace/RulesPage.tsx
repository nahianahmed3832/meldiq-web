import { Localized } from "../../i18n/Localized";
import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { ArrowDown, ArrowUp, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../application/orbit";
import { useT } from "../../i18n";
import { communityRules, moveRule, type RuleDraft, RULES_LIMITS, rulesProblem, saveCommunityRules } from "../../sync/rulesChannel";
import { workspaceChannels } from "../../sync/workspaces";
import { Toggle } from "../components/Toggle";
import { CreateChannelDialog } from "../community/CreateChannelDialog";
import { RulesList } from "../community/RulesViews";
import { useAction, useLoad } from "./useLoad";
import { useUnsavedChanges } from "../components/UnsavedChanges";
import { Card, ErrorLine } from "../components/SettingsCard";
/**
 * Community settings › Rules (API 0.65.0, feature rules-channel): which channel is the rules channel, the numbered rules
 * with a title and an optional description, and whether members agree to them before posting or reacting. People who
 * can edit the community change them; the server checks again.
 */
export function RulesPage({ detail }: { detail: OrgAdminDetail }) {
  useLocaleRender();
  const engine = useEngine();
  const t = useT();
  const orgId = detail.org.id;
  const current = useLoad(() => communityRules(engine, orgId), [engine, orgId]);
  const channels = useLoad(() => workspaceChannels(engine, orgId, false), [engine, orgId]);
  const [channelId, setChannelId] = useState<string>("");
  const [required, setRequired] = useState(false);
  const [rules, setRules] = useState<RuleDraft[]>([]);
  const [saved, setSaved] = useState(false);
  const [creating, setCreating] = useState(false);
  const baseline = useRef("");
  const save = useAction();
  useEffect(() => {
    if (!current.data) return;
    baseline.current = JSON.stringify({
      channelId: current.data.channelId,
      required: current.data.required,
      rules: current.data.rules.map((r) => ({ id: r.id, title: r.title, description: r.description ?? "" })),
    });
    setChannelId(current.data.channelId ?? "");
    setRequired(current.data.required);
    setRules(current.data.rules.map((r) => ({ id: r.id, title: r.title, description: r.description ?? "" })));
  }, [current.data]);
  // A rules channel is a text or announcement channel everyone can see (the server says the same).
  const options = (channels.data ?? []).filter((c) => !c.voice && c.format !== "forum" && c.kind !== "PRIVATE");
  const settings = { channelId: channelId || null, required, rules };
  useUnsavedChanges(!!baseline.current && baseline.current !== JSON.stringify(settings));
  const problem = rulesProblem(settings);
  const edit = (i: number, change: Partial<RuleDraft>) => {
    setSaved(false);
    setRules(rules.map((r, j) => (j === i ? { ...r, ...change } : r)));
  };
  const preview = rules.filter((r) => r.title.trim()).map((r, i) => ({ id: r.id ?? `new-${i}`, title: r.title.trim(), description: r.description.trim() || null }));
  return (
    <div className="ws-page">
      {creating && (
        <CreateChannelDialog
          orgId={orgId}
          initialType="rules"
          categories={detail.categories}
          categoryId={null}
          canCreateTop={detail.permissions.canCreateChannels}
          onClose={() => {
            setCreating(false);
            current.reload();
            channels.reload();
          }}
        />
      )}
      <Card title={t("rules_title")} sub={t("rules_settings_sub")}>
        <ErrorLine text={current.error ?? channels.error ?? save.error} />
        <div className="field">
          <label htmlFor="rules-channel">{t("rules_channel_label")}</label>
          <select
            id="rules-channel"
            className="input"
            value={channelId}
            onChange={(e) => {
              setSaved(false);
              setChannelId(e.target.value);
            }}
          >
            <option value="">{t("rules_settings_no_channel")}</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
          <p className="hint">{t("rules_settings_channel_hint")}</p>
          {current.data && !current.data.channelId && detail.permissions.canCreateChannels && (
            <button className="btn btn-secondary btn-sm" onClick={() => setCreating(true)}>
              <Localized k="workspace.interface.create_rules_channel_5e0fe29" slots={[<Plus size={14} />]} />
            </button>
          )}
        </div>

        <h3 className="ws-subhead">{t("rules_title")}</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {rules.map((r, i) => (
            <div key={r.id ?? `new-${i}`} className="rules-editor-row">
              <span className="rules-num" aria-hidden>
                {formatUiNumber(i + 1)}
              </span>
              <div className="lines">
                <input
                  className="input"
                  aria-label={t("rules_settings_rule", { n: i + 1 })}
                  placeholder={t("rules_settings_title_ph")}
                  maxLength={RULES_LIMITS.title}
                  value={r.title}
                  onChange={(e) => edit(i, { title: e.target.value })}
                />
                <textarea
                  className="textarea"
                  rows={2}
                  aria-label={uiText("billing.interface.value0_value1_6a77681", { value0: t("rules_settings_rule", { n: i + 1 }), value1: t("rules_settings_desc_ph") })}
                  placeholder={t("rules_settings_desc_ph")}
                  maxLength={RULES_LIMITS.description}
                  value={r.description}
                  onChange={(e) => edit(i, { description: e.target.value })}
                />
              </div>
              <div className="row" style={{ gap: 2 }}>
                <button className="icon-btn" aria-label={t("rules_settings_up", { n: i + 1 })} disabled={i === 0} onClick={() => setRules(moveRule(rules, i, -1))}>
                  <ArrowUp size={16} />
                </button>
                <button className="icon-btn" aria-label={t("rules_settings_down", { n: i + 1 })} disabled={i === rules.length - 1} onClick={() => setRules(moveRule(rules, i, 1))}>
                  <ArrowDown size={16} />
                </button>
                <button className="icon-btn" aria-label={t("rules_settings_remove", { n: i + 1 })} onClick={() => setRules(rules.filter((_, j) => j !== i))}>
                  <Minus size={16} />
                </button>
              </div>
            </div>
          ))}
          {rules.length < RULES_LIMITS.rules && (
            <button className="btn btn-secondary btn-sm" style={{ justifySelf: "start" }} onClick={() => setRules([...rules, { title: "", description: "" }])}>
              <Plus size={14} /> {t("rules_settings_add")}
            </button>
          )}
        </div>

        <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
          <Toggle checked={required} onChange={(v) => (setSaved(false), setRequired(v))} label={t("rules_settings_require")} />
          <div className="lines">
            <strong>{t("rules_settings_require")}</strong>
            <span className="hint">{t("rules_settings_require_hint")}</span>
          </div>
        </div>

        {problem && <p className="hint danger-text">{problem}</p>}
        <div className="row" style={{ gap: 8 }}>
          <button
            className="btn btn-primary btn-sm"
            disabled={save.busy || !!problem || !current.data}
            onClick={() =>
              void save.act(async () => {
                const view = await saveCommunityRules(engine, orgId, settings);
                baseline.current = JSON.stringify({
                  channelId: view.channelId,
                  required: view.required,
                  rules: view.rules.map((r) => ({ id: r.id, title: r.title, description: r.description ?? "" })),
                });
                setRules(view.rules.map((x) => ({ id: x.id, title: x.title, description: x.description ?? "" })));
                setSaved(true);
              })
            }
          >
            {t("rules_settings_save")}
          </button>
          {saved && (
            <span className="ok-text" role="status">
              {t("rules_settings_saved")}
            </span>
          )}
        </div>
      </Card>
      {preview.length > 0 && (
        <Card title={uiText("messaging.interface.value0_value1_75414c2", { value0: t("rules_title"), value1: preview.length })}>
          <RulesList rules={preview} />
        </Card>
      )}
    </div>
  );
}
