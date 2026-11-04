import { PALETTES, THEMES, setPrefs, usePrefs, type Palette, type Prefs } from "../../application/prefs";
import { useT, type StringKey } from "../../i18n";

const THEME_KEY = { system: "ap_system", light: "ap_light", dark: "ap_dark", black: "ap_black" } as const satisfies Record<Prefs["theme"], StringKey>;
const PALETTE_KEY = { meldiq: "ap_meldiq", midnight: "ap_midnight", charcoal: "ap_charcoal", indigo: "ap_indigo", plum: "ap_plum", amber: "ap_amber" } as const satisfies Record<Palette, StringKey>;

/** Welcome and Settings use the same free, browser-scoped preferences. */
export function ThemeChoice() {
  const prefs = usePrefs();
  const t = useT();
  return (
    <div className="segmented" role="group" aria-label={t("ap_theme")}>
      {THEMES.map((theme) => (
        <button type="button" key={theme} aria-pressed={prefs.theme === theme} onClick={() => setPrefs({ theme, themeChosen: true })}>
          {t(THEME_KEY[theme])}
        </button>
      ))}
    </div>
  );
}
export function PaletteChoice() {
  const prefs = usePrefs();
  const t = useT();
  return (
    <div className="palette-picker" role="radiogroup" aria-label={t("ap_colour")}>
      {PALETTES.map((palette) => (
        <button
          type="button"
          key={palette}
          role="radio"
          aria-checked={prefs.palette === palette}
          className="palette-swatch"
          data-swatch={palette}
          onClick={() => setPrefs({ palette, paletteChosen: true })}
        >
          <span className="swatch" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          {t(PALETTE_KEY[palette])}
        </button>
      ))}
    </div>
  );
}
