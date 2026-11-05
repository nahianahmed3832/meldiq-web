import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Menu as MenuIcon, Search } from "lucide-react";
import { useOrbit } from "../../application/orbit";
import { type Section } from "../../application/router";
import { UserAvatar } from "../components/OrgAvatar";
import { type Translate, useT } from "../../i18n";
import { useProfileMenu } from "./ProfileMenu";
interface TopBarProps {
  onMenu: () => void;
  menuOpen?: boolean;
  onSearch: () => void;
  section: Section;
  /** The community on screen, for the page title and the search box's scope. */
  orgId: string | null;
}
/**
 * The compact top bar (the floating redesign, 2026-10-28): where you are on the left, search in the middle, and
 * Activity, Saved, Settings and you on the right. On phones it steps aside where the lists carry their own headers.
 */
export function TopBar({ onMenu, menuOpen = false, onSearch, section, orgId }: TopBarProps) {
  useLocaleRender();
  const t = useT();
  const orgName = useOrbit((s) => (orgId ? (s.orgs.find((o) => o.id === orgId)?.name ?? null) : null));
  const inCommunity = (section === "home" || section === "workspace" || section === "lobby") && !!orgName;
  const title = inCommunity ? orgName : pageTitle(section, t);
  const searchLabel = inCommunity ? t("conv_search_in", { name: orgName }) : t("search_placeholder");
  const me = useOrbit((s) => s.me);
  const myPhoto = useOrbit((s) => (s.me ? s.users[s.me.userId]?.photoRev : null));
  const connection = useOrbit((s) => s.connection);
  const profile = useProfileMenu();
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-btn menu-toggle" onClick={onMenu} aria-expanded={menuOpen} aria-label={uiText("workspace.interface.show_conversations_a50e7d6")}>
          <MenuIcon size={19} />
        </button>
        <span className="topbar-title ellipsis" title={title}>
          {title}
        </span>
      </div>
      <button className="searchbox" onClick={onSearch} aria-label={uiText("workspace.interface.search_meldiq_7c5a6e1")} aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}>
        <Search size={16} />
        <span className="ellipsis">{searchLabel}</span>
        <kbd className="kbd">{mac ? "⌘K" : uiText("workspace.interface.ctrl_k_854f7b2")}</kbd>
      </button>
      <div className="topbar-right">
        <button
          className="me-btn"
          onClick={(e) => profile.open(e.currentTarget)}
          aria-label={uiText("workspace.interface.your_profile_and_settings_44120f0")}
          aria-haspopup="menu"
          aria-expanded={profile.expanded}
        >
          <UserAvatar
            userId={me?.userId ?? ""}
            name={me?.displayName ?? uiText("organization.interface.me_d30af07")}
            colorIndex={me?.avatarColor ?? 0}
            photoRev={myPhoto}
            size={32}
            online={connection === "online"}
            decorative
          />
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
