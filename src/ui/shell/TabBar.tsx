import { AtSign, House } from "lucide-react";
import { useOrbit } from "../../application/orbit";
import { navigate, type Section } from "../../application/router";
import { mentionCount, unreadPeopleCount } from "../selectors";
import { useIncomingRequestCount } from "../people/connectionRequests";
import { useT } from "../../i18n";
import { capCount } from "../unread";
import { LookAvatar } from "../people/NameStyle";

/** Phones: the bottom tab bar (hidden inside a conversation, like the phone app). */
export function TabBar({ section, hidden }: { section: Section; hidden: boolean }) {
  // Unread DMs and people waiting for an answer to their connection request, as on the rail.
  const dms = useOrbit(unreadPeopleCount) + useIncomingRequestCount();
  const mentions = useOrbit(mentionCount);
  const t = useT();
  const me = useOrbit((s) => s.me);
  const photoRev = useOrbit((s) => (s.me ? s.users[s.me.userId]?.photoRev : null));
  const online = useOrbit((s) => s.connection === "online");
  const tabs = [
    { key: "home" as const, label: t("nav_home"), icon: <House size={21} />, count: 0 },
    // The mascot is the messages entry here too (community-first brief §G).
    { key: "dms" as const, label: t("nav_messages"), icon: <img className="tab-mascot" src="/meldling-96.webp" width={24} height={24} alt="" draggable={false} />, count: dms },
    { key: "activity" as const, label: t("nav_activity"), icon: <AtSign size={21} />, count: mentions },
    // You (as the Android app): your avatar, its dot your connection; your account, Saved and every setting.
    {
      key: "settings" as const,
      label: t("nav_you"),
      icon: <LookAvatar userId={me?.userId ?? ""} name={me?.displayName ?? "You"} colorIndex={me?.avatarColor ?? 0} photoRev={photoRev} size={24} online={online} />,
      count: 0,
    },
  ];
  return (
    <nav className={`tabbar${hidden ? " hidden" : ""}`} aria-label="Sections">
      {tabs.map((t) => (
        <button
          key={t.key}
          aria-current={section === t.key || (t.key === "settings" && section === "later") ? "page" : undefined}
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
