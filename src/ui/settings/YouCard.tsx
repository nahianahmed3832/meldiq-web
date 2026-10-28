import { Smile } from "lucide-react";
import { navigate } from "../../application/router";
import { useOrbit } from "../../application/orbit";
import { LookAvatar, StyledName, useUserLook } from "../people/NameStyle";
import { useProfileMenu } from "../shell/ProfileMenu";

/**
 * The top of the phone's You tab (brief v4 §18): your avatar with its status dot, your styled name and username (a tap
 * opens your profile), and Status, which opens the menu of presence, status and pausing notifications that the avatar
 * in the desktop top bar opens. Phones only (settings.css hides it elsewhere).
 */
export function YouCard() {
  const me = useOrbit((s) => s.me);
  const photoRev = useOrbit((s) => (s.me ? s.users[s.me.userId]?.photoRev : null));
  const online = useOrbit((s) => s.connection === "online");
  const look = useUserLook(me?.userId ?? "");
  const profile = useProfileMenu();
  if (!me) return null;
  return (
    <div className="you-card you-only">
      <button className="you-card-main" onClick={() => navigate({ section: "settings", settingsPage: "profile" })} aria-label={`${me.displayName}, your profile`}>
        <LookAvatar userId={me.userId} name={me.displayName} colorIndex={me.avatarColor} photoRev={photoRev} size={56} online={online} />
        <span className="you-card-lines">
          <strong className="you-card-name">
            <StyledName name={me.displayName} style={look.profileStyle} tag={look.tag} className="ellipsis" />
          </strong>
          <small className="ellipsis">@{me.username}</small>
        </span>
      </button>
      <button className="btn btn-secondary btn-sm" onClick={(e) => profile.open(e.currentTarget)} aria-haspopup="menu" aria-expanded={profile.expanded}>
        <Smile size={15} aria-hidden="true" /> Status
      </button>
      {profile.ui}
    </div>
  );
}
