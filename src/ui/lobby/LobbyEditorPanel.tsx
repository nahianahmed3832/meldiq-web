import { Eye, EyeOff, Monitor, Smartphone, X } from "lucide-react";
import { useState } from "react";
import { Toggle } from "../components/Toggle";
import { CardEditor } from "./CardEditor";
import { EditorLook } from "./EditorLook";
import { EditorSections } from "./EditorSections";
import { EditorTemplates } from "./EditorTemplates";
import type { EditorTab, LobbyEditor } from "./useLobbyEditor";

const TABS: { key: EditorTab; label: string }[] = [
  { key: "templates", label: "Templates" },
  { key: "look", label: "Look" },
  { key: "sections", label: "Sections" },
];

/**
 * The live editor beside the lobby: Desktop or Phone width, Preview (the page as members see it), the lobby's switch,
 * Templates, Look and Sections, a clicked card's own editor, and Cancel / Save with the number of changes.
 */
export function LobbyEditorPanel({ editor, onClose }: { editor: LobbyEditor; onClose: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const close = () => (editor.count > 0 ? setLeaving(true) : onClose());
  return (
    <aside className="lobby-editor" aria-label="Customize lobby">
      <header className="lobby-editor-head">
        <h2 className="grow">Customize lobby</h2>
        <div className="segmented lobby-seg" role="group" aria-label="Preview width">
          <button aria-pressed={!editor.phone} onClick={() => editor.setPhone(false)} title="Desktop" aria-label="Desktop">
            <Monitor size={15} aria-hidden="true" /> <span className="seg-label">Desktop</span>
          </button>
          <button aria-pressed={editor.phone} onClick={() => editor.setPhone(true)} title="Phone" aria-label="Phone">
            <Smartphone size={15} aria-hidden="true" /> <span className="seg-label">Phone</span>
          </button>
        </div>
        <button
          className="icon-btn"
          aria-pressed={editor.preview}
          onClick={() => editor.setPreview(!editor.preview)}
          aria-label={editor.preview ? "Back to editing" : "Preview as a member"}
          title="Preview"
        >
          {editor.preview ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
        <button className="icon-btn" onClick={close} aria-label="Close the editor">
          <X size={18} />
        </button>
      </header>

      <label className="lobby-editor-switch">
        <span className="grow">
          <strong>Show the lobby to members</strong>
          <small>New members land here the first time they open the community.</small>
        </span>
        <Toggle checked={editor.draft.enabled} onChange={(enabled) => editor.change((d) => ({ ...d, enabled }))} label="Show the lobby to members" />
      </label>

      {editor.selected ? (
        <div className="lobby-editor-body scroll">
          <CardEditor editor={editor} />
        </div>
      ) : (
        <>
          <div className="lobby-tabs lobby-editor-tabs" role="tablist" aria-label="Editor">
            {TABS.map((t) => (
              <button key={t.key} role="tab" aria-selected={editor.tab === t.key} onClick={() => editor.setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="lobby-editor-body scroll" role="tabpanel">
            {editor.tab === "templates" ? <EditorTemplates editor={editor} /> : editor.tab === "look" ? <EditorLook editor={editor} /> : <EditorSections editor={editor} />}
          </div>
        </>
      )}

      <footer className="lobby-editor-foot">
        {leaving ? (
          <div className="lobby-editor-leave" role="alert">
            <span className="grow">
              Discard {editor.count} {editor.count === 1 ? "change" : "changes"}?
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setLeaving(false)}>
              Keep editing
            </button>
            <button className="btn btn-danger btn-sm" onClick={onClose}>
              Discard
            </button>
          </div>
        ) : (
          <>
            {(editor.error ?? (editor.count > 0 ? editor.problem : null)) && (
              <p className={editor.error ? "danger-text" : "muted"} role="alert">
                {editor.error ?? editor.problem}
              </p>
            )}
            <div className="row lobby-editor-actions">
              <span className="grow muted">{editor.count === 0 ? "No changes yet" : `${editor.count} ${editor.count === 1 ? "change" : "changes"}`}</span>
              <button className="btn btn-ghost btn-sm" disabled={editor.count === 0 || editor.busy} onClick={editor.cancel}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" disabled={editor.count === 0 || editor.busy || !!editor.problem} onClick={() => void editor.save()}>
                Save
              </button>
            </div>
          </>
        )}
      </footer>
    </aside>
  );
}
