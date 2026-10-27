import { useState } from "react";
import { ApiError } from "../../api/client";
import { NAME_EFFECTS, NAME_FONTS, type NameEffect, type NameFont, type ProfileStyle } from "../../api/schemas";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { setProfileStyle, type ProfileStyleChange, userProfile } from "../../sync/account";
import { COLOR_PRESETS, NAME_EFFECT_LABEL, NAME_FONT_LABEL, namePaint, StyledName, WornTagChip } from "../people/NameStyle";
import { useLoad } from "../workspace/useLoad";

const sameColors = (a: string[] | null, b: string[] | null) => (a ?? []).join() === (b ?? []).join();

/**
 * Settings › Profile › Name style (API 0.46.0): how your display name looks wherever it's shown (messages, member
 * lists, your profile): a font, a colour or gradient from Meldiq's presets or your own two or three colours, a glow or
 * shimmer, and the tag of one of your communities beside it. Each change saves at once and shows in the preview.
 */
export function NameStyleCard() {
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const profilesRev = useOrbit((s) => s.profilesRev);
  const tagged = useOrbit(
    (s) => s.orgs.filter((o) => !!o.tag).map((o) => ({ id: o.id, name: o.name, tag: o.tag as string, accent: o.accent })),
    (a, b) => a.length === b.length && a.every((x, i) => shallowEqual(x, b[i])),
  );
  const [version, setVersion] = useState(0);
  const profile = useLoad(() => (me ? userProfile(engine, me.userId) : Promise.resolve(null)), [engine, me?.userId, version, profilesRev]);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState<string[] | null>(null);
  if (!me) return null;
  const style: ProfileStyle = profile.data?.profileStyle ?? { decoration: null, effect: null, accent: null, nameFont: null, nameColors: null, nameEffect: null, tagOrgId: null };
  const colors = custom ?? style.nameColors;
  const wornOrg = tagged.find((o) => o.id === style.tagOrgId) ?? null;
  const preview: ProfileStyle = { ...style, nameColors: colors };

  const save = (change: ProfileStyleChange) => {
    setError(null);
    void setProfileStyle(engine, change)
      .then(() => setVersion((v) => v + 1))
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Couldn't save your name style. Try again."));
  };
  const pickColors = (next: string[] | null) => {
    setCustom(null);
    save({ nameColors: next });
  };

  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 18 }} aria-label="Name style">
      <div>
        <h2 style={{ margin: 0, fontSize: 17 }}>Name style</h2>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          A font, colours and an effect for your name, shown to everyone wherever your name appears. Add your community's tag beside it.
        </p>
      </div>

      <div className="name-preview" aria-label="Preview">
        <span className="name-preview-row">
          <StyledName name={me.displayName} style={preview} tag={wornOrg ? { orgId: wornOrg.id, text: wornOrg.tag, color: wornOrg.accent } : null} className="ellipsis" />
        </span>
        <small className="faint">How it looks in messages and member lists</small>
      </div>

      {error && (
        <div className="banner danger" role="alert">
          {error}
        </div>
      )}

      <section className="setting-group" aria-labelledby="ns-font">
        <h3 id="ns-font" className="invite-or-title">
          Font
        </h3>
        <div className="font-grid" role="group" aria-labelledby="ns-font">
          {([null, ...NAME_FONTS] as (NameFont | null)[]).map((f) => (
            <button key={f ?? "none"} type="button" className="font-choice" aria-pressed={style.nameFont === f} onClick={() => save({ nameFont: f })}>
              <span className={`sname${f ? ` nf-${f}` : ""}`}>{me.displayName.slice(0, 14) || "Aa"}</span>
              <small>{f ? NAME_FONT_LABEL[f] : "Meldiq"}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="setting-group" aria-labelledby="ns-colour">
        <h3 id="ns-colour" className="invite-or-title">
          Colour
        </h3>
        <div className="color-presets" role="group" aria-labelledby="ns-colour">
          <button type="button" className="color-preset none" aria-pressed={!colors} onClick={() => pickColors(null)}>
            <span>Default</span>
          </button>
          {COLOR_PRESETS.map((c) => (
            <button
              key={c.id}
              type="button"
              className="color-preset"
              style={{ background: c.colors.length > 1 ? `linear-gradient(120deg, ${c.colors.join(", ")})` : c.colors[0] }}
              aria-pressed={sameColors(colors, c.colors)}
              onClick={() => pickColors(c.colors)}
            >
              <span>{c.label}</span>
            </button>
          ))}
        </div>
        <div className="row custom-colors" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="faint">Your own:</span>
          {(colors ?? ["#22d3ee", "#a855f7"]).map((c, i, all) => (
            <input
              key={i}
              type="color"
              value={c}
              aria-label={`Colour ${i + 1}`}
              onChange={(e) => setCustom(all.map((x, j) => (j === i ? e.target.value : x)))}
              onBlur={() => custom && save({ nameColors: custom })}
            />
          ))}
          {(colors ?? []).length < 3 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCustom([...(colors ?? ["#22d3ee", "#a855f7"]), "#facc15"])}>
              + Third colour
            </button>
          )}
          {custom && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => save({ nameColors: custom })}>
              Save colours
            </button>
          )}
          {colors && colors.length > 1 && (
            <span className="sname grad faint" style={namePaint(colors)}>
              gradient
            </span>
          )}
        </div>
      </section>

      <section className="setting-group" aria-labelledby="ns-effect">
        <h3 id="ns-effect" className="invite-or-title">
          Effect
        </h3>
        <div className="segmented" role="group" aria-labelledby="ns-effect">
          {([null, ...NAME_EFFECTS] as (NameEffect | null)[]).map((e) => (
            <button key={e ?? "none"} type="button" aria-pressed={style.nameEffect === e} onClick={() => save({ nameEffect: e })}>
              {e ? NAME_EFFECT_LABEL[e] : "None"}
            </button>
          ))}
        </div>
        <small className="faint">Shimmer moves; with reduced motion it stays still.</small>
      </section>

      <section className="setting-group" aria-labelledby="ns-tag">
        <h3 id="ns-tag" className="invite-or-title">
          Community tag
        </h3>
        {tagged.length === 0 ? (
          <small className="faint">None of your communities has a tag yet. Owners and admins add one in the community's settings › Appearance.</small>
        ) : (
          <div className="tag-choices" role="group" aria-labelledby="ns-tag">
            <button type="button" className="tag-choice" aria-pressed={!wornOrg} onClick={() => save({ tagOrgId: null })}>
              No tag
            </button>
            {tagged.map((o) => (
              <button key={o.id} type="button" className="tag-choice" aria-pressed={wornOrg?.id === o.id} onClick={() => save({ tagOrgId: o.id })}>
                <WornTagChip tag={{ orgId: o.id, text: o.tag, color: o.accent }} />
                <span className="ellipsis">{o.name}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
