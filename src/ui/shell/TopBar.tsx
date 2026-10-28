import { Bell, Bookmark, Menu as MenuIcon, Search, Settings } from "lucide-react";
import { useOrbit } from "../../application/orbit";
import { navigate, type Section } from "../../application/router";
import { UserAvatar } from "../components/OrgAvatar";
import { laterDue, mentionCount } from "../selectors";
import { capCount } from "../unread";
import { type Translate, useT } from "../../i18n";
import { useProfileMenu } from "./ProfileMenu";

interface TopBarProps {
  onMenu: () => void;
  onSearch: () => void;
  section: Section;
  /** The community on screen, for the page title and the search box's scope. */
  orgId: string | null;
}

/**
 * The compact top bar (the floating redesign, 2026-10-28): where you are on the left, search in the middle, and
 * Activity, Saved, Settings and you on the right. On phones it steps aside where the lists carry their own headers.
 */
export function TopBar({ onMenu, onSearch, section, orgId }: TopBarProps) {
  const t = useT();
  const orgName = useOrbit((s) => (orgId ? (s.orgs.find((o) => o.id === orgId)?.name ?? null) : null));
  const inCommunity = (section === "home" || section === "workspace") && !!orgName;
  const title = inCommunity ? orgName : pageTitle(section, t);
  const searchLabel = inCommunity ? t("conv_search_in", { name: orgName }) : t("search_placeholder");
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
        <span className="topbar-title ellipsis" title={title}>
          {title}
        </span>
      </div>
      <button className="searchbox" onClick={onSearch} aria-label="Search Meldiq" aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}>
        <Search size={16} />
        <span className="ellipsis">{searchLabel}</span>
        <kbd className="kbd">{mac ? "⌘K" : "Ctrl K"}</kbd>
      </button>
      <div className="topbar-right">
        {/* Activity (mentions, unreads, threads, calls) and Later moved here from the rail (community-first brief §G); phones
            have Activity as a tab and Saved under You instead (brief v4 §8: one place each). The connection shows only
            when it's down (ConnectionBanner), and as your avatar's dot. */}
        <button
          className="icon-btn top-count hide-sm"
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
          className="icon-btn top-count hide-sm"
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

/** The top bar's title outside a community: the section's own name. */
function pageTitle(section: Section, t: Translate): string {
  switch (section) {
    case "dms":
    case "friends":
      return t("nav_messages");
    case "activity":
      return t("nav_activity");
    case "later":
      return t("top_saved");
    case "discover":
      return t("discover_title");
    case "settings":
      return t("settings_title");
    default:
      return t("nav_home");
  }
}
