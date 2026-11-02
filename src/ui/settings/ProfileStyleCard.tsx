import { CollectionStudio } from "./CollectionStudio";
import { ChevronRight, Clapperboard, ImagePlus, Sparkles, Trash2 } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { PROFILE_EFFECTS } from "../../api/schemas";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { removeAvatarMedia, removeProfileBanner, setAvatarMedia, setProfileBanner, userProfile } from "../../sync/account";
import { ACCENT_PRESETS } from "../community/accent";
import { StyledName, WornTagChip } from "../people/NameStyle";
import { EFFECT_LABEL, ProfileEffect, StyledAvatar } from "../people/ProfileStyle";
import { bannerJpeg } from "../workspace/photo";
import { useLoad } from "../workspace/useLoad";
import { DecorationWindow, useDecorationName } from "./DecorationWindow";
import { describeNameLook, NameStyleWindow } from "./NameStyleWindow";
import { NO_STYLE } from "./noStyle";
import { useProfileDraft } from "./profileDraft";
import { useStyleDraft } from "./useStyleDraft";
import { ProfileThemePicker } from "./ProfileThemePicker";
import { ShownBadgePicker } from "./ShownBadgePicker";
import type { NameBadgeKind } from "../people/NameBadge";
import type { MojoMark } from "../../api/profileSchemas";

type StyleWindow = "decoration" | "name" | null;

/** What the server accepts (server PROFILE_MEDIA_LIMITS): said before upload, and checked again there. */
const LIMITS = { avatarImageMb: 4, clipMb: 12, clipSeconds: 6, bannerAnimatedMb: 6 };

/**
 * Settings › Profile › Look (continuation brief v3 §10, API 0.45.0; laid out as the reference, 2026-10-29): an animated
 * avatar (GIF, WebP, or a short video clip the server turns into a 3 s silent loop), a banner (still or animated), the
 * community tag by your name, the badge you show (API 0.65.0), rows opening the decoration and name style windows, a
 * banner effect, and the profile theme (API 0.65.0; one banner colour on older servers). The
 * preview is My Profile's right column. Each change saves at once; uploads say what's happening and what went wrong.
 * Who sees the avatar and banner follows the photo's setting under Privacy.
 */
export function ProfileStyleCard({ nameStyles, pictureControls }: { nameStyles: boolean; pictureControls?: ReactNode }) {
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const photoRev = useOrbit((s) => (s.me ? (s.users[s.me.userId]?.photoRev ?? null) : null));
  const profilesRev = useOrbit((s) => s.profilesRev);
  const tagged = useOrbit(
    (s) => s.orgs.filter((o) => !!o.tag).map((o) => ({ id: o.id, name: o.name, tag: o.tag as string, accent: o.accent })),
    (a, b) => a.length === b.length && a.every((x, i) => shallowEqual(x, b[i])),
  );
  const themeOn = useOrbit((s) => s.server?.features.includes("profile-theme") ?? false);
  const badgeOn = useOrbit((s) => s.server?.features.includes("shown-badge") ?? false);
  const mojoBadge = useOrbit((s) => s.mojo.me?.badge ?? null);
  const [open, setOpen] = useState<StyleWindow>(null);
  const [version, setVersion] = useState(0);
  const profile = useLoad(() => (me ? userProfile(engine, me.userId) : Promise.resolve(null)), [engine, me?.userId, version, profilesRev]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);
  const p = profile.data;
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const saver = useStyleDraft(
    engine,
    useMemo(() => p?.profileStyle ?? NO_STYLE, [p]),
    reload,
  );
  const style = saver.style;
  const decorationName = useDecorationName(style.decoration);
  const draft = useProfileDraft();
  const updateDraft = draft?.update;
  useEffect(() => updateDraft?.({ style }), [style, updateDraft]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const pickAvatar = (f: File | undefined) => {
    if (!f) return;
    const video = f.type.startsWith("video/");
    if (video && f.size > LIMITS.clipMb * 1024 * 1024) return setError(`Video clips can be up to ${LIMITS.clipMb} MB.`);
    if (!video && f.size > LIMITS.avatarImageMb * 1024 * 1024) return setError(`Animated avatars can be up to ${LIMITS.avatarImageMb} MB.`);
    void run(video ? "Converting your clip…" : "Uploading…", async () => setAvatarMedia(engine, new Uint8Array(await f.arrayBuffer())));
  };
  const pickBanner = (f: File | undefined) => {
    if (!f) return;
    const animated = f.type === "image/gif" || f.type === "image/webp";
    if (animated && f.size > LIMITS.bannerAnimatedMb * 1024 * 1024) return setError(`Animated banners can be up to ${LIMITS.bannerAnimatedMb} MB.`);
    // A still picture is cropped to the banner's shape and re-encoded here (no camera metadata leaves the browser).
    void run("Uploading…", async () => setProfileBanner(engine, animated ? new Uint8Array(await f.arrayBuffer()) : await bannerJpeg(f)));
  };
  const setStyle = saver.save;
  // The badges you hold now (API 0.65.0): from your own profile, and your Meldiq Plus plan's badge.
  const mojoMark: MojoMark | null = p?.mojo ?? (mojoBadge?.kind ? { badge: mojoBadge.kind, check: mojoBadge.check } : null);
  const held: NameBadgeKind[] = [...(mojoMark ? ["mojo" as const] : []), ...(p?.badges.includes("bug-hunter") ? ["bug-hunter" as const] : []), ...(p?.decorationArtist ? ["artist" as const] : [])];

  useEffect(() => {
    if (avatarInput.current) avatarInput.current.value = "";
    if (bannerInput.current) bannerInput.current.value = "";
  }, [version]);

  if (!me) return null;
  return (
    <div className="profile-look" aria-label="Look">
      <CollectionStudio />
      <div className="profile-customize-banner">
        <div className="profile-customize-art" aria-hidden="true">
          <StyledAvatar
            userId={me.userId}
            name={me.displayName}
            colorIndex={me.avatarColor}
            photoRev={photoRev}
            media={null}
            decoration={style.decoration}
            collectibles={style.collectibles}
            size={48}
          />
          <Sparkles size={20} />
        </div>
        <div className="lines grow">
          <strong>Make your profile feel like you</strong>
          <p>Find a frame that fits your personality.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen("decoration")}>
          Browse frames <ChevronRight size={16} />
        </button>
      </div>
      <div className="profile-look-heading">
        <h2>Look</h2>
        <small className="faint">Preview your style before applying it.</small>
      </div>
      {pictureControls}

      {(error ?? saver.error) && (
        <div className="banner danger" role="alert">
          {error ?? saver.error}
        </div>
      )}
      {busy && (
        <p className="faint" role="status" style={{ margin: 0 }}>
          {busy}
        </p>
      )}

      <section className="setting-group" aria-labelledby="ps-avatar">
        <h3 id="ps-avatar" className="invite-or-title">
          Animated avatar
        </h3>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input ref={avatarInput} type="file" hidden accept="image/gif,image/webp,video/mp4,video/webm,video/quicktime" onChange={(e) => pickAvatar(e.target.files?.[0])} />
          <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => avatarInput.current?.click()}>
            <Clapperboard size={14} /> {p?.avatarMedia ? "Change" : "Add a GIF, WebP or clip"}
          </button>
          {p?.avatarMedia && (
            <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void run("Removing…", () => removeAvatarMedia(engine))}>
              <Trash2 size={14} /> Remove
            </button>
          )}
        </div>
        <small className="faint">
          GIF or WebP up to {LIMITS.avatarImageMb} MB and 1024 px, or a video up to {LIMITS.clipSeconds} seconds ({LIMITS.clipMb} MB): it plays as a 3 second silent loop, everywhere you appear:
          messages, member lists and your profile. With reduced motion it doesn't play.
        </small>
      </section>

      <section className="setting-group" aria-labelledby="ps-banner">
        <h3 id="ps-banner" className="invite-or-title">
          Banner
        </h3>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input ref={bannerInput} type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => pickBanner(e.target.files?.[0])} />
          <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => bannerInput.current?.click()}>
            <ImagePlus size={14} /> {p?.profileBanner ? "Change banner" : "Add banner"}
          </button>
          {p?.profileBanner && (
            <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void run("Removing…", () => removeProfileBanner(engine))}>
              <Trash2 size={14} /> Remove
            </button>
          )}
        </div>
        <small className="faint">A picture (cropped to 1200 × 480), or an animated GIF or WebP up to {LIMITS.bannerAnimatedMb} MB. Video banners aren't supported.</small>
      </section>

      {nameStyles && (
        <section className="setting-group" aria-labelledby="ps-tag">
          <h3 id="ps-tag" className="invite-or-title">
            Community tag
          </h3>
          {tagged.length === 0 ? (
            <small className="faint">None of your communities has a tag yet. Owners and admins add one in the community's settings › Appearance.</small>
          ) : (
            <div className="tag-tiles" role="group" aria-labelledby="ps-tag">
              <button type="button" className="tag-tile" aria-pressed={!style.tagOrgId} onClick={() => setStyle({ tagOrgId: null })}>
                None
              </button>
              {tagged.map((o) => (
                <button key={o.id} type="button" className="tag-tile" aria-pressed={style.tagOrgId === o.id} onClick={() => setStyle({ tagOrgId: o.id })}>
                  <WornTagChip tag={{ orgId: o.id, text: o.tag, color: o.accent }} />
                  <span className="ellipsis">{o.name}</span>
                </button>
              ))}
            </div>
          )}
          {tagged.length > 0 && <small className="faint">Shown beside your name in messages and member lists.</small>}
        </section>
      )}

      {badgeOn && p && <ShownBadgePicker style={style} held={held} mojo={mojoMark} onSave={setStyle} />}

      <div className="style-rows">
        <button type="button" className="style-row" onClick={() => setOpen("decoration")}>
          <StyledAvatar
            userId={me.userId}
            name={me.displayName}
            colorIndex={me.avatarColor}
            photoRev={photoRev}
            media={null}
            decoration={style.decoration}
            collectibles={style.collectibles}
            size={36}
          />
          <span className="lines grow">
            <strong>Avatar decoration</strong>
            <small className="faint">{decorationName}</small>
          </span>
          <ChevronRight size={16} className="faint" aria-hidden="true" />
        </button>
        {nameStyles && (
          <button type="button" className="style-row" onClick={() => setOpen("name")}>
            <span className="style-row-name">
              <StyledName name={me.displayName} style={style} className="ellipsis" />
            </span>
            <span className="lines grow">
              <strong>Name style</strong>
              <small className="faint">{describeNameLook(style)}</small>
            </span>
            <ChevronRight size={16} className="faint" aria-hidden="true" />
          </button>
        )}
      </div>

      <section className="setting-group" aria-labelledby="ps-fx">
        <h3 id="ps-fx" className="invite-or-title">
          Banner effect
        </h3>
        <div className="style-grid" role="group" aria-labelledby="ps-fx">
          {[null, ...PROFILE_EFFECTS].map((f) => (
            <button key={f ?? "none"} type="button" className="style-choice" aria-pressed={style.effect === f} onClick={() => setStyle({ effect: f })}>
              <span className="swatch-fx">
                <ProfileEffect effect={f} />
              </span>
              {f ? EFFECT_LABEL[f] : "None"}
            </button>
          ))}
        </div>
      </section>

      {themeOn && <ProfileThemePicker style={style} onSave={setStyle} />}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-secondary" disabled={saver.busy || !saver.dirty} onClick={saver.undo}>
          Undo look change
        </button>
        <button
          className="btn btn-secondary"
          disabled={saver.busy || !saver.dirty}
          onClick={() => {
            saver.reset();
            reload();
          }}
        >
          Reset look
        </button>
        <button className="btn btn-primary" disabled={saver.busy || !saver.dirty} onClick={() => void saver.apply()}>
          {saver.busy ? "Applying…" : "Apply look"}
        </button>
        {saver.dirty && <small role="status">Unsaved look preview</small>}
      </div>

      {!themeOn && (
        <section className="setting-group" aria-labelledby="ps-accent">
          <h3 id="ps-accent" className="invite-or-title">
            Banner colour
          </h3>
          <fieldset className="brand-swatches" aria-labelledby="ps-accent">
            <button type="button" className="brand-swatch meldiq" aria-pressed={style.accent === null} onClick={() => setStyle({ accent: null })} title="Your avatar's colour">
              <span className="sr-only">Your avatar's colour</span>
            </button>
            {ACCENT_PRESETS.map((a) => (
              <button key={a.hex} type="button" className="brand-swatch" style={{ background: a.hex }} aria-pressed={style.accent === a.hex} onClick={() => setStyle({ accent: a.hex })} title={a.name}>
                <span className="sr-only">{a.name}</span>
              </button>
            ))}
          </fieldset>
        </section>
      )}

      {open === "decoration" && (
        <DecorationWindow
          me={me}
          photoRev={photoRev}
          current={style.decoration}
          onClose={() => setOpen(null)}
          onApply={(d) => {
            setStyle({ decoration: d });
            setOpen(null);
          }}
        />
      )}
      {open === "name" && (
        <NameStyleWindow
          me={me}
          photoRev={photoRev}
          style={style}
          onClose={() => setOpen(null)}
          onApply={(change) => {
            setStyle(change);
            setOpen(null);
          }}
        />
      )}
    </div>
  );
}
