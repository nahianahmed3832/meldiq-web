import { AtSign, House, MessagesSquare, Settings } from "lucide-react";
import { useOrbit } from "../../app/orbit";
import { navigate, type Section } from "../../app/router";
import { mentionCount, unreadPeopleCount } from "../selectors";

/** Phones: the bottom tab bar (hidden inside a conversation, like the phone app). */
export function TabBar({ section, hidden }: { section: Section; hidden: boolean }) {
  const dms = useOrbit(unreadPeopleCount);
  const mentions = useOrbit(mentionCount);
  const tabs = [
    { key: "home" as const, label: "Home", icon: <House size={21} />, count: 0 },
    { key: "dms" as const, label: "DMs", icon: <MessagesSquare size={21} />, count: dms },
    { key: "activity" as const, label: "Activity", icon: <AtSign size={21} />, count: mentions },
    { key: "settings" as const, label: "Settings", icon: <Settings size={21} />, count: 0 },
  ];
  return (
    <nav className={`tabbar${hidden ? " hidden" : ""}`} aria-label="Sections">
      {tabs.map((t) => (
        <button key={t.key} aria-current={section === t.key ? "page" : undefined} onClick={() => navigate({ section: t.key })}>
          {t.icon}
          {t.label}
          {t.count > 0 && <span className="count accent">{t.count}</span>}
        </button>
      ))}
    </nav>
  );
}
