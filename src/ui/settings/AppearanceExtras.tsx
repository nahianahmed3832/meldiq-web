import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
  useLocaleRender();
  const l10n = useLocalization();
  const prefs = usePrefs();
  const themes = useCommunityThemes();
  const custom = prefs.vibeCustom ?? DEFAULT_CUSTOM;
  const active = vibeColors(prefs.vibe, prefs.vibeCustom);
  const setCustom = (colors: string[]) => setPrefs({ vibe: "custom", vibeCustom: colors });
  return (
    <>
      <h2 className="settings-group">
        <Localized k="settings.interface.colour_themes_f890110" />
      </h2>
      <div className="card setting-card">
        <small className="faint">
          <Localized k="settings.interface.tint_the_whole_app_free_and_only_in_this_browser_1239c11" />
        </small>
        <div className="vibe-grid" role="radiogroup" aria-label={uiText("settings.interface.colour_theme_8484a1d")}>
          <button type="button" role="radio" aria-checked={!active} className="vibe-swatch none" onClick={() => setPrefs({ vibe: null })}>
            {l10n("settings.ap_none")}
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
            <strong>
              <Localized k="settings.interface.custom_theme_70a67d0" />
            </strong>
            <small className="faint">
              <Localized k="settings.interface.two_colours_or_add_a_third_then_set_how_strong_it_is_1fd3429" />
            </small>
          </span>
          {custom.map((c, i) => (
            <input
              key={i}
              type="color"
              value={c}
              aria-label={uiText("settings.interface.custom_colour_value0_90ab6f7", { value0: i + 1 })}
              onChange={(e) => setCustom(custom.map((x, j) => (j === i ? e.target.value : x)))}
            />
          ))}
          {custom.length < 3 ? (
            <button type="button" className="icon-btn" aria-label={uiText("settings.interface.add_a_third_colour_599af85")} onClick={() => setCustom([...custom, "#22d3ee"])}>
              <Plus size={16} />
            </button>
          ) : (
            <button type="button" className="icon-btn" aria-label={uiText("settings.interface.remove_the_third_colour_4fbaf10")} onClick={() => setCustom(custom.slice(0, 2))}>
              <X size={16} />
            </button>
          )}
        </div>
        <label className="range-row">
          <span>
            <Localized k="settings.interface.strength_63ee3a1" />
          </span>
          <input type="range" min={10} max={100} step={5} value={prefs.vibeStrength} onChange={(e) => setPrefs({ vibeStrength: Number(e.target.value) })} disabled={!active} />
          <strong style={{ width: 44, textAlign: "end" }}>{formatUiNumber(prefs.vibeStrength)}%</strong>
        </label>
      </div>
      <div className="card">
        <div className="setting">
          <div className="lines">
            <strong>
              <Localized k="settings.interface.show_community_themes_e76c3ef" />
            </strong>
            <small>
              <Localized k="settings.interface.show_a_community_s_accent_background_tint_and_banner_while_you_re_4a0aa6e" />
            </small>
          </div>
          <Toggle label={uiText("settings.interface.show_community_themes_e76c3ef")} checked={themes.on} onChange={themes.set} />
        </div>
        <div className="setting">
          <div className="lines">
            <strong>
              <Localized k="settings.interface.message_bubbles_on_the_rail_dc629f1" />
            </strong>
            <small>
              <Localized k="settings.interface.people_who_just_messaged_you_show_as_bubbles_under_home_turn_off_595e2a9" />
            </small>
          </div>
          <Toggle label={uiText("settings.interface.message_bubbles_on_the_rail_dc629f1")} checked={prefs.railDmBubbles} onChange={(v) => setPrefs({ railDmBubbles: v })} />
        </div>
      </div>
    </>
  );
}
export function AccessibilityCard() {
  useLocaleRender();
  const p = usePrefs();
  return (
    <>
      <h2 className="settings-group">
        <Localized k="settings.interface.comfort_accessibility_b04d9c4" />
      </h2>
      <div className="card setting-card">
        <p className="hint">
          <Localized k="settings.interface.free_controls_saved_in_this_browser_your_choices_take_precedence_26be282" />
        </p>
        <label className="field">
          <span>
            <Localized k="settings.interface.message_density_504cf93" />
          </span>
          <select className="input" aria-label={uiText("settings.interface.message_density_504cf93")} value={p.density} onChange={(e) => setPrefs({ density: e.target.value as typeof p.density })}>
            <option value="comfortable">
              <Localized k="settings.interface.comfortable_459a23a" />
            </option>
            <option value="compact">
              <Localized k="workspace.interface.compact_9945264" />
            </option>
          </select>
        </label>
        <label className="field">
          <span>
            <Localized k="settings.interface.line_spacing_0db45da" />
          </span>
          <select
            className="input"
            aria-label={uiText("settings.interface.line_spacing_0db45da")}
            value={p.lineSpacing}
            onChange={(e) => setPrefs({ lineSpacing: e.target.value as typeof p.lineSpacing })}
          >
            <option value="normal">
              <Localized k="workspace.interface.normal_a7248ee" />
            </option>
            <option value="relaxed">
              <Localized k="settings.interface.relaxed_43ddd4c" />
            </option>
          </select>
        </label>
        <label className="field">
          <span>
            <Localized k="settings.interface.reduce_motion_297ef4c" />
          </span>
          <select
            className="input"
            aria-label={uiText("settings.interface.reduce_motion_297ef4c")}
            value={p.reducedMotion}
            onChange={(e) => setPrefs({ reducedMotion: e.target.value as typeof p.reducedMotion })}
          >
            <option value="system">
              <Localized k="settings.interface.follow_device_3f8636b" />
            </option>
            <option value="on">
              <Localized k="settings.interface.always_de9f057" />
            </option>
            <option value="off">
              <Localized k="settings.interface.never_6300ef8" />
            </option>
          </select>
        </label>
        <div className="setting">
          <span className="lines">
            <strong>
              <Localized k="settings.interface.higher_contrast_9d69da9" />
            </strong>
            <small>
              <Localized k="settings.interface.stronger_text_and_visible_borders_5896ede" />
            </small>
          </span>
          <Toggle label={uiText("settings.interface.higher_contrast_9d69da9")} checked={p.highContrast} onChange={(highContrast) => setPrefs({ highContrast })} />
        </div>
        <button className="btn btn-secondary" onClick={() => setPrefs({ density: "comfortable", lineSpacing: "normal", reducedMotion: "system", highContrast: false })}>
          <Localized k="settings.interface.reset_comfort_controls_6422041" />
        </button>
      </div>
    </>
  );
}
