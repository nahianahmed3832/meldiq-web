import { useState } from "react";
import type { LobbyTemplateKey } from "../../api/lobbySchemas";
import { TEMPLATES } from "./lobbyInfo";
import type { LobbyEditor } from "./useLobbyEditor";

/**
 * Templates: five starting looks. Applying one is saved at once (the server sets the look, the cards' order and the
 * boards; text, channels and buttons stay, and starter questions only fill an empty FAQ), so it waits for unsaved changes.
 */
export function EditorTemplates({ editor }: { editor: LobbyEditor }) {
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
        {blocked ? "Save or cancel your changes first: a template is saved as soon as you pick it." : "A template sets the look and the order of the cards. Your text, channels and buttons stay."}
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
