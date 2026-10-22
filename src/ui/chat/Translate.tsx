import { Copy, Languages } from "lucide-react";
import { useState } from "react";
import { setPrefs, usePrefs } from "../../application/prefs";
import { TRANSLATE_TARGETS, type TranslateTarget, translateText } from "../../sync/translate";
import { Dialog } from "../components/Overlay";

/**
 * Translate message (android translate sheet): the first time, what happens to the text; then the language, and the
 * translation on this device. The stored, encrypted message is never changed; the translation lives only on screen.
 */
export function TranslateDialog({ text, onDone, onClose }: { text: string; onDone: (translation: string) => void; onClose: () => void }) {
  const prefs = usePrefs();
  const [target, setTarget] = useState<TranslateTarget>(prefs.translateTarget);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setError(null);
    setBusy("Translating…");
    setPrefs({ translateConsent: true, translateTarget: target });
    try {
      onDone(await translateText(text, target, (share) => setBusy(share < 1 ? `Getting the language model… ${Math.round(share * 100)}%` : "Translating…")));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't translate this message.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <Dialog
      title="Translate message"
      onClose={onClose}
      footer={
        <button className="btn btn-primary" onClick={() => void run()} disabled={!!busy}>
          <Languages size={16} /> {busy ?? "Translate"}
        </button>
      }
    >
      <div className="dialog-body">
        {!prefs.translateConsent && (
          <p className="faint" style={{ margin: 0, fontSize: 13 }}>
            Meldiq translates in this browser. The first time, the browser may download the language model. Your message text never leaves this device.
          </p>
        )}
        <label className="field">
          <span>Translate into</span>
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
  return (
    <div className="msg-translation">
      <small className="faint">
        <Languages size={12} aria-hidden="true" /> Translated in this browser
      </small>
      <div>{text}</div>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => void navigator.clipboard?.writeText(text)}>
          <Copy size={12} /> Copy translation
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onHide}>
          Show original only
        </button>
      </div>
    </div>
  );
}
