import { AtSign, House, Settings } from "lucide-react";
import { useOrbit } from "../../application/orbit";
import { navigate, type Section } from "../../application/router";
import { mentionCount, unreadPeopleCount } from "../selectors";
import { useIncomingRequestCount } from "../people/connectionRequests";
import { useT } from "../../i18n";
import { capCount } from "../unread";

/** Phones: the bottom tab bar (hidden inside a conversation, like the phone app). */
export function TabBar({ section, hidden }: { section: Section; hidden: boolean }) {
  // Unread DMs and people waiting for an answer to their connection request, as on the rail.
  const dms = useOrbit(unreadPeopleCount) + useIncomingRequestCount();
  const mentions = useOrbit(mentionCount);
  const t = useT();
  const tabs = [
    { key: "home" as const, label: t("nav_home"), icon: <House size={21} />, count: 0 },
    // The mascot is the messages entry here too (community-first brief §G).
    { key: "dms" as const, label: t("nav_messages"), icon: <img className="tab-mascot" src="/meldling-96.webp" width={24} height={24} alt="" draggable={false} />, count: dms },
    { key: "activity" as const, label: t("nav_activity"), icon: <AtSign size={21} />, count: mentions },
    { key: "settings" as const, label: t("nav_settings"), icon: <Settings size={21} />, count: 0 },
  ];
  return (
    <nav className={`tabbar${hidden ? " hidden" : ""}`} aria-label="Sections">
      {tabs.map((t) => (
        <button key={t.key} aria-current={section === t.key ? "page" : undefined} onClick={() => navigate({ section: t.key })}>
          {t.icon}
          {t.label}
          {t.count > 0 && <span className="count accent">{capCount(t.count)}</span>}
        </button>
      ))}
    </nav>
  );
}
