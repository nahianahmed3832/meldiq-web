import { Plus, X } from "lucide-react";
import { setPrefs, usePrefs } from "../../application/prefs";
import { VIBES, vibeColors } from "../../application/vibes";
import { Toggle } from "../components/Toggle";
import { useCommunityThemes } from "../community/useCommunityThemes";

const DEFAULT_CUSTOM = ["#ff6b4a", "#a855f7"];

/**
 * Settings › Appearance › Colour themes (2026-10-28): tint the whole app with one of Meldiq's gradients or your own two
 * or three colours, at the strength you choose; then whether a community's own colours show while you're in it, and
 * whether people who just messaged you show as bubbles on the rail. All of it is this browser's.
 */
export function VibesCard() {
  const prefs = usePrefs();
  const themes = useCommunityThemes();
  const custom = prefs.vibeCustom ?? DEFAULT_CUSTOM;
  const active = vibeColors(prefs.vibe, prefs.vibeCustom);
  const setCustom = (colors: string[]) => setPrefs({ vibe: "custom", vibeCustom: colors });
  return (
    <>
      <h2 className="settings-group">Colour themes</h2>
      <div className="card setting-card">
        <small className="faint">Tint the whole app. Free, and only in this browser.</small>
        <div className="vibe-grid" role="radiogroup" aria-label="Colour theme">
          <button type="button" role="radio" aria-checked={!active} className="vibe-swatch none" onClick={() => setPrefs({ vibe: null })}>
            None
          </button>
          {VIBES.map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={prefs.vibe === v.id}
              className="vibe-swatch"
              style={{ background: `linear-gradient(135deg, ${v.colors.join(", ")})` }}
              title={v.label}
              aria-label={v.label}
              onClick={() => setPrefs({ vibe: v.id })}
            />
          ))}
        </div>
        <div className="vibe-custom">
          <span className="vibe-custom-preview" style={{ background: `linear-gradient(135deg, ${custom.join(", ")})` }} aria-hidden="true" />
          <span className="lines grow">
            <strong>Custom theme</strong>
            <small className="faint">Two colours, or add a third. Then set how strong it is.</small>
          </span>
          {custom.map((c, i) => (
            <input key={i} type="color" value={c} aria-label={`Custom colour ${i + 1}`} onChange={(e) => setCustom(custom.map((x, j) => (j === i ? e.target.value : x)))} />
          ))}
          {custom.length < 3 ? (
            <button type="button" className="icon-btn" aria-label="Add a third colour" onClick={() => setCustom([...custom, "#22d3ee"])}>
              <Plus size={16} />
            </button>
          ) : (
            <button type="button" className="icon-btn" aria-label="Remove the third colour" onClick={() => setCustom(custom.slice(0, 2))}>
              <X size={16} />
            </button>
          )}
        </div>
        <label className="range-row">
          <span>Strength</span>
          <input type="range" min={10} max={100} step={5} value={prefs.vibeStrength} onChange={(e) => setPrefs({ vibeStrength: Number(e.target.value) })} disabled={!active} />
          <strong style={{ width: 44, textAlign: "end" }}>{prefs.vibeStrength}%</strong>
        </label>
      </div>
      <div className="card">
        <div className="setting">
          <div className="lines">
            <strong>Show community themes</strong>
            <small>Show a community's accent, background tint and banner while you're in it. Turn off to always keep yours.</small>
          </div>
          <Toggle label="Show community themes" checked={themes.on} onChange={themes.set} />
        </div>
        <div className="setting">
          <div className="lines">
            <strong>Message bubbles on the rail</strong>
            <small>People who just messaged you show as bubbles under Home. Turn off if they pile up.</small>
          </div>
          <Toggle label="Message bubbles on the rail" checked={prefs.railDmBubbles} onChange={(v) => setPrefs({ railDmBubbles: v })} />
        </div>
      </div>
    </>
  );
}

export function AccessibilityCard() {
  const p = usePrefs();
  return (
    <>
      <h2 className="settings-group">Comfort & accessibility</h2>
      <div className="card setting-card">
        <p className="hint">Free controls saved in this browser. Your choices take precedence over community styling.</p>
        <label className="field">
          <span>Message density</span>
          <select className="input" aria-label="Message density" value={p.density} onChange={(e) => setPrefs({ density: e.target.value as typeof p.density })}>
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
        <label className="field">
          <span>Line spacing</span>
          <select className="input" aria-label="Line spacing" value={p.lineSpacing} onChange={(e) => setPrefs({ lineSpacing: e.target.value as typeof p.lineSpacing })}>
            <option value="normal">Normal</option>
            <option value="relaxed">Relaxed</option>
          </select>
        </label>
        <label className="field">
          <span>Reduce motion</span>
          <select className="input" aria-label="Reduce motion" value={p.reducedMotion} onChange={(e) => setPrefs({ reducedMotion: e.target.value as typeof p.reducedMotion })}>
            <option value="system">Follow device</option>
            <option value="on">Always</option>
            <option value="off">Never</option>
          </select>
        </label>
        <div className="setting">
          <span className="lines">
            <strong>Higher contrast</strong>
            <small>Stronger text and visible borders.</small>
          </span>
          <Toggle label="Higher contrast" checked={p.highContrast} onChange={(highContrast) => setPrefs({ highContrast })} />
        </div>
        <button className="btn btn-secondary" onClick={() => setPrefs({ density: "comfortable", lineSpacing: "normal", reducedMotion: "system", highContrast: false })}>
          Reset comfort controls
        </button>
      </div>
    </>
  );
}
