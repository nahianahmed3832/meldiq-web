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
      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
    </button>
  );
}

/**
 * A secret shown this once (a bot token, a client secret): in a box to copy, with the warning that Meldiq keeps only its
 * hash, so it can't be shown again.
 */
export function SecretBox({ title, secret, onDone }: { title: string; secret: string; onDone: () => void }) {
  return (
    <div className="secret-box" role="alert">
      <strong>{title}</strong>
      <small>Copy it now and keep it somewhere safe. Meldiq doesn't keep it, so it can't be shown again. Anyone who has it can act as this.</small>
      <div className="secret-row">
        <code className="grow">{secret}</code>
        <CopyButton text={secret} label={`Copy ${title.toLowerCase()}`} />
      </div>
      <div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
          I've saved it
        </button>
      </div>
    </div>
  );
}
