import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { useState } from "react";
import type { LobbyTemplateKey } from "../../api/lobbySchemas";
import { TEMPLATES } from "./lobbyInfo";
import type { LobbyEditor } from "./useLobbyEditor";
/**
 * Templates: five starting looks. Applying one is saved at once (the server sets the look, the cards' order and the
 * boards; text, channels and buttons stay, and starter questions only fill an empty FAQ), so it waits for unsaved changes.
 */
export function EditorTemplates({ editor }: { editor: LobbyEditor }) {
  useLocaleRender();
  const [applying, setApplying] = useState<LobbyTemplateKey | null>(null);
  const blocked = editor.count > 0;
  const apply = async (key: LobbyTemplateKey) => {
    setApplying(key);
    await editor.applyTemplate(key);
    setApplying(null);
  };
  return (
    <div className="lobby-editor-stack">
      <p className="muted lobby-editor-note">
        {blocked
          ? uiText("workspace.interface.save_or_cancel_your_changes_first_a_template_is_saved_as_soon_as_d47bbe8")
          : uiText("workspace.interface.a_template_sets_the_look_and_the_order_of_the_cards_your_text_cha_aa5879e")}
      </p>
      <div className="lobby-templates">
        {TEMPLATES.map((t) => (
          <button key={t.key} className="lobby-template" disabled={blocked || editor.busy} aria-busy={applying === t.key} onClick={() => void apply(t.key)}>
            <span className="lobby-template-thumb" aria-hidden="true">
              {t.bars.map((c, i) => (
                <span key={i} style={{ background: c }} />
              ))}
            </span>
            <strong>{t.name}</strong>
            <small>{t.blurb}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
