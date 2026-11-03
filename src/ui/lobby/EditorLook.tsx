import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import type { LobbyLook } from "../../api/lobbySchemas";
import { ACCENT_PRESETS } from "../community/accent";
import { BACKGROUNDS, BANNER_HEIGHTS, CARD_STYLES, type Choice, FONTS, LAYOUTS, TITLES } from "./lobbyInfo";
import type { LobbyEditor } from "./useLobbyEditor";
/** Look: layout, accent, background, cards, font, banner height and title, each restyling the page at once. */
export function EditorLook({ editor }: { editor: LobbyEditor }) {
  useLocaleRender();
  const look = editor.draft.look;
  const set = <K extends keyof LobbyLook>(k: K, v: LobbyLook[K]) => editor.change((d) => ({ ...d, look: { ...d.look, [k]: v } }));
  const custom = look.accent !== "auto";
  return (
    <div className="lobby-editor-stack">
      <fieldset className="lobby-field">
        <legend>
          <Localized k="workspace.interface.layout_a511909" />
        </legend>
        <div className="lobby-layouts">
          {LAYOUTS.map((l) => (
            <button key={l.value} className="lobby-layout" aria-pressed={look.layout === l.value} onClick={() => set("layout", l.value)}>
              <span className={`lobby-layout-thumb thumb-${l.value}`} aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <strong>{l.label}</strong>
              <small>{l.hint}</small>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="lobby-field">
        <legend>
          <Localized k="workspace.interface.accent_a5c6fb1" />
        </legend>
        <div className="lobby-swatches">
          <button className="chip" aria-pressed={!custom} onClick={() => set("accent", "auto")}>
            <Localized k="workspace.interface.auto_0286249" />
          </button>
          {ACCENT_PRESETS.map((p) => (
            <button key={p.hex} className="lobby-swatch" style={{ background: p.hex }} aria-pressed={look.accent === p.hex} aria-label={p.name} title={p.name} onClick={() => set("accent", p.hex)} />
          ))}
          <label className="lobby-swatch lobby-swatch-custom" title={uiText("workspace.interface.any_colour_93e6156")}>
            <input type="color" aria-label={uiText("workspace.interface.any_colour_93e6156")} value={custom ? look.accent : "#8b5cf6"} onChange={(e) => set("accent", e.target.value.toLowerCase())} />
          </label>
        </div>
        <small className="muted">
          <Localized k="workspace.interface.auto_follows_the_community_s_own_accent_4940e9c" />
        </small>
      </fieldset>

      <Segmented label={uiText("workspace.interface.background_ea2b8a8")} choices={BACKGROUNDS} value={look.background} onChange={(v) => set("background", v)} />
      <Segmented label={uiText("workspace.interface.cards_a52fcbb")} choices={CARD_STYLES} value={look.cards} onChange={(v) => set("cards", v)} />
      <fieldset className="lobby-field">
        <legend>
          <Localized k="workspace.interface.font_64d0b3a" />
        </legend>
        <div className="lobby-fonts">
          {FONTS.map((f) => (
            <button key={f.value} className={`lobby-font font-${f.value}`} aria-pressed={look.font === f.value} onClick={() => set("font", f.value)}>
              <span aria-hidden="true">{"Aa"}</span>
              <small>{f.label}</small>
            </button>
          ))}
        </div>
      </fieldset>
      <Segmented label={uiText("workspace.interface.banner_height_8721059")} choices={BANNER_HEIGHTS} value={look.bannerHeight} onChange={(v) => set("bannerHeight", v)} />
      <Segmented label={uiText("messaging.interface.title_7e8cd20")} choices={TITLES} value={look.title} onChange={(v) => set("title", v)} />
    </div>
  );
}
function Segmented<T extends string>({ label, choices, value, onChange }: { label: string; choices: readonly Choice<T>[]; value: T; onChange: (v: T) => void }) {
  useLocaleRender();
  return (
    <fieldset className="lobby-field">
      <legend>{label}</legend>
      <div className="segmented lobby-seg" role="group" aria-label={label}>
        {choices.map((c) => (
          <button key={c.value} aria-pressed={value === c.value} onClick={() => onChange(c.value)}>
            {c.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
