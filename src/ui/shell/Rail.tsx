import { AtSign, House, MessagesSquare } from "lucide-react";
import { shallowEqual, useOrbit } from "../../app/orbit";
import { setPrefs } from "../../app/prefs";
import { navigate, type Section } from "../../app/router";
import { Avatar, colorIndexOf } from "../components/Avatar";
import { BrandMark } from "../components/BrandMark";
import { mentionCount, orgUnread, unreadPeopleCount } from "../selectors";

/** Workspaces (the organisation switcher), then the three sections, as on the phone's tab bar. */
export function Rail({ orgId, section }: { orgId: string | null; section: Section }) {
  const orgs = useOrbit(
    (s) => s.orgs.map((o) => ({ id: o.id, name: o.name, unread: orgUnread(s, o.id) })),
    (a, b) => a.length === b.length && a.every((x, i) => shallowEqual(x, b[i])),
  );
  const dms = useOrbit(unreadPeopleCount);
  const mentions = useOrbit(mentionCount);
  const nav = [
    { key: "home" as const, label: "Home", icon: <House />, count: 0 },
    { key: "dms" as const, label: "DMs", icon: <MessagesSquare />, count: dms },
    { key: "activity" as const, label: "Activity", icon: <AtSign />, count: mentions },
  ];
  return (
    <nav className="rail" aria-label="Workspaces and sections">
      <a className="rail-logo" href="#/home" aria-label="Meldiq home">
        <BrandMark size={40} />
      </a>
      {orgs.length > 0 && (
        <div role="group" aria-label="Workspaces" style={{ display: "grid", gap: 10, justifyItems: "center", marginTop: 4 }}>
          {orgs.map((o) => (
            <button
              key={o.id}
              className="rail-org"
              aria-current={o.id === orgId}
              title={o.name}
              aria-label={`${o.name}${o.unread ? `, ${o.unread} channels with unread messages` : ""}`}
              onClick={() => {
                setPrefs({ orgId: o.id });
                navigate({ section: section === "dms" ? "dms" : "home" });
              }}
            >
              <Avatar name={o.name} colorIndex={colorIndexOf(o.id)} size={42} square decorative />
              {o.unread > 0 && o.id !== orgId && <span className="count accent">{o.unread}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="rail-sep" />
      {nav.map((n) => (
        <a key={n.key} href={`#/${n.key}`} className="rail-nav" aria-current={section === n.key ? "page" : undefined} aria-label={`${n.label}${n.count ? `, ${n.count} unread` : ""}`}>
          <span className="rail-icon">{n.icon}</span>
          {n.label}
          {n.count > 0 && <span className="count accent">{n.count > 99 ? "99+" : n.count}</span>}
        </a>
      ))}
      <div className="rail-spacer" />
    </nav>
  );
}
