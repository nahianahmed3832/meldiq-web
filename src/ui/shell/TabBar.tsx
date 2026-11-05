import { Icon } from "../icons/Icon";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { useOrbit } from "../../application/orbit";
import { navigate, type Section } from "../../application/router";
import { mentionCount, unreadPeopleCount } from "../selectors";
import { useIncomingRequestCount } from "../people/connectionRequests";
import { useT } from "../../i18n";
import { capCount } from "../unread";
import { LookAvatar } from "../people/NameStyle";
/** Phones: the bottom tab bar (hidden inside a conversation, like the phone app). */
export function TabBar({ section, hidden }: { section: Section; hidden: boolean }) {
  useLocaleRender();
  // Unread DMs and people waiting for an answer to their connection request, as on the rail.
  const dms = useOrbit(unreadPeopleCount) + useIncomingRequestCount();
  const mentions = useOrbit(mentionCount);
  const t = useT();
  const me = useOrbit((s) => s.me);
  const photoRev = useOrbit((s) => (s.me ? s.users[s.me.userId]?.photoRev : null));
  const online = useOrbit((s) => s.connection === "online");
  return (
    <nav className={`tabbar${hidden ? " hidden" : ""}`} aria-label={uiText("workspace.interface.sections_9bae918")}>
      <button aria-current={section === "home" || section === "lobby" || section === "workspace" ? "page" : undefined} onClick={() => navigate({ section: "home" })}>
        <Icon name="navigation.home" size={24} />
        {t("nav_home")}
      </button>
      <button aria-current={section === "dms" || section === "friends" ? "page" : undefined} onClick={() => navigate({ section: "dms" })}>
        <Icon name="navigation.messages" size={24} />
        {t("nav_messages")}
        {dms > 0 && <span className="count accent">{capCount(dms)}</span>}
      </button>
      <button aria-current={section === "activity" ? "page" : undefined} onClick={() => navigate({ section: "activity" })}>
        <Icon name="navigation.activity" size={24} />
        {t("nav_activity")}
        {mentions > 0 && <span className="count accent">{capCount(mentions)}</span>}
      </button>
      <button aria-current={section === "settings" || section === "later" ? "page" : undefined} onClick={() => navigate({ section: "settings", settingsPage: "you" })}>
        <LookAvatar userId={me?.userId ?? ""} name={me?.displayName ?? uiText("workspace.nav_you")} colorIndex={me?.avatarColor ?? 0} photoRev={photoRev} size={24} online={online} />
        {t("nav_you")}
      </button>
    </nav>
  );
}
