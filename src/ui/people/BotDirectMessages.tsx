import { useId, useState } from "react";
import { ApiError } from "../../api/client";
import { useEngine } from "../../application/orbit";
import { navigate } from "../../application/router";
import { text as t } from "../../i18n";
import { useLocaleRender } from "../../i18n/Localized";
import { botDmConsent, setBotDmConsent } from "../../sync/botDirectMessages";
import { ErrorLine } from "../components/SettingsCard";
import { useAction, useLoad } from "../workspace/useLoad";

/** A person's explicit approval, independent of community installation and the bot owner's settings. */
export function BotDirectMessages({ botId, onClose }: { botId: string; onClose: () => void }) {
  useLocaleRender();
  const engine = useEngine();
  const noticeId = useId();
  const loaded = useLoad(async () => {
    try {
      return await botDmConsent(engine, botId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }, [engine, botId]);
  const action = useAction();
  const view = loaded.data;
  const [draft, setDraft] = useState<{ rev: number; enabled: boolean } | null>(null);
  const enabled = draft && draft.rev === view?.rev ? draft.enabled : (view?.enabled ?? false);
  if (!loaded.loading && !loaded.error && (!view || (!view.requested && !view.conversationId))) return null;
  const disabled = action.busy || loaded.loading || !!loaded.error || !view;
  const change = (enabled: boolean) => {
    if (!view || disabled) return;
    setDraft({ rev: view.rev, enabled });
    void action
      .act(async () => {
        await setBotDmConsent(engine, botId, view, enabled);
      })
      .then((ok) => {
        if (!ok) setDraft(null);
        loaded.reload();
      });
  };
  const open = () => {
    if (!view?.enabled || !view.conversationId || disabled) return;
    const id = view.conversationId;
    void action.act(async () => {
      // Validate consent again before navigation; a stale profile must not silently resume a revoked chat.
      const current = await botDmConsent(engine, botId);
      if (!current.enabled || current.conversationId !== id) {
        loaded.reload();
        return;
      }
      await engine.ensureConversation(id);
      navigate({ section: "dms", conversationId: id });
      onClose();
    });
  };
  return (
    <section className="bot-direct-messages bot-permission-review" aria-label={t("workspace.directMessages")} aria-busy={loaded.loading || action.busy}>
      <h3>{t("workspace.directMessages")}</h3>
      <p id={noticeId}>{t("messaging.botDm.notice")}</p>
      <p className="faint">{t("messaging.botDm.restart")}</p>
      <label className="perm-row">
        <span className="grow">{t("messaging.botDm.allow")}</span>
        <input type="checkbox" aria-describedby={noticeId} checked={enabled} disabled={disabled || (!view?.requested && !view?.enabled)} onChange={(event) => change(event.currentTarget.checked)} />
      </label>
      <ErrorLine text={loaded.error || action.error} />
      <div className="ws-form-actions">
        <button
          className="btn btn-secondary"
          disabled={action.busy || loaded.loading}
          onClick={() => {
            action.clear();
            loaded.reload();
          }}
        >
          {t("messaging.collection_refresh")}
        </button>
        {view?.enabled && enabled && (
          <button className="btn btn-primary" disabled={disabled} onClick={open}>
            {t("messaging.message")}
          </button>
        )}
      </div>
    </section>
  );
}
