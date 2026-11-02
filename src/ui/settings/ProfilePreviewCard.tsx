import { CollectibleBanner, CollectibleBadge, collectibleCardVars } from "../people/CollectibleLayers";
import { useEngine, useOrbit } from "../../application/orbit";
import { userProfile } from "../../sync/account";
import { usePhoto } from "../components/photos";
import { StyledName } from "../people/NameStyle";
import { ProfileEffect, StyledAvatar, useReducedMotion } from "../people/ProfileStyle";
import { LevelRing } from "../people/LevelRing";
import { themeBackground, themeColorsOf, themeVars } from "../people/profileTheme";
import { useLoad } from "../workspace/useLoad";
import { NO_STYLE } from "./noStyle";
import { useProfileDraft } from "./profileDraft";
import { ProfilePins } from "../people/ProfilePins";

/**
 * Settings › My Profile's right column (the reference, 2026-10-29): your profile card as others see it, following what
 * you type and pick before it's saved. Sticky, so it stays in view while the editor scrolls.
 */
export function ProfilePreviewCard() {
  const engine = useEngine();
  const reducedMotion = useReducedMotion();
  const me = useOrbit((s) => s.me);
  const photoRev = useOrbit((s) => (s.me ? (s.users[s.me.userId]?.photoRev ?? null) : null));
  const profilesRev = useOrbit((s) => s.profilesRev);
  const profile = useLoad(() => (me ? userProfile(engine, me.userId) : Promise.resolve(null)), [engine, me?.userId, profilesRev]);
  const draft = useProfileDraft()?.draft;
  const levelsOn = useOrbit((s) => s.server?.features.includes("points") ?? false);
  const p = profile.data;
  const bannerKind = p?.profileBanner?.kind;
  const bannerUrl = usePhoto("profileBanner", me?.userId ?? "", p?.profileBanner?.rev, bannerKind === "gif" ? "image/gif" : bannerKind === "webp" ? "image/webp" : "image/jpeg");
  if (!me) return null;
  const style = draft?.style ?? p?.profileStyle ?? NO_STYLE;
  const name = draft?.displayName || me.displayName;
  const pronouns = draft?.pronouns ?? "";
  const about = draft?.aboutMe ?? "";
  const theme = themeColorsOf(style);
  const level = levelsOn ? (p?.level ?? null) : null;

  return (
    <aside className="profile-preview" aria-label="Preview">
      <div className="profile-preview-label">
        <span className="settings-label">Live preview</span>
        <span className="profile-preview-dot" aria-hidden="true" />
      </div>
      <div className={`profile-pop style-preview card${theme ? " themed" : ""}`} style={{ ...themeVars(theme), ...collectibleCardVars(style, !reducedMotion) }}>
        <div className="profile-pop-banner" style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : { background: theme ? themeBackground(theme) : "var(--brand-gradient)" }}>
          <CollectibleBanner style={style} />
          <ProfileEffect effect={style.effect} />
        </div>
        <div className="profile-pop-avatar">
          <StyledAvatar
            userId={me.userId}
            name={name}
            colorIndex={me.avatarColor}
            photoRev={photoRev}
            media={p?.avatarMedia ?? null}
            decoration={style.decoration}
            collectibles={style.collectibles}
            size={84}
          />
        </div>
        <div className="profile-pop-body">
          <h3 className="profile-pop-name ellipsis" style={{ fontSize: 19 }}>
            <StyledName name={name} style={style} mojo={p?.mojo} everyBadge className="ellipsis" />
            {level !== null && <LevelRing level={level} size={22} className="profile-level" />}
          </h3>
          <p className="profile-pop-handle">
            @{draft?.username || me.username}
            {pronouns && <span className="faint"> · {pronouns}</span>}
          </p>
          {about && <p className="profile-preview-about">{about}</p>}
          <CollectibleBadge style={style} />
          <ProfilePins pins={p?.pins ?? []} />
        </div>
      </div>
      <p className="profile-preview-hint">A preview of how you’ll appear to others.</p>
    </aside>
  );
}
