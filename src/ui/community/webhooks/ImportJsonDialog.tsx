import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { useT as useLocalization } from "../../../i18n";
import { useState } from "react";
import { DRAFT_LIMITS, draftFromJson, type PostDraft } from "../../../sync/posting/draft";
import { Dialog } from "../../components/Overlay";
/** Paste a post's JSON (this builder's, or a Discord webhook message) to load it into the builder. */
export function ImportJsonDialog({ onImport, onClose }: { onImport: (d: PostDraft) => void; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    const r = draftFromJson(text);
    if ("error" in r) return setError(r.error);
    onImport(r.draft);
  };
  return (
    <Dialog
      title={uiText("organization.interface.import_json_12dd2e2")}
      subtitle={uiText("organization.interface.paste_a_webhook_message_content_embeds_and_link_buttons_are_read_1834fc9")}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!text.trim()} onClick={load}>
            <Localized k="organization.interface.import_2cff9ba" />
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
          aria-label={uiText("organization.interface.post_json_bb43d61")}
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
