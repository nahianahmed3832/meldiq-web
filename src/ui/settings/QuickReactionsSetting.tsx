import { useState } from "react";
import { useT } from "../../i18n";
import { useEngine, useOrbit } from "../../application/orbit";
import { PERSONAL } from "../../sync/navPrefs";
import { DEFAULT_QUICK_REACTIONS, QUICK_REACTION_CHOICES } from "../../sync/quickReactions";

export function QuickReactionsSetting() {
  const t = useT();
  const engine = useEngine();
  const supported = useOrbit((s) => s.server?.features.includes("quick-reactions"));
  const nav = useOrbit((s) => s.nav[PERSONAL]);
  const stored = nav?.quickReactions ?? DEFAULT_QUICK_REACTIONS;
  const [draft, setDraft] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const values = draft ?? stored;
  const changed = JSON.stringify(values) !== JSON.stringify(stored);
  if (!supported) return null;
  const save = async () => {
    setBusy(true);
    setError(false);
    try {
      await engine.setQuickReactions(values);
      setDraft(null);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="setting" role="group" aria-label={t("messaging.msg_quick_reactions")}>
      <div className="lines">
        <strong>{t("messaging.msg_quick_reactions")}</strong>
        <small>3–5</small>
        {engine.quickReactionsPending() && <small role="status">{t("common.status.loading")}</small>}
      </div>
      <div className="column" style={{ gap: 8 }}>
        {error && (
          <p className="field-error" role="alert">
            {t("workspace.interface.that_didn_t_work_try_again_5da2573")}
          </p>
        )}
        <div className="row wrap" style={{ gap: 4 }}>
          {QUICK_REACTION_CHOICES.map((emoji) => (
            <button
              key={emoji}
              className="btn btn-secondary btn-sm"
              aria-pressed={values.includes(emoji)}
              aria-label={t("settings.ap_react_with", { emoji })}
              disabled={busy || (!values.includes(emoji) && values.length === 5)}
              onClick={() => setDraft(values.includes(emoji) ? values.filter((e) => e !== emoji) : [...values, emoji])}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="row">
          <button className="btn btn-primary btn-sm" disabled={busy || !changed || values.length < 3 || values.length > 5} onClick={() => void save()}>
            {busy ? t("common.common_saving") : t("common.actions.save")}
          </button>
          {draft && (
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setDraft(null)}>
              {t("common.actions.cancel")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
