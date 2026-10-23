import { Copy, Languages } from "lucide-react";
import { useState } from "react";
import { setPrefs, usePrefs } from "../../application/prefs";
import { defaultTarget, TRANSLATE_TARGETS, type TranslateTarget, translateText, translationSupported } from "../../sync/translate";
import { useLanguage, useT } from "../../i18n";
import { Dialog } from "../components/Overlay";

/**
 * Translate message (android translate sheet): the first time, what happens to the text; then the language, and the
 * translation on this device. The stored, encrypted message is never changed; the translation lives only on screen.
 */
export function TranslateDialog({ text, onDone, onClose }: { text: string; onDone: (translation: string) => void; onClose: () => void }) {
  const prefs = usePrefs();
  const language = useLanguage();
  // Into the interface's language until the person picks another (2026-10-23).
  const [target, setTarget] = useState<TranslateTarget>(() => defaultTarget(prefs.translateConsent, prefs.translateTarget, language));
  const supported = translationSupported();
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setError(null);
    setBusy(t("tr_busy"));
    setPrefs({ translateConsent: true, translateTarget: target });
    try {
      onDone(await translateText(text, target, (share) => setBusy(share < 1 ? t("tr_model", { n: Math.round(share * 100) }) : t("tr_busy"))));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("tr_failed"));
    } finally {
      setBusy(null);
    }
  };
  if (!supported)
    return (
      <Dialog
        title={t("tr_title")}
        onClose={onClose}
        footer={
          <button className="btn btn-secondary" onClick={() => void navigator.clipboard?.writeText(text).then(onClose)}>
            <Copy size={16} /> {t("msg_copy_text")}
          </button>
        }
      >
        <div className="dialog-body">
          <p style={{ margin: 0 }}>{t("tr_unsupported")}</p>
          <p className="faint" style={{ margin: 0, fontSize: 13 }}>
            {t("tr_unsupported_sub")}
          </p>
        </div>
      </Dialog>
    );
  return (
    <Dialog
      title={t("tr_title")}
      onClose={onClose}
      footer={
        <button className="btn btn-primary" onClick={() => void run()} disabled={!!busy}>
          <Languages size={16} /> {busy ?? t("tr_button")}
        </button>
      }
    >
      <div className="dialog-body">
        {!prefs.translateConsent && (
          <p className="faint" style={{ margin: 0, fontSize: 13 }}>
            {t("tr_consent")}
          </p>
        )}
        <label className="field">
          <span>{t("tr_into")}</span>
          <select className="input" value={target} onChange={(e) => setTarget(e.target.value as TranslateTarget)}>
            {TRANSLATE_TARGETS.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p className="banner warn" role="alert" style={{ margin: 0 }}>
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

/** A translation under the message, labelled as such, with Copy and Show original. */
export function TranslationView({ text, onHide }: { text: string; onHide: () => void }) {
  const t = useT();
  return (
    <div className="msg-translation">
      <small className="faint">
        <Languages size={12} aria-hidden="true" /> {t("tr_done")}
      </small>
      <div>{text}</div>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => void navigator.clipboard?.writeText(text)}>
          <Copy size={12} /> {t("tr_copy")}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onHide}>
          {t("tr_original")}
        </button>
      </div>
    </div>
  );
}
