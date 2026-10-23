import { AtSign, Bookmark, House, MessagesSquare } from "lucide-react";
import { shallowEqual, useOrbit } from "../../application/orbit";
import { setPrefs } from "../../application/prefs";
import { navigate, type Section } from "../../application/router";
import { BrandMark } from "../components/BrandMark";
import { OrgAvatar } from "../components/OrgAvatar";
import { laterDue, mentionCount, orgUnread, unreadPeopleCount } from "../selectors";

/** Workspaces (the organisation switcher), then the three sections, as on the phone's tab bar. */
export function Rail({ orgId, section }: { orgId: string | null; section: Section }) {
  const orgs = useOrbit(
    (s) => s.orgs.map((o) => ({ id: o.id, name: o.name, photoRev: o.photoRev, unread: orgUnread(s, o.id) })),
    (a, b) => a.length === b.length && a.every((x, i) => shallowEqual(x, b[i])),
  );
  const dms = useOrbit(unreadPeopleCount);
  const mentions = useOrbit(mentionCount);
  const later = useOrbit(laterDue);
  const nav = [
    { key: "home" as const, label: "Home", icon: <House />, count: 0 },
    { key: "dms" as const, label: "DMs", icon: <MessagesSquare />, count: dms },
    { key: "activity" as const, label: "Activity", icon: <AtSign />, count: mentions },
    { key: "later" as const, label: "Later", icon: <Bookmark />, count: later },
  ];
  return (
    <nav className="rail" aria-label="Workspaces and sections">
      <a className="rail-logo" href="/home" aria-label="Meldiq home">
        <BrandMark size={40} />
      </a>
      {orgs.length > 0 && (
        <div role="group" aria-label="Workspaces" style={{ display: "grid", gap: 10, justifyItems: "center", marginTop: 4 }}>
          {orgs.map((o) => {
            // Direct messages belong to no community, so none is selected there (as on Discord).
            const selected = section !== "dms" && o.id === orgId;
            return (
              <button
                key={o.id}
                className="rail-org"
                aria-current={selected}
                title={o.name}
                aria-label={`${o.name}${o.unread ? `, ${o.unread} channels with unread messages` : ""}`}
                onClick={() => {
                  setPrefs({ orgId: o.id });
                  // A community opens its own channels, from DMs too (it used to stay in DMs, under the community's name).
                  navigate({ section: "home" });
                }}
              >
                <OrgAvatar orgId={o.id} name={o.name} photoRev={o.photoRev} size={42} />
                {o.unread > 0 && !selected && <span className="count accent">{o.unread}</span>}
              </button>
            );
          })}
        </div>
      )}
      <div className="rail-sep" />
      {nav.map((n) => (
        <a key={n.key} href={`/${n.key}`} className="rail-nav" aria-current={section === n.key ? "page" : undefined} aria-label={`${n.label}${n.count ? `, ${n.count} unread` : ""}`}>
          <span className="rail-icon">{n.icon}</span>
          {n.label}
          {n.count > 0 && <span className="count accent">{n.count > 99 ? "99+" : n.count}</span>}
        </a>
      ))}
      <div className="rail-spacer" />
    </nav>
  );
}
