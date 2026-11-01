import { Sparkles } from "lucide-react";
import { useState } from "react";
import { NAME_EFFECTS, NAME_FONTS, type NameEffect, type NameFont, type ProfileStyle } from "../../api/schemas";
import type { ProfileStyleChange } from "../../sync/account";
import { Dialog } from "../components/Overlay";
import { COLOR_PRESETS, NAME_EFFECT_LABEL, NAME_FONT_LABEL, StyledName } from "../people/NameStyle";
import { StyledAvatar } from "../people/ProfileStyle";

interface Me {
  userId: string;
  displayName: string;
  username: string;
  avatarColor: number;
}

interface NameStyleWindowProps {
  me: Me;
  photoRev: number | null;
  style: ProfileStyle;
  onApply: (change: ProfileStyleChange) => void;
  onClose: () => void;
}

type Mode = "none" | "solid" | "gradient";
type NameLook = Pick<ProfileStyle, "nameFont" | "nameColors" | "nameEffect">;

const FONTS: (NameFont | null)[] = [null, ...NAME_FONTS];
const DEFAULT_SOLID = ["#a855f7"];
const DEFAULT_GRADIENT = ["#22d3ee", "#a855f7"];
const SOLID_SWATCHES = ["#f43f5e", "#f97316", "#facc15", "#22c55e", "#14b8a6", "#3b82f6", "#a855f7", "#ec4899"];
const MAX_COLORS = 3;

const modeOf = (colors: string[] | null): Mode => (!colors?.length ? "none" : colors.length === 1 ? "solid" : "gradient");
const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/** Describes a name look in a few words: the row in My Profile shows it. */
export function describeNameLook(style: NameLook): string {
  const font = style.nameFont ? `${NAME_FONT_LABEL[style.nameFont]} font` : "Default font";
  const mode = modeOf(style.nameColors);
  const colour = mode === "none" ? "no colour" : mode === "solid" ? "one colour" : "gradient";
  return `${font} · ${colour}${style.nameEffect ? ` · ${NAME_EFFECT_LABEL[style.nameEffect]}` : ""}`;
}

/**
 * Settings › My Profile › Name style (the reference, 2026-10-29): a font, no colour / one colour / a gradient, and an
 * effect, previewed on your profile card, in a message and in the member list. Nothing is saved until Apply.
 */
export function NameStyleWindow({ me, photoRev, style, onApply, onClose }: NameStyleWindowProps) {
  const [look, setLook] = useState<NameLook>({ nameFont: style.nameFont, nameColors: style.nameColors, nameEffect: style.nameEffect });
  const mode = modeOf(look.nameColors);
  const preview: ProfileStyle = { ...style, ...look };
  const changed = look.nameFont !== style.nameFont || look.nameEffect !== style.nameEffect || (look.nameColors ?? []).join() !== (style.nameColors ?? []).join();
  const set = (change: Partial<NameLook>) => setLook((l) => ({ ...l, ...change }));
  const setMode = (m: Mode) =>
    set({ nameColors: m === "none" ? null : m === "solid" ? (look.nameColors?.slice(0, 1) ?? DEFAULT_SOLID) : look.nameColors && look.nameColors.length > 1 ? look.nameColors : DEFAULT_GRADIENT });
  const setColor = (i: number, value: string) => set({ nameColors: (look.nameColors ?? []).map((c, j) => (j === i ? value : c)) });
  const surprise = () => set({ nameFont: pick(FONTS), nameColors: pick(COLOR_PRESETS).colors, nameEffect: pick([null, ...NAME_EFFECTS] as (NameEffect | null)[]) });
  const avatar = (size: number) => (
    <StyledAvatar userId={me.userId} name={me.displayName} colorIndex={me.avatarColor} photoRev={photoRev} media={null} decoration={style.decoration} collectibles={style.collectibles} size={size} />
  );
  const name = <StyledName name={me.displayName} style={preview} className="ellipsis" />;

  return (
    <Dialog
      title="Name style"
      onClose={onClose}
      width="min(920px, 96vw)"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={surprise}>
            <Sparkles size={14} /> Surprise me
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setLook({ nameFont: null, nameColors: null, nameEffect: null })}>
            Reset
          </button>
          <button type="button" className="btn btn-primary" disabled={!changed} onClick={() => onApply(look)}>
            Apply
          </button>
        </>
      }
    >
      <div className="dialog-body style-window">
        <div className="style-window-main">
          <section className="setting-group" aria-labelledby="nsw-font">
            <h3 id="nsw-font" className="settings-label">
              Font
            </h3>
            <div className="glyph-grid" role="group" aria-labelledby="nsw-font">
              {FONTS.map((f) => (
                <button key={f ?? "none"} type="button" className="glyph-choice" aria-pressed={look.nameFont === f} onClick={() => set({ nameFont: f })} title={f ? NAME_FONT_LABEL[f] : "Meldiq"}>
                  <span className={`sname${f ? ` nf-${f}` : ""}`}>Gg</span>
                  <span className="sr-only">{f ? NAME_FONT_LABEL[f] : "Meldiq"}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="setting-group" aria-labelledby="nsw-colour">
            <h3 id="nsw-colour" className="settings-label">
              Colour
            </h3>
            <div className="segmented" role="group" aria-labelledby="nsw-colour">
              {(["none", "solid", "gradient"] as Mode[]).map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
                  {m === "none" ? "None" : m === "solid" ? "Solid" : "Gradient"}
                </button>
              ))}
            </div>
            {mode === "solid" && (
              <div className="color-presets" role="group" aria-label="Colours">
                {SOLID_SWATCHES.map((c) => (
                  <button key={c} type="button" className="color-preset" style={{ background: c }} aria-pressed={look.nameColors?.[0] === c} onClick={() => set({ nameColors: [c] })}>
                    <span className="sr-only">{c}</span>
                  </button>
                ))}
              </div>
            )}
            {mode === "gradient" && (
              <div className="color-presets" role="group" aria-label="Gradients">
                {COLOR_PRESETS.filter((c) => c.colors.length > 1).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="color-preset"
                    style={{ background: `linear-gradient(120deg, ${c.colors.join(", ")})` }}
                    aria-pressed={(look.nameColors ?? []).join() === c.colors.join()}
                    onClick={() => set({ nameColors: c.colors })}
                  >
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            )}
            {mode !== "none" && (
              <div className="row custom-colors" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span className="faint">Your own:</span>
                {(look.nameColors ?? []).map((c, i) => (
                  <input key={i} type="color" value={c} aria-label={`Colour ${i + 1}`} onChange={(e) => setColor(i, e.target.value)} />
                ))}
                {mode === "gradient" && (look.nameColors ?? []).length < MAX_COLORS && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ nameColors: [...(look.nameColors ?? []), "#facc15"] })}>
                    + Third colour
                  </button>
                )}
              </div>
            )}
          </section>

          <section className="setting-group" aria-labelledby="nsw-effect">
            <h3 id="nsw-effect" className="settings-label">
              Effect
            </h3>
            <div className="segmented" role="group" aria-labelledby="nsw-effect">
              {([null, ...NAME_EFFECTS] as (NameEffect | null)[]).map((e) => (
                <button key={e ?? "none"} type="button" aria-pressed={look.nameEffect === e} onClick={() => set({ nameEffect: e })}>
                  {e ? NAME_EFFECT_LABEL[e] : "None"}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="style-window-preview" aria-label="Preview" aria-live="polite">
          <div className="style-sample-card card">
            {avatar(64)}
            <strong className="style-sample-name">{name}</strong>
            <small className="faint">@{me.username}</small>
          </div>
          <div className="style-window-samples card">
            <div className="style-sample-msg">
              {avatar(40)}
              <div className="lines">
                <span>
                  <strong>{name}</strong> <small className="faint">now</small>
                </span>
                <span>Anyone up for a game later?</span>
              </div>
            </div>
            <div className="style-sample-member">
              {avatar(32)}
              <strong className="ellipsis">{name}</strong>
            </div>
          </div>
          <small className="faint">Your colour shows everywhere, even over a community role's colour. With no colour picked, the role's colour shows.</small>
        </div>
      </div>
    </Dialog>
  );
}
