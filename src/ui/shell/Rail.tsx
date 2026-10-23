import { AtSign, Bookmark, House, MessagesSquare } from "lucide-react";
import { shallowEqual, useOrbit } from "../../application/orbit";
import { setPrefs } from "../../application/prefs";
import { navigate, type Section } from "../../application/router";
import { BrandMark } from "../components/BrandMark";
import { OrgAvatar } from "../components/OrgAvatar";
import { useIncomingRequestCount } from "../people/connectionRequests";
import { laterDue, mentionCount, orgUnread, unreadPeopleCount } from "../selectors";
import { useT } from "../../i18n";

/**
 * The logo (direct messages) and the communities, then DMs, Activity and Later, as on Discord: a community opens its
 * channels, so there's no Home button unless there's no community to open.
 */
export function Rail({ orgId, section }: { orgId: string | null; section: Section }) {
  const orgs = useOrbit(
    (s) => s.orgs.map((o) => ({ id: o.id, name: o.name, photoRev: o.photoRev, unread: orgUnread(s, o.id) })),
    (a, b) => a.length === b.length && a.every((x, i) => shallowEqual(x, b[i])),
  );
  // Unread DMs and people waiting for an answer to their connection request.
  const dms = useOrbit(unreadPeopleCount) + useIncomingRequestCount();
  const mentions = useOrbit(mentionCount);
  const later = useOrbit(laterDue);
  const t = useT();
  const nav = [
    // As on Discord, a community in the rail is its home, so Home is shown only to people in no community.
    ...(orgs.length === 0 ? [{ key: "home" as const, label: t("nav_home"), icon: <House />, count: 0 }] : []),
    { key: "dms" as const, label: t("nav_dms"), icon: <MessagesSquare />, count: dms },
    { key: "activity" as const, label: t("nav_activity"), icon: <AtSign />, count: mentions },
    { key: "later" as const, label: t("nav_later"), icon: <Bookmark />, count: later },
  ];
  return (
    <nav className="rail" aria-label="Workspaces and sections">
      {/* Discord's top button: your direct messages. */}
      <a className="rail-logo" href="/dms" aria-label={t("side_direct_messages")}>
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
        <a key={n.key} href={`/${n.key}`} className="rail-nav" aria-current={section === n.key ? "page" : undefined} aria-label={`${n.label}${n.count ? `, ${t("nav_unread", { n: n.count })}` : ""}`}>
          <span className="rail-icon">{n.icon}</span>
          {n.label}
          {n.count > 0 && <span className="count accent">{n.count > 99 ? "99+" : n.count}</span>}
        </a>
      ))}
      <div className="rail-spacer" />
    </nav>
  );
}
