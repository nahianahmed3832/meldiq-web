import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { useOrbit } from "../../application/orbit";
import { navigate, type Section } from "../../application/router";
import { mentionCount, unreadPeopleCount } from "../selectors";
import { useIncomingRequestCount } from "../people/connectionRequests";
import { useT } from "../../i18n";
import { PRIMARY_NAVIGATION, primaryDestinationActive } from "./navigation";
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
  const tabs = [
    ...PRIMARY_NAVIGATION.filter((item) => item.section !== "discover").map((item) => ({
      key: item.section,
      label: t(item.labelKey),
      icon: <item.icon size={21} />,
      count: item.section === "dms" ? dms : item.section === "activity" ? mentions : 0,
    })),
    // You (as the Android app): your avatar, its dot your connection; your account, Saved and every setting.
    {
      key: "settings" as const,
      label: t("nav_you"),
      icon: <LookAvatar userId={me?.userId ?? ""} name={me?.displayName ?? uiText("workspace.nav_you")} colorIndex={me?.avatarColor ?? 0} photoRev={photoRev} size={24} online={online} />,
      count: 0,
    },
  ];
  return (
    <nav className={`tabbar${hidden ? " hidden" : ""}`} aria-label={uiText("workspace.interface.sections_9bae918")}>
      {tabs.map((t) => (
        <button
          key={t.key}
          aria-current={
            (t.key === "settings" ? section === "settings" || section === "later" : PRIMARY_NAVIGATION.some((item) => item.section === t.key && primaryDestinationActive(item, section)))
              ? "page"
              : undefined
          }
          onClick={() => navigate(t.key === "settings" ? { section: "settings", settingsPage: "you" } : { section: t.key })}
        >
          {t.icon}
          {t.label}
          {t.count > 0 && <span className="count accent">{capCount(t.count)}</span>}
        </button>
      ))}
    </nav>
  );
}
