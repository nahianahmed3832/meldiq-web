import { AtSign, LogOut, RotateCw, Settings } from "lucide-react";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate, useRoute } from "../../application/router";
import { useT } from "../../i18n";
import { statusLine } from "../../sync/status";
import { currentPresence, PRESENCE_LABEL } from "../../sync/social";
import { UserAvatar } from "../components/OrgAvatar";
import { mentionCount } from "../selectors";
import { capCount } from "../unread";
import { useProfileMenu } from "./ProfileMenu";
import { CONN_LABEL } from "./TopBar";

/**
 * The bottom of the sidebar (the reference layout): you, with your presence or the connection's state (click to
 * reconnect when it's down), then Activity with the mention count, Settings and Sign out. Your name opens the profile
 * menu (status, Saved, devices, theme). Desktop only: phones keep the top bar and tab bar.
 */
export function UserPanel() {
  const engine = useEngine();
  const t = useT();
  const me = useOrbit((s) => s.me);
  const myPhoto = useOrbit((s) => (s.me ? s.users[s.me.userId]?.photoRev : null));
  const connection = useOrbit((s) => s.connection);
  const mentions = useOrbit(mentionCount);
  const section = useRoute().section;
  const profile = useProfileMenu();
  if (!me) return null;
  const now = Date.now();
  const online = connection === "online";
  const presence = PRESENCE_LABEL[currentPresence(me.presenceMode, me.presenceUntil, now)].label;
  const line = online ? (statusLine(me, now) ?? presence) : CONN_LABEL[connection];

  return (
    <div className="user-panel" data-connection={connection}>
      <button
        className="user-panel-me"
        onClick={(e) => profile.open(e.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={profile.expanded}
        aria-label={`${me.displayName}: ${line}. Your profile and settings`}
      >
        <UserAvatar userId={me.userId} name={me.displayName} colorIndex={me.avatarColor} photoRev={myPhoto} size={38} online={online} decorative />
        <span className="lines">
          <strong className="ellipsis">{me.displayName}</strong>
          <small className={`ellipsis${online ? "" : " conn-warn"}`}>{line}</small>
        </span>
      </button>
      {!online && (
        <button
          className="icon-btn user-panel-btn"
          onClick={() => engine.reconnect()}
          aria-label="Reconnect now"
          title="Not connected. Messages you send wait and go out when the connection is back. Click to reconnect now."
        >
          <RotateCw size={17} />
        </button>
      )}
      <button
        className="icon-btn user-panel-btn"
        onClick={() => navigate({ section: "activity" })}
        aria-current={section === "activity" ? "page" : undefined}
        aria-label={mentions ? t("top_activity_count", { n: mentions }) : t("top_activity")}
        title={t("top_activity")}
      >
        <AtSign size={19} />
        {mentions > 0 && (
          <span className="count mention-count" aria-hidden="true">
            {capCount(mentions)}
          </span>
        )}
      </button>
      <button className="icon-btn user-panel-btn" onClick={() => navigate({ section: "settings", settingsPage: "notifications" })} aria-label="Settings" title="Settings">
        <Settings size={19} />
      </button>
      <button className="icon-btn user-panel-btn" onClick={() => navigate({ section: "settings", settingsPage: "security" })} aria-label="Sign out of this browser" title="Sign out of this browser">
        <LogOut size={19} />
      </button>
      {profile.ui}
    </div>
  );
}
