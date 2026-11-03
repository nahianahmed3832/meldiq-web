import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
interface CopyButtonProps {
  text: string;
  /** What's copied, for screen readers ("Copy the code line"). */
  label: string;
  disabled?: boolean;
}
/** A small Copy button that says "Copied" once the clipboard took the text (a refused clipboard leaves it as it was). */
export function CopyButton({ text, label, disabled }: CopyButtonProps) {
  useLocaleRender();
  const l10n = useLocalization();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      aria-label={label}
      disabled={disabled}
      onClick={() =>
        void navigator.clipboard
          ?.writeText(text)
          .then(() => setCopied(true))
          .catch(() => undefined)
      }
    >
      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? l10n("common.common_copied") : l10n("common.actions.copy")}
    </button>
  );
}
/**
 * A secret shown this once (a bot token, a client secret): in a box to copy, with the warning that Meldiq keeps only its
 * hash, so it can't be shown again.
 */
export function SecretBox({ title, secret, onDone }: { title: string; secret: string; onDone: () => void }) {
  useLocaleRender();
  return (
    <div className="secret-box" role="alert">
      <strong>{title}</strong>
      <small>
        <Localized k="workspace.interface.copy_it_now_and_keep_it_somewhere_safe_meldiq_doesn_t_keep_it_so_2d2d936" />
      </small>
      <div className="secret-row">
        <code className="grow">{secret}</code>
        <CopyButton text={secret} label={uiText("workspace.interface.copy_value0_8d6cc3e", { value0: title.toLowerCase() })} />
      </div>
      <div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
          <Localized k="organization.interface.i_ve_saved_it_ad586e1" />
        </button>
      </div>
    </div>
  );
}
