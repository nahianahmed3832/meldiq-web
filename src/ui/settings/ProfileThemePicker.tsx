import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ProfileStyle } from "../../api/profileSchemas";
import type { ProfileStyleChange } from "../../sync/account";
import { isPreset, THEME_PRESETS, themeBackground, themeColorsOf } from "../people/profileTheme";
/** The colour the picker starts from when there's no theme yet. */
const START_COLOR = "#6366f1";
/** Dragging a colour picker fires on every move: the pick is saved once it rests this long. */
const SAVE_AFTER_MS = 400;
/** How much white a new second colour mixes into the first, so "+ Second" starts as a soft gradient. */
const SECOND_LIGHTEN = 0.45;
/** [hex] mixed with white by [amount] (0–1), as "#rrggbb". */
export function lighten(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const mix = (c: number) =>
    Math.round(c + (255 - c) * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}
interface ProfileThemePickerProps {
  style: ProfileStyle;
  onSave: (change: ProfileStyleChange) => void;
}
/**
 * Settings › My Profile › Look › Profile theme (API 0.65.0, the reference's layout): None, one colour, "+ Second" for a
 * two-colour gradient, and Meldiq's presets. Presets and None save at once; a colour being dragged saves when it rests.
 */
export function ProfileThemePicker({ style, onSave }: ProfileThemePickerProps) {
  useLocaleRender();
  const l10n = useLocalization();
  const current = themeColorsOf(style);
  const [dragging, setDragging] = useState<string[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shown = dragging ?? current;
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const saveNow = (change: ProfileStyleChange) => {
    if (timer.current) clearTimeout(timer.current);
    setDragging(null);
    onSave(change);
  };
  const drag = (colors: string[]) => {
    setDragging(colors);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveNow({ themeColors: colors }), SAVE_AFTER_MS);
  };
  const setColor = (i: number, hex: string) => {
    const base = shown ?? [START_COLOR];
    drag(base.map((c, j) => (j === i ? hex.toLowerCase() : c)));
  };
  const first = shown?.[0] ?? START_COLOR;
  return (
    <section className="setting-group" aria-labelledby="ps-theme">
      <h3 id="ps-theme" className="invite-or-title">
        <Localized k="settings.interface.profile_theme_8bfc9f5" />
      </h3>
      <div className="theme-row">
        <button type="button" className="theme-none" aria-pressed={!shown} onClick={() => saveNow({ themeColors: null, accent: null })}>
          {l10n("settings.ap_none")}
        </button>
        <label className="theme-color" title={uiText("settings.interface.theme_colour_41988af")}>
          <input type="color" value={first} aria-label={uiText("settings.interface.theme_colour_41988af")} onChange={(e) => setColor(0, e.target.value)} />
        </label>
        {shown && shown.length > 1 ? (
          <>
            <label className="theme-color" title={uiText("settings.interface.second_colour_c6f7bc0")}>
              <input type="color" value={shown[1]} aria-label={uiText("settings.interface.second_colour_c6f7bc0")} onChange={(e) => setColor(1, e.target.value)} />
            </label>
            <button
              type="button"
              className="icon-btn"
              aria-label={uiText("settings.interface.remove_the_second_colour_ce10e8f")}
              title={uiText("settings.interface.remove_the_second_colour_ce10e8f")}
              onClick={() => saveNow({ themeColors: [first] })}
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => saveNow({ themeColors: [first, lighten(first, SECOND_LIGHTEN)] })}>
            <Localized k="settings.interface.second_d5b5f47" />
          </button>
        )}
        {shown && <span className="theme-sample" style={{ background: themeBackground(shown) }} aria-hidden="true" />}
      </div>
      <div className="theme-presets" role="group" aria-label={uiText("settings.interface.theme_presets_d14702f")}>
        {THEME_PRESETS.map((p) => (
          <button key={p.id} type="button" className="theme-preset" aria-pressed={isPreset(shown, p.colors)} onClick={() => saveNow({ themeColors: p.colors })}>
            <span className="theme-preset-swatch" style={{ background: themeBackground(p.colors) }} aria-hidden="true" />
            {p.label}
          </button>
        ))}
      </div>
      <small className="faint">
        <Localized k="settings.interface.it_colours_your_profile_card_and_its_banner_when_you_have_no_bann_09076b9" />
      </small>
    </section>
  );
}
