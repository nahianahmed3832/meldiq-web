import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { setPrefs, usePrefs } from "../../application/prefs";
import { bindingOf, comboOf, FIXED_SHORTCUTS, keyCaps, SHORTCUTS, type ShortcutId, usableCombo } from "../../application/shortcuts";

/** Keys drawn as keycaps. */
export function KeyCaps({ keys }: { keys: string[] }) {
  return (
    <span className="keycaps">
      {keys.map((k, i) => (
        <kbd key={i}>{k}</kbd>
      ))}
    </span>
  );
}

/**
 * Settings › Shortcuts (2026-10-28): click a shortcut and press the keys you want; Escape cancels, Off turns it off,
 * the arrow puts the default back. Saved in this browser. The always-on keys are listed below them.
 */
export function ShortcutsPage() {
  const prefs = usePrefs();
  const [recording, setRecording] = useState<ShortcutId | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape" && !e.shiftKey) return setRecording(null);
      const combo = comboOf(e);
      if (!combo) return;
      if (!usableCombo(combo)) return setProblem("Use a modifier (⌘ or Ctrl, Alt, Shift) with the key, or a function key.");
      const taken = SHORTCUTS.find((s) => s.id !== recording && bindingOf(prefs.keybinds, s.id) === combo);
      if (taken) return setProblem(`That's already ${taken.label.toLowerCase()}.`);
      setPrefs({ keybinds: { ...prefs.keybinds, [recording]: combo } });
      setProblem(null);
      setRecording(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording, prefs.keybinds]);
  const set = (id: ShortcutId, combo: string | null) => {
    const next = { ...prefs.keybinds };
    if (combo === null) delete next[id];
    else next[id] = combo;
    setPrefs({ keybinds: next });
  };
  return (
    <>
      <h1>Shortcuts</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Click a shortcut and press the keys you want. Esc cancels. Saved in this browser. <KeyCaps keys={keyCaps(bindingOf(prefs.keybinds, "showShortcuts"))} /> shows them anywhere.
      </p>
      {problem && (
        <div className="banner warn" role="alert">
          {problem}
        </div>
      )}
      <div className="card shortcut-list">
        {SHORTCUTS.map((s) => {
          const combo = bindingOf(prefs.keybinds, s.id);
          const changed = prefs.keybinds[s.id] !== undefined;
          return (
            <div key={s.id} className="shortcut-row">
              <span className="grow">{s.label}</span>
              <button
                type="button"
                className="shortcut-keys"
                aria-pressed={recording === s.id}
                onClick={() => setRecording(recording === s.id ? null : s.id)}
                aria-label={`${s.label}: ${combo ? keyCaps(combo).join(" ") : "off"}. Change`}
              >
                {recording === s.id ? <span className="faint">Press keys…</span> : combo ? <KeyCaps keys={keyCaps(combo)} /> : <span className="faint">Off</span>}
              </button>
              {combo ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(s.id, "")}>
                  Off
                </button>
              ) : (
                <span style={{ width: 44 }} />
              )}
              <button type="button" className="icon-btn" disabled={!changed} onClick={() => set(s.id, null)} aria-label={`Put back the default for ${s.label.toLowerCase()}`} title="Default">
                <RotateCcw size={15} />
              </button>
            </div>
          );
        })}
      </div>
      <h2 className="settings-group">Always on</h2>
      <div className="card shortcut-list">
        {FIXED_SHORTCUTS.map((s) => (
          <div key={s.label} className="shortcut-row">
            <span className="grow">{s.label}</span>
            <KeyCaps keys={s.keys} />
          </div>
        ))}
      </div>
    </>
  );
}
