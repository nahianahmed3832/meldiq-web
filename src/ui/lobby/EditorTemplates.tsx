import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { useState } from "react";
import { Dialog } from "../components/Overlay";
import { useT } from "../../i18n";
import type { LobbyTemplateKey } from "../../api/lobbySchemas";
import { TEMPLATES } from "./lobbyInfo";
import type { LobbyEditor } from "./useLobbyEditor";
/**
 * Templates: five starting looks. Applying one is saved at once (the server sets the look, the cards' order and the
 * boards; text, channels and buttons stay, and starter questions only fill an empty FAQ), so it waits for unsaved changes.
 */
export function EditorTemplates({ editor }: { editor: LobbyEditor }) {
  useLocaleRender();
  const t = useT();
  const [selected, setSelected] = useState<LobbyTemplateKey | null>(null);
  const [applying, setApplying] = useState<LobbyTemplateKey | null>(null);
  const blocked = editor.count > 0;
  const apply = async (key: LobbyTemplateKey) => {
    setApplying(key);
    if (await editor.applyTemplate(key)) setSelected(null);
    setApplying(null);
  };
  return (
    <div className="lobby-editor-stack">
      {selected && (
        <Dialog
          title={uiText("organization.interface.preview_324b134")}
          onClose={() => setSelected(null)}
          footer={
            <>
              <button className="btn btn-secondary" disabled={editor.busy} onClick={() => setSelected(null)}>
                {t("common.actions.cancel")}
              </button>
              <button className="btn btn-primary" disabled={editor.busy} onClick={() => void apply(selected)}>
                {t("workspace.interface.apply_31e392d")}
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <strong>{TEMPLATES.find((t) => t.key === selected)?.name}</strong>
            <p>{TEMPLATES.find((t) => t.key === selected)?.blurb}</p>
            <p>{uiText("workspace.interface.a_template_sets_the_look_and_the_order_of_the_cards_your_text_cha_aa5879e")}</p>
            {editor.error && <p role="alert">{editor.error}</p>}
          </div>
        </Dialog>
      )}
      <p className="muted lobby-editor-note">
        {blocked
          ? uiText("workspace.interface.save_or_cancel_your_changes_first_a_template_is_saved_as_soon_as_d47bbe8")
          : uiText("workspace.interface.a_template_sets_the_look_and_the_order_of_the_cards_your_text_cha_aa5879e")}
      </p>
      <div className="lobby-templates">
        {TEMPLATES.map((t) => (
          <button key={t.key} className="lobby-template" disabled={blocked || editor.busy} aria-busy={applying === t.key} onClick={() => setSelected(t.key)}>
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
