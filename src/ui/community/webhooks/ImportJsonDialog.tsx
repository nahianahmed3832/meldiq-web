import { useState } from "react";
import { DRAFT_LIMITS, draftFromJson, type PostDraft } from "../../../sync/posting/draft";
import { Dialog } from "../../components/Overlay";

/** Paste a post's JSON (this builder's, or a Discord webhook message) to load it into the builder. */
export function ImportJsonDialog({ onImport, onClose }: { onImport: (d: PostDraft) => void; onClose: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    const r = draftFromJson(text);
    if ("error" in r) return setError(r.error);
    onImport(r.draft);
  };
  return (
    <Dialog
      title="Import JSON"
      subtitle="Paste a webhook message: content, embeds and link buttons are read. It replaces what's in the builder."
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!text.trim()} onClick={load}>
            Import
          </button>
        </>
      }
    >
      <div className="dialog-body">
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        <textarea
          className="textarea mono"
          rows={12}
          data-autofocus
          aria-label="Post JSON"
          spellCheck={false}
          value={text}
          maxLength={DRAFT_LIMITS.json}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
        />
      </div>
    </Dialog>
  );
}
