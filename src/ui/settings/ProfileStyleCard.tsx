import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
  useLocaleRender();
  const l10n = useLocalization();
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
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : uiText("workspace.interface.that_didn_t_work_try_again_5da2573"));
    } finally {
      setBusy(null);
    }
  };
  const pickAvatar = (f: File | undefined) => {
    if (!f) return;
    const video = f.type.startsWith("video/");
    if (video && f.size > LIMITS.clipMb * 1024 * 1024) return setError(uiText("settings.interface.video_clips_can_be_up_to_value0_mb_ea9c4a7", { value0: LIMITS.clipMb }));
    if (!video && f.size > LIMITS.avatarImageMb * 1024 * 1024) return setError(uiText("settings.interface.animated_avatars_can_be_up_to_value0_mb_2def1af", { value0: LIMITS.avatarImageMb }));
    void run(video ? uiText("settings.interface.converting_your_clip_f12fe54") : uiText("settings.interface.uploading_5ce44dd"), async () =>
      setAvatarMedia(engine, new Uint8Array(await f.arrayBuffer())),
    );
  };
  const pickBanner = (f: File | undefined) => {
    if (!f) return;
    const animated = f.type === "image/gif" || f.type === "image/webp";
    if (animated && f.size > LIMITS.bannerAnimatedMb * 1024 * 1024) return setError(uiText("settings.interface.animated_banners_can_be_up_to_value0_mb_ff43283", { value0: LIMITS.bannerAnimatedMb }));
    // A still picture is cropped to the banner's shape and re-encoded here (no camera metadata leaves the browser).
    void run(uiText("settings.interface.uploading_5ce44dd"), async () => setProfileBanner(engine, animated ? new Uint8Array(await f.arrayBuffer()) : await bannerJpeg(f)));
  };
  const setStyle = saver.save;
  // The badges you hold now (API 0.65.0): from your own profile, and your Meldiq Plus plan's badge.
  const mojoMark: MojoMark | null = p?.mojo ?? (mojoBadge?.kind ? { badge: mojoBadge.kind, check: mojoBadge.check } : null);
  const held: NameBadgeKind[] = [...(mojoMark ? ["mojo" as const] : []), ...(p?.badges.includes("bug-hunter") ? ["bug-hunter" as const] : []), ...(p?.decorationArtist ? ["artist" as const] : [])];
  if (!me) return null;
  return (
    <div className="profile-look" aria-label={uiText("workspace.interface.look_a0de571")}>
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
          <strong>
            <Localized k="settings.interface.make_your_profile_feel_like_you_0ac61a8" />
          </strong>
          <p>
            <Localized k="settings.interface.find_a_frame_that_fits_your_personality_def2efc" />
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen("decoration")}>
          <Localized k="settings.interface.browse_frames_5b67263" slots={[<ChevronRight size={16} />]} />
        </button>
      </div>
      <div className="profile-look-heading">
        <h2>
          <Localized k="workspace.interface.look_a0de571" />
        </h2>
        <small className="faint">
          <Localized k="settings.interface.preview_your_style_before_applying_it_422f293" />
        </small>
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
          <Localized k="settings.interface.animated_avatar_f5e99ab" />
        </h3>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input
            ref={avatarInput}
            type="file"
            hidden
            accept="image/gif,image/webp,video/mp4,video/webm,video/quicktime"
            onChange={(e) => {
              const selected = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              pickAvatar(selected);
            }}
          />
          <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => avatarInput.current?.click()}>
            <Clapperboard size={14} /> {p?.avatarMedia ? uiText("workspace.interface.change_c0bf75b") : uiText("settings.interface.add_a_gif_webp_or_clip_978154f")}
          </button>
          {p?.avatarMedia && (
            <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void run(uiText("settings.interface.removing_d4b0991"), () => removeAvatarMedia(engine))}>
              <Trash2 size={14} /> {l10n("common.actions.remove")}
            </button>
          )}
        </div>
        <small className="faint">
          <Localized k="settings.interface.gif_or_webp_up_to_mb_and_1024_px_or_a_video_up_to_seconds_mb_it_p_e6bb13f" slots={[LIMITS.avatarImageMb, LIMITS.clipSeconds, LIMITS.clipMb]} />
        </small>
      </section>

      <section className="setting-group" aria-labelledby="ps-banner">
        <h3 id="ps-banner" className="invite-or-title">
          <Localized k="settings.interface.banner_b7f4d98" />
        </h3>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input
            ref={bannerInput}
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => {
              const selected = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              pickBanner(selected);
            }}
          />
          <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => bannerInput.current?.click()}>
            <ImagePlus size={14} /> {p?.profileBanner ? uiText("settings.interface.change_banner_6ca1984") : uiText("settings.interface.add_banner_e7d7d97")}
          </button>
          {p?.profileBanner && (
            <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void run(uiText("settings.interface.removing_d4b0991"), () => removeProfileBanner(engine))}>
              <Trash2 size={14} /> {l10n("common.actions.remove")}
            </button>
          )}
        </div>
        <small className="faint">
          <Localized k="settings.interface.a_picture_cropped_to_1200_480_or_an_animated_gif_or_webp_up_to_mb_6f80809" slots={[LIMITS.bannerAnimatedMb]} />
        </small>
      </section>

      {nameStyles && (
        <section className="setting-group" aria-labelledby="ps-tag">
          <h3 id="ps-tag" className="invite-or-title">
            <Localized k="settings.interface.community_tag_4f99271" />
          </h3>
          {tagged.length === 0 ? (
            <small className="faint">
              <Localized k="settings.interface.none_of_your_communities_has_a_tag_yet_owners_and_admins_add_one_346beec" />
            </small>
          ) : (
            <div className="tag-tiles" role="group" aria-labelledby="ps-tag">
              <button type="button" className="tag-tile" aria-pressed={!style.tagOrgId} onClick={() => setStyle({ tagOrgId: null })}>
                {l10n("settings.ap_none")}
              </button>
              {tagged.map((o) => (
                <button key={o.id} type="button" className="tag-tile" aria-pressed={style.tagOrgId === o.id} onClick={() => setStyle({ tagOrgId: o.id })}>
                  <WornTagChip tag={{ orgId: o.id, text: o.tag, color: o.accent }} />
                  <span className="ellipsis">{o.name}</span>
                </button>
              ))}
            </div>
          )}
          {tagged.length > 0 && (
            <small className="faint">
              <Localized k="settings.interface.shown_beside_your_name_in_messages_and_member_lists_05cfd5a" />
            </small>
          )}
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
            <strong>
              <Localized k="settings.interface.avatar_decoration_76ce679" />
            </strong>
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
              <strong>
                <Localized k="settings.interface.name_style_7f99bc5" />
              </strong>
              <small className="faint">{describeNameLook(style)}</small>
            </span>
            <ChevronRight size={16} className="faint" aria-hidden="true" />
          </button>
        )}
      </div>

      <section className="setting-group" aria-labelledby="ps-fx">
        <h3 id="ps-fx" className="invite-or-title">
          <Localized k="settings.interface.banner_effect_0024523" />
        </h3>
        <div className="style-grid" role="group" aria-labelledby="ps-fx">
          {[null, ...PROFILE_EFFECTS].map((f) => (
            <button key={f ?? "none"} type="button" className="style-choice" aria-pressed={style.effect === f} onClick={() => setStyle({ effect: f })}>
              <span className="swatch-fx">
                <ProfileEffect effect={f} />
              </span>
              {f ? EFFECT_LABEL[f] : l10n("settings.ap_none")}
            </button>
          ))}
        </div>
      </section>

      {themeOn && <ProfileThemePicker style={style} onSave={setStyle} />}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-secondary" disabled={saver.busy || !saver.dirty} onClick={saver.undo}>
          <Localized k="settings.interface.undo_look_change_4ab5bf2" />
        </button>
        <button
          className="btn btn-secondary"
          disabled={saver.busy || !saver.dirty}
          onClick={() => {
            saver.reset();
            reload();
          }}
        >
          <Localized k="settings.interface.reset_look_f03606d" />
        </button>
        <button className="btn btn-primary" disabled={saver.busy || !saver.dirty} onClick={() => void saver.apply()}>
          {saver.busy ? uiText("workspace.interface.applying_3329a9b") : uiText("settings.interface.apply_look_5ed04ba")}
        </button>
        {saver.dirty && (
          <small role="status">
            <Localized k="settings.interface.unsaved_look_preview_b97fa17" />
          </small>
        )}
      </div>

      {!themeOn && (
        <section className="setting-group" aria-labelledby="ps-accent">
          <h3 id="ps-accent" className="invite-or-title">
            <Localized k="settings.interface.banner_colour_4cb11b7" />
          </h3>
          <fieldset className="brand-swatches" aria-labelledby="ps-accent">
            <button
              type="button"
              className="brand-swatch meldiq"
              aria-pressed={style.accent === null}
              onClick={() => setStyle({ accent: null })}
              title={uiText("settings.interface.your_avatar_s_colour_34d16e5")}
            >
              <span className="sr-only">
                <Localized k="settings.interface.your_avatar_s_colour_34d16e5" />
              </span>
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
