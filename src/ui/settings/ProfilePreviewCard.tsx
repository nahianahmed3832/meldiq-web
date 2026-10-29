import { useEngine, useOrbit } from "../../application/orbit";
import { userProfile } from "../../sync/account";
import { usePhoto } from "../components/photos";
import { StyledName } from "../people/NameStyle";
import { ProfileEffect, StyledAvatar } from "../people/ProfileStyle";
import { useLoad } from "../workspace/useLoad";
import { NO_STYLE } from "./noStyle";
import { useProfileDraft } from "./profileDraft";

/**
 * Settings › My Profile's right column (the reference, 2026-10-29): your profile card as others see it, following what
 * you type and pick before it's saved. Sticky, so it stays in view while the editor scrolls.
 */
export function ProfilePreviewCard() {
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const photoRev = useOrbit((s) => (s.me ? (s.users[s.me.userId]?.photoRev ?? null) : null));
  const profilesRev = useOrbit((s) => s.profilesRev);
  const profile = useLoad(() => (me ? userProfile(engine, me.userId) : Promise.resolve(null)), [engine, me?.userId, profilesRev]);
  const draft = useProfileDraft()?.draft;
  const p = profile.data;
  const bannerKind = p?.profileBanner?.kind;
  const bannerUrl = usePhoto("profileBanner", me?.userId ?? "", p?.profileBanner?.rev, bannerKind === "gif" ? "image/gif" : bannerKind === "webp" ? "image/webp" : "image/jpeg");
  if (!me) return null;
  const style = draft?.style ?? p?.profileStyle ?? NO_STYLE;
  const name = draft?.displayName || me.displayName;
  const pronouns = draft?.pronouns ?? "";
  const about = draft?.aboutMe ?? "";

  return (
    <aside className="profile-preview" aria-label="Preview">
      <div className="settings-label">Preview</div>
      <div className="profile-pop style-preview card">
        <div className="profile-pop-banner" style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : { background: style.accent ?? "var(--brand-gradient)" }}>
          <ProfileEffect effect={style.effect} />
        </div>
        <div className="profile-pop-avatar">
          <StyledAvatar userId={me.userId} name={name} colorIndex={me.avatarColor} photoRev={photoRev} media={p?.avatarMedia ?? null} decoration={style.decoration} size={84} />
        </div>
        <div className="profile-pop-body">
          <h3 className="profile-pop-name ellipsis" style={{ fontSize: 19 }}>
            <StyledName name={name} style={style} className="ellipsis" />
          </h3>
          <p className="profile-pop-handle">
            @{me.username}
            {pronouns && <span className="faint"> · {pronouns}</span>}
          </p>
          {about && <p className="profile-preview-about">{about}</p>}
        </div>
      </div>
    </aside>
  );
}
