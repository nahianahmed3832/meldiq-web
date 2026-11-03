import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { setPrefs, usePrefs } from "../../application/prefs";
import { bindingOf, comboOf, FIXED_SHORTCUTS, keyCaps, SHORTCUTS, type ShortcutId, usableCombo } from "../../application/shortcuts";
/** Keys drawn as keycaps. */
export function KeyCaps({ keys }: { keys: string[] }) {
  useLocaleRender();
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
  useLocaleRender();
  const l10n = useLocalization();
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
      if (!usableCombo(combo)) return setProblem(uiText("settings.interface.use_a_modifier_or_ctrl_alt_shift_with_the_key_or_a_function_key_d06ce57"));
      const taken = SHORTCUTS.find((s) => s.id !== recording && bindingOf(prefs.keybinds, s.id) === combo);
      if (taken) return setProblem(uiText("settings.interface.that_s_already_value0_c510512", { value0: taken.label.toLowerCase() }));
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
      <h1>{l10n("settings.settings_shortcuts")}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        <Localized k="settings.interface.click_a_shortcut_and_press_the_keys_you_want_esc_cancels_saved_in_e8da145" slots={[<KeyCaps keys={keyCaps(bindingOf(prefs.keybinds, "showShortcuts"))} />]} />
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
                aria-label={uiText("settings.interface.value0_value1_change_079ea5a", { value0: s.label, value1: combo ? keyCaps(combo).join(" ") : uiText("settings.interface.off_da7a687") })}
              >
                {recording === s.id ? (
                  <span className="faint">
                    <Localized k="settings.interface.press_keys_7f34202" />
                  </span>
                ) : combo ? (
                  <KeyCaps keys={keyCaps(combo)} />
                ) : (
                  <span className="faint">
                    <Localized k="messaging.interface.off_ca7981b" />
                  </span>
                )}
              </button>
              {combo ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(s.id, "")}>
                  <Localized k="messaging.interface.off_ca7981b" />
                </button>
              ) : (
                <span style={{ width: 44 }} />
              )}
              <button
                type="button"
                className="icon-btn"
                disabled={!changed}
                onClick={() => set(s.id, null)}
                aria-label={uiText("settings.interface.put_back_the_default_for_value0_337c6f0", { value0: s.label.toLowerCase() })}
                title={l10n("settings.ap_default")}
              >
                <RotateCcw size={15} />
              </button>
            </div>
          );
        })}
      </div>
      <h2 className="settings-group">
        <Localized k="settings.interface.always_on_044ba8a" />
      </h2>
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
