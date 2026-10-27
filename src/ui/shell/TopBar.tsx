import { Bell, Bookmark, Menu as MenuIcon, Search, Settings } from "lucide-react";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate, type Section } from "../../application/router";
import { UserAvatar } from "../components/OrgAvatar";
import { laterDue, mentionCount } from "../selectors";
import { capCount } from "../unread";
import { useT } from "../../i18n";
import { useProfileMenu } from "./ProfileMenu";

export const CONN_LABEL = { online: "Online", connecting: "Connecting…", reconnecting: "Reconnecting…", offline: "Offline" } as const;

export function TopBar({ onMenu, onSearch, section }: { onMenu: () => void; onSearch: () => void; section: Section }) {
  const engine = useEngine();
  const t = useT();
  const me = useOrbit((s) => s.me);
  const myPhoto = useOrbit((s) => (s.me ? s.users[s.me.userId]?.photoRev : null));
  const connection = useOrbit((s) => s.connection);
  const mentions = useOrbit(mentionCount);
  const due = useOrbit(laterDue);
  const profile = useProfileMenu();
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-btn menu-toggle" onClick={onMenu} aria-label="Show conversations">
          <MenuIcon size={19} />
        </button>
      </div>
      <button className="searchbox" onClick={onSearch} aria-label="Search Meldiq" aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}>
        <Search size={16} />
        <span>{t("search_placeholder")}</span>
        <kbd className="kbd">{mac ? "⌘K" : "Ctrl K"}</kbd>
      </button>
      <div className="topbar-right">
        <button
          className={`conn ${connection}`}
          onClick={() => connection !== "online" && engine.reconnect()}
          title={connection === "online" ? "Connected to your Meldiq server" : "Not connected. Click to reconnect now; messages you send wait and go out when the connection is back."}
          aria-live="polite"
        >
          <i aria-hidden="true" />
          <span>{CONN_LABEL[connection]}</span>
        </button>
        {/* Activity (mentions, unreads, threads, calls) and Later moved here from the rail (community-first brief §G). */}
        <button
          className="icon-btn top-count"
          onClick={() => navigate({ section: "activity" })}
          aria-current={section === "activity" ? "page" : undefined}
          aria-label={mentions ? t("top_activity_count", { n: mentions }) : t("top_activity")}
          title={t("top_activity")}
        >
          <Bell size={19} />
          {mentions > 0 && (
            <span className="count mention-count" aria-hidden="true">
              {capCount(mentions)}
            </span>
          )}
        </button>
        <button
          className="icon-btn top-count"
          onClick={() => navigate({ section: "later" })}
          aria-current={section === "later" ? "page" : undefined}
          aria-label={due ? t("top_saved_count", { n: due }) : t("top_saved")}
          title={t("top_saved")}
        >
          <Bookmark size={19} />
          {due > 0 && (
            <span className="count accent" aria-hidden="true">
              {capCount(due)}
            </span>
          )}
        </button>
        <button className="icon-btn hide-sm" onClick={() => navigate({ section: "settings", settingsPage: "notifications" })} aria-label="Settings">
          <Settings size={19} />
        </button>
        <button className="me-btn" onClick={(e) => profile.open(e.currentTarget)} aria-label="Your profile and settings" aria-haspopup="menu" aria-expanded={profile.expanded}>
          <UserAvatar userId={me?.userId ?? ""} name={me?.displayName ?? "Me"} colorIndex={me?.avatarColor ?? 0} photoRev={myPhoto} size={32} online={connection === "online"} decorative />
        </button>
        {profile.ui}
      </div>
    </header>
  );
}
