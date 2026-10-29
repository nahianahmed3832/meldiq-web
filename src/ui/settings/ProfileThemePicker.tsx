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
        Profile theme
      </h3>
      <div className="theme-row">
        <button type="button" className="theme-none" aria-pressed={!shown} onClick={() => saveNow({ themeColors: null, accent: null })}>
          None
        </button>
        <label className="theme-color" title="Theme colour">
          <input type="color" value={first} aria-label="Theme colour" onChange={(e) => setColor(0, e.target.value)} />
        </label>
        {shown && shown.length > 1 ? (
          <>
            <label className="theme-color" title="Second colour">
              <input type="color" value={shown[1]} aria-label="Second colour" onChange={(e) => setColor(1, e.target.value)} />
            </label>
            <button type="button" className="icon-btn" aria-label="Remove the second colour" title="Remove the second colour" onClick={() => saveNow({ themeColors: [first] })}>
              <X size={16} />
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => saveNow({ themeColors: [first, lighten(first, SECOND_LIGHTEN)] })}>
            + Second
          </button>
        )}
        {shown && <span className="theme-sample" style={{ background: themeBackground(shown) }} aria-hidden="true" />}
      </div>
      <div className="theme-presets" role="group" aria-label="Theme presets">
        {THEME_PRESETS.map((p) => (
          <button key={p.id} type="button" className="theme-preset" aria-pressed={isPreset(shown, p.colors)} onClick={() => saveNow({ themeColors: p.colors })}>
            <span className="theme-preset-swatch" style={{ background: themeBackground(p.colors) }} aria-hidden="true" />
            {p.label}
          </button>
        ))}
      </div>
      <small className="faint">It colours your profile card, and its banner when you have no banner picture.</small>
    </section>
  );
}
