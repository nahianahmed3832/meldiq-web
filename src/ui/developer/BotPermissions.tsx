import { useState } from "react";
import { useEngine } from "../../application/orbit";
import { ENGLISH } from "../../i18n/english";
import { permissionLabel, catalogText } from "../../i18n/catalog";
import { text as t } from "../../i18n";
import { useLocaleRender } from "../../i18n/Localized";
import { BOT_SCOPES, type BotScope, requestedBotPermissions, botPermissionReview, requestBotPermissions, approveBotPermissions } from "../../sync/botPermissions";
import { useAction, useLoad } from "../workspace/useLoad";
import { ErrorLine } from "../components/SettingsCard";

/** Reuse the current native permission catalog and all 28 translations, without displaying permission identifiers. */
function scopeText(scope: BotScope): { label: string; description?: string } {
  if (scope === "events.manage") return { label: `${t("common.actions.edit")} · ${t("workspace.interface.events_8d14f6e")}` };
  const names = {
    "communities.read": () => t("workspace.interface.communities_c864f32"),
    "events.read": () => t("workspace.interface.events_8d14f6e"),
    direct_messages: () => t("workspace.directMessages"),
  };
  if (scope in names) return { label: names[scope as keyof typeof names]() };
  const native = scope === "channels.read" ? "channels.view" : scope === "members.read" ? "members.view" : scope;
  const key = native.replaceAll(".", "_");
  const source = (ENGLISH.organization.builtIn.permissionCatalog as Record<string, { label: string; description: string }>)[key];
  if (!source) return { label: t("workspace.interface.events_8d14f6e") };
  return { label: permissionLabel(native, source.label), description: catalogText(`organization.builtIn.permissionCatalog.${key}.description`, source.description) };
}

export function BotPermissions({ botId, orgId }: { botId: string; orgId?: string }) {
  useLocaleRender();
  const [opened, setOpened] = useState(false);
  return (
    <details
      className="dev-listing bot-permission-review"
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true);
      }}
    >
      <summary>{t("organization.permissions")}</summary>
      {opened && <PermissionForm botId={botId} orgId={orgId} />}
    </details>
  );
}

function PermissionForm({ botId, orgId }: { botId: string; orgId?: string }) {
  useLocaleRender();
  const engine = useEngine();
  const loaded = useLoad(
    async () => (orgId ? botPermissionReview(engine, orgId, botId) : { manifest: await requestedBotPermissions(engine, botId), installation: null, approvable: [...BOT_SCOPES] }),
    [engine, botId, orgId],
  );
  const action = useAction();
  const [draft, setDraft] = useState<BotScope[] | null>(null);
  const [saved, setSaved] = useState(false);
  const view = loaded.data;
  const selected = new Set(draft ?? view?.installation?.permissions ?? view?.manifest.permissions ?? []);
  const available = orgId ? (view?.manifest.permissions ?? []) : BOT_SCOPES;
  const prior = view?.installation?.permissions ?? view?.manifest.permissions ?? [];
  const dirty = prior.length !== selected.size || prior.some((permission) => !selected.has(permission));
  const reload = () => {
    setDraft(null);
    setSaved(false);
    action.clear();
    loaded.reload();
  };
  return (
    <form
      className="dev-listing-body"
      aria-label={t(orgId ? "workspace.botAccess.approved" : "workspace.botAccess.requested")}
      onSubmit={(event) => {
        event.preventDefault();
        if (!view || !dirty || loaded.loading || loaded.error || action.busy) return;
        setSaved(false);
        void action.act(async () => {
          if (orgId && view.installation) await approveBotPermissions(engine, orgId, botId, [...selected], view.manifest.rev, view.installation.rev);
          else await requestBotPermissions(engine, botId, [...selected], view.manifest.rev);
          setDraft(null);
          loaded.reload();
          setSaved(true);
        });
      }}
    >
      <p className="muted">{t("workspace.botAccess.notice")}</p>
      <ErrorLine text={loaded.error ?? action.error} />
      {loaded.loading && <p role="status">{t("common.status.loading")}</p>}
      {view && (
        <fieldset className="perm-group" disabled={action.busy || loaded.loading || !!loaded.error}>
          <legend className="perm-group-title">{t(orgId ? "workspace.botAccess.approved" : "workspace.botAccess.requested")}</legend>
          {!available.length && <p className="faint">{t("workspace.botAccess.none")}</p>}
          {available.map((scope) => {
            const words = scopeText(scope);
            const canApprove = !orgId || view.approvable.includes(scope);
            return (
              <label key={scope} className="perm-row">
                <span className="lines grow">
                  <span>{words.label}</span>
                  {words.description && <small>{words.description}</small>}
                </span>
                <input
                  type="checkbox"
                  checked={selected.has(scope)}
                  disabled={!canApprove && !selected.has(scope)}
                  onChange={(event) => {
                    const next = new Set(selected);
                    if (event.target.checked) next.add(scope);
                    else next.delete(scope);
                    setDraft([...next]);
                    setSaved(false);
                  }}
                />
              </label>
            );
          })}
        </fieldset>
      )}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-primary btn-sm" disabled={!view || !dirty || action.busy || loaded.loading || !!loaded.error}>
          {action.busy ? t("common.status.loading") : t("common.actions.save")}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={action.busy || loaded.loading} onClick={reload}>
          {t("messaging.collection_refresh")}
        </button>
        {saved && <small role="status">{t("organization.interface.saved_fca046c")}</small>}
      </div>
    </form>
  );
}
