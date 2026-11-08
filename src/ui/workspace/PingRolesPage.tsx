import { useState } from "react";
import { useEngine } from "../../application/orbit";
import { useT } from "../../i18n";
import { PING_ROLE_LIMIT, PING_ROLE_NAME, pingRoles, savePingRoles, savePingSelection, type PingRoleDraft } from "../../sync/pingRoles";
import { Card, ErrorLine } from "../components/SettingsCard";
import { useUnsavedChanges } from "../components/UnsavedChanges";
import { useAction, useLoad } from "./useLoad";

const templates = ["announcements", "giveaways", "updates", "events", "polls"] as const;
type Settings = Awaited<ReturnType<typeof pingRoles>>;

export function PingRolesPage({ orgId }: { orgId: string }) {
  const engine = useEngine();
  const t = useT();
  const load = useLoad(() => pingRoles(engine, orgId), [engine, orgId]);
  return (
    <div className="ws-page">
      <p className="muted">{t("workspace.reference.pingHelp")}</p>
      <ErrorLine text={load.error} />
      {load.error && (
        <div>
          <button type="button" className="btn btn-secondary" onClick={load.reload}>
            {t("common.actions.retry")}
          </button>
        </div>
      )}
      {load.loading && !load.data && <div className="skeleton" style={{ height: 80 }} aria-busy="true" />}
      {load.data && (
        <>
          <Subscriptions key={`subscriptions-${load.data.rev}`} orgId={orgId} initial={load.data} />
          {load.data.canManage && <RoleEditor key={`editor-${load.data.rev}`} orgId={orgId} initial={load.data} reload={load.reload} />}
        </>
      )}
    </div>
  );
}

function Subscriptions({ orgId, initial }: { orgId: string; initial: Settings }) {
  const engine = useEngine();
  const t = useT();
  const [selected, setSelected] = useState(initial.subscribed);
  const [saved, setSaved] = useState(initial.subscribed);
  const action = useAction();
  const dirty = selected.length !== saved.length || selected.some((id) => !saved.includes(id));
  useUnsavedChanges(dirty);
  return (
    <Card title={t("workspace.reference.pingChoices")}>
      {initial.roles.length === 0 && <p className="muted">{t("workspace.reference.noPingRoles")}</p>}
      {initial.roles.map(({ id, name }) => (
        <label className="row ws-ping-option" key={id}>
          <input
            type="checkbox"
            checked={selected.includes(id)}
            disabled={action.busy}
            onChange={(e) => setSelected(e.target.checked ? [...selected, id] : selected.filter((other) => id !== other))}
          />
          <span>{name}</span>
        </label>
      ))}
      <ErrorLine text={action.error} />
      {initial.roles.length > 0 && (
        <div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!dirty || action.busy}
            onClick={() =>
              void action.act(async () => {
                const data = await savePingSelection(engine, orgId, selected);
                setSelected(data.subscribed);
                setSaved(data.subscribed);
              })
            }
          >
            {t("common.actions.save")}
          </button>
        </div>
      )}
    </Card>
  );
}

function RoleEditor({ orgId, initial, reload }: { orgId: string; initial: Settings; reload: () => void }) {
  const t = useT();
  const engine = useEngine();
  const [draft, setDraft] = useState<PingRoleDraft[]>(initial.roles);
  const action = useAction();
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial.roles);
  const cleaned = draft.map((role) => ({ ...role, name: role.name.trim() }));
  const names = cleaned.map(({ name }) => name.normalize("NFKC").toLowerCase());
  const valid = cleaned.every(({ name }) => name.length >= 2 && PING_ROLE_NAME.test(name)) && new Set(names).size === names.length && names.every((name) => name !== "everyone" && name !== "here");
  const additions = templates.map((key) => t(`workspace.reference.pingTemplate_${key}`)).filter((name) => !names.includes(name.normalize("NFKC").toLowerCase()));
  useUnsavedChanges(dirty);
  return (
    <Card title={t("workspace.reference.managePingRoles")} sub={t("workspace.reference.pingNoPermissions")}>
      <div className="ws-order-actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={action.busy || !additions.length || draft.length + additions.length > PING_ROLE_LIMIT}
          onClick={() => setDraft([...draft, ...additions.map((name) => ({ name }))])}
        >
          {t("workspace.reference.pingAddTemplates")}
        </button>
        <button type="button" className="btn btn-secondary" disabled={action.busy || draft.length >= PING_ROLE_LIMIT} onClick={() => setDraft([...draft, { name: "" }])}>
          {t("workspace.reference.pingAdd")}
        </button>
      </div>
      {draft.map((role, i) => (
        <div className="ws-order-actions" key={role.id ?? i}>
          <input
            className="input grow"
            value={role.name}
            aria-label={t("workspace.reference.pingRoleName", { number: i + 1 })}
            maxLength={32}
            disabled={action.busy}
            onChange={(e) => setDraft(draft.map((item, index) => (index === i ? { ...item, name: e.target.value } : item)))}
          />
          <button type="button" className="btn btn-secondary" disabled={action.busy} onClick={() => setDraft(draft.filter((_, index) => index !== i))}>
            {t("common.actions.remove")}
          </button>
        </div>
      ))}
      {!valid && <p className="muted">{t("workspace.reference.pingNamesHelp")}</p>}
      <ErrorLine text={action.error} />
      <div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!dirty || !valid || action.busy}
          onClick={() => void action.act(() => savePingRoles(engine, orgId, initial.rev, cleaned).then(reload))}
        >
          {t("common.actions.save")}
        </button>
      </div>
    </Card>
  );
}
