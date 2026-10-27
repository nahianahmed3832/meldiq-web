import { Clapperboard, ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { PROFILE_DECORATIONS, PROFILE_EFFECTS } from "../../api/schemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { removeAvatarMedia, removeProfileBanner, setAvatarMedia, setProfileBanner, setProfileStyle, userProfile } from "../../sync/account";
import { ACCENT_PRESETS } from "../community/accent";
import { usePhoto } from "../components/photos";
import { DECORATION_LABEL, EFFECT_LABEL, ProfileEffect, StyledAvatar } from "../people/ProfileStyle";
import { bannerJpeg } from "../workspace/photo";
import { useLoad } from "../workspace/useLoad";

/** What the server accepts (server PROFILE_MEDIA_LIMITS): said before upload, and checked again there. */
const LIMITS = { avatarImageMb: 4, clipMb: 12, clipSeconds: 6, bannerAnimatedMb: 6 };

/**
 * Settings › Profile › Profile style (continuation brief v3 §10, API 0.45.0): an animated avatar (GIF, WebP, or a short
 * video clip the server turns into a 3 s silent loop), a banner (still or animated), a decoration, an effect and an
 * accent, with a live preview. Each change saves at once; uploads say what's happening and what went wrong. Who sees
 * the avatar and banner follows the photo's setting under Privacy.
 */
export function ProfileStyleCard() {
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const photoRev = useOrbit((s) => (s.me ? (s.users[s.me.userId]?.photoRev ?? null) : null));
  const profilesRev = useOrbit((s) => s.profilesRev);
  const [version, setVersion] = useState(0);
  const profile = useLoad(() => (me ? userProfile(engine, me.userId) : Promise.resolve(null)), [engine, me?.userId, version, profilesRev]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);
  const p = profile.data;
  const style = p?.profileStyle ?? { decoration: null, effect: null, accent: null, nameFont: null, nameColors: null, nameEffect: null, tagOrgId: null };
  const bannerKind = p?.profileBanner?.kind;
  const bannerUrl = usePhoto("profileBanner", me?.userId ?? "", p?.profileBanner?.rev, bannerKind === "gif" ? "image/gif" : bannerKind === "webp" ? "image/webp" : "image/jpeg");

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
  const setStyle = (change: { decoration?: string | null; effect?: string | null; accent?: string | null }) => void run("Saving…", () => setProfileStyle(engine, change));

  useEffect(() => {
    if (avatarInput.current) avatarInput.current.value = "";
    if (bannerInput.current) bannerInput.current.value = "";
  }, [version]);

  if (!me) return null;
  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 18 }} aria-label="Profile style">
      <div>
        <h2 style={{ margin: 0, fontSize: 17 }}>Profile style</h2>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          An animated avatar, a banner, a frame and an effect for your profile card. The avatar and banner are shown to whoever may see your photo (Privacy).
        </p>
      </div>

      <div className="profile-pop style-preview card" aria-label="Preview">
        <div className="profile-pop-banner" style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : { background: style.accent ?? "var(--brand-gradient)" }}>
          <ProfileEffect effect={style.effect} />
        </div>
        <div className="profile-pop-avatar">
          <StyledAvatar userId={me.userId} name={me.displayName} colorIndex={me.avatarColor} photoRev={photoRev} media={p?.avatarMedia ?? null} decoration={style.decoration} size={84} />
        </div>
        <div className="profile-pop-body">
          <h3 className="profile-pop-name ellipsis" style={{ fontSize: 19 }}>
            {me.displayName}
          </h3>
          <p className="profile-pop-handle">@{me.username}</p>
        </div>
      </div>

      {error && (
        <div className="banner danger" role="alert">
          {error}
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

      <section className="setting-group" aria-labelledby="ps-deco">
        <h3 id="ps-deco" className="invite-or-title">
          Avatar frame
        </h3>
        <div className="style-grid" role="group" aria-labelledby="ps-deco">
          {[null, ...PROFILE_DECORATIONS].map((d) => (
            <button key={d ?? "none"} type="button" className="style-choice" aria-pressed={style.decoration === d} disabled={!!busy} onClick={() => setStyle({ decoration: d })}>
              <StyledAvatar userId={me.userId} name={me.displayName} colorIndex={me.avatarColor} photoRev={photoRev} media={null} decoration={d} size={40} />
              {d ? DECORATION_LABEL[d] : "None"}
            </button>
          ))}
        </div>
      </section>

      <section className="setting-group" aria-labelledby="ps-fx">
        <h3 id="ps-fx" className="invite-or-title">
          Banner effect
        </h3>
        <div className="style-grid" role="group" aria-labelledby="ps-fx">
          {[null, ...PROFILE_EFFECTS].map((f) => (
            <button key={f ?? "none"} type="button" className="style-choice" aria-pressed={style.effect === f} disabled={!!busy} onClick={() => setStyle({ effect: f })}>
              <span className="swatch-fx">
                <ProfileEffect effect={f} />
              </span>
              {f ? EFFECT_LABEL[f] : "None"}
            </button>
          ))}
        </div>
      </section>

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
    </div>
  );
}
