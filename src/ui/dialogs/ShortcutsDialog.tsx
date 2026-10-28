import { usePrefs } from "../../application/prefs";
import { navigate } from "../../application/router";
import { bindingOf, FIXED_SHORTCUTS, keyCaps, SHORTCUTS } from "../../application/shortcuts";
import { Dialog } from "../components/Overlay";
import { KeyCaps } from "../settings/ShortcutsPage";

/** Every shortcut at a glance (Show the list of shortcuts, ⌘/ by default). */
export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const prefs = usePrefs();
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose} wide>
      <div className="dialog-body shortcut-list">
        {SHORTCUTS.filter((s) => bindingOf(prefs.keybinds, s.id)).map((s) => (
          <div key={s.id} className="shortcut-row">
            <span className="grow">{s.label}</span>
            <KeyCaps keys={keyCaps(bindingOf(prefs.keybinds, s.id))} />
          </div>
        ))}
        {FIXED_SHORTCUTS.map((s) => (
          <div key={s.label} className="shortcut-row">
            <span className="grow">{s.label}</span>
            <KeyCaps keys={s.keys} />
          </div>
        ))}
        <button
          className="btn btn-secondary btn-sm"
          style={{ justifySelf: "start", marginTop: 8 }}
          onClick={() => {
            onClose();
            navigate({ section: "settings", settingsPage: "shortcuts" });
          }}
        >
          Change shortcuts
        </button>
      </div>
    </Dialog>
  );
}
