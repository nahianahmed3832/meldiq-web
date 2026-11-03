import { countLabel } from "../../i18n/counts";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Eye, EyeOff, Monitor, Smartphone, X } from "lucide-react";
import { useState } from "react";
import { Toggle } from "../components/Toggle";
import { CardEditor } from "./CardEditor";
import { EditorLook } from "./EditorLook";
import { EditorSections } from "./EditorSections";
import { EditorTemplates } from "./EditorTemplates";
import type { EditorTab, LobbyEditor } from "./useLobbyEditor";
const TABS: {
  key: EditorTab;
  label: string;
}[] = [
  {
    key: "templates",
    get label() {
      return uiText("workspace.interface.templates_56b564b");
    },
  },
  {
    key: "look",
    get label() {
      return uiText("workspace.interface.look_a0de571");
    },
  },
  {
    key: "sections",
    get label() {
      return uiText("workspace.interface.sections_9bae918");
    },
  },
];
/**
 * The live editor beside the lobby: Desktop or Phone width, Preview (the page as members see it), the lobby's switch,
 * Templates, Look and Sections, a clicked card's own editor, and Cancel / Save with the number of changes.
 */
export function LobbyEditorPanel({ editor, onClose }: { editor: LobbyEditor; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const [leaving, setLeaving] = useState(false);
  const close = () => (editor.count > 0 ? setLeaving(true) : onClose());
  return (
    <aside className="lobby-editor" aria-label={uiText("workspace.interface.customize_lobby_9da29a6")}>
      <header className="lobby-editor-head">
        <h2 className="grow">
          <Localized k="workspace.interface.customize_lobby_9da29a6" />
        </h2>
        <div className="segmented lobby-seg" role="group" aria-label={uiText("workspace.interface.preview_width_0644dda")}>
          <button aria-pressed={!editor.phone} onClick={() => editor.setPhone(false)} title={uiText("workspace.interface.desktop_9bd88f2")} aria-label={uiText("workspace.interface.desktop_9bd88f2")}>
            <Monitor size={15} aria-hidden="true" />{" "}
            <span className="seg-label">
              <Localized k="workspace.interface.desktop_9bd88f2" />
            </span>
          </button>
          <button aria-pressed={editor.phone} onClick={() => editor.setPhone(true)} title={uiText("workspace.interface.phone_63dceb8")} aria-label={uiText("workspace.interface.phone_63dceb8")}>
            <Smartphone size={15} aria-hidden="true" />{" "}
            <span className="seg-label">
              <Localized k="workspace.interface.phone_63dceb8" />
            </span>
          </button>
        </div>
        <button
          className="icon-btn"
          aria-pressed={editor.preview}
          onClick={() => editor.setPreview(!editor.preview)}
          aria-label={editor.preview ? uiText("workspace.interface.back_to_editing_69a02c6") : uiText("workspace.interface.preview_as_a_member_7d8a175")}
          title={uiText("organization.interface.preview_324b134")}
        >
          {editor.preview ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
        <button className="icon-btn" onClick={close} aria-label={uiText("workspace.interface.close_the_editor_12be2f0")}>
          <X size={18} />
        </button>
      </header>

      <label className="lobby-editor-switch">
        <span className="grow">
          <strong>
            <Localized k="workspace.interface.show_the_lobby_to_members_a8e706a" />
          </strong>
          <small>
            <Localized k="workspace.interface.new_members_land_here_the_first_time_they_open_the_community_26a9a0f" />
          </small>
        </span>
        <Toggle checked={editor.draft.enabled} onChange={(enabled) => editor.change((d) => ({ ...d, enabled }))} label={uiText("workspace.interface.show_the_lobby_to_members_a8e706a")} />
      </label>

      {editor.selected ? (
        <div className="lobby-editor-body scroll">
          <CardEditor editor={editor} />
        </div>
      ) : (
        <>
          <div className="lobby-tabs lobby-editor-tabs" role="tablist" aria-label={uiText("workspace.interface.editor_936a161")}>
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
              <Localized k="workspace.interface.native_count_ce490fbd9" slots={[countLabel(editor.count, "changes"), ""]} />
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setLeaving(false)}>
              <Localized k="workspace.interface.keep_editing_e76fd2a" />
            </button>
            <button className="btn btn-danger btn-sm" onClick={onClose}>
              <Localized k="messaging.interface.discard_eb1a70e" />
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
              <span className="grow muted">
                {editor.count === 0
                  ? uiText("workspace.interface.no_changes_yet_db591dc")
                  : uiText("auth.interface.native_count_677fe3d59", { value0: countLabel(editor.count, "changes"), value1: "" })}
              </span>
              <button className="btn btn-ghost btn-sm" disabled={editor.count === 0 || editor.busy} onClick={editor.cancel}>
                {l10n("common.actions.cancel")}
              </button>
              <button className="btn btn-primary btn-sm" disabled={editor.count === 0 || editor.busy || !!editor.problem} onClick={() => void editor.save()}>
                {l10n("common.actions.save")}
              </button>
            </div>
          </>
        )}
      </footer>
    </aside>
  );
}
