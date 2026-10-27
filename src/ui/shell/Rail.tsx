import { CheckCheck, Compass, Hash, LogIn, LogOut, Plus, Settings2, UserPlus } from "lucide-react";
import { useRef, useState } from "react";
import { useScrollStrip } from "../components/scrollStrip";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { contextMenuProps, Menu, type MenuEntry, useMenu } from "../components/Overlay";
import { LeaveDialog } from "../community/CommunityHeader";
import { setPrefs } from "../../application/prefs";
import { navigate, type Section } from "../../application/router";
import { ACCENT_CLASS, accentStyle } from "../community/accent";
import { OrgAvatar } from "../components/OrgAvatar";
import { UnreadBadge } from "../components/UnreadBadge";
import { useIncomingRequestCount } from "../people/connectionRequests";
import { markAllReadTargets, orgActivity, unreadPeopleCount } from "../selectors";
import { capCount, isHighlighted, unreadMarker } from "../unread";
import { useT } from "../../i18n";
import type { ShellDialog } from "./Shell";

/**
 * The rail, top to bottom: the mascot (Home and messages: the DM list), the communities with their rolled-up unread
 * state, then round Create and Discover. Activity and Later live in the top bar and the sidebar (community-first brief
 * §G); their routes are unchanged.
 */
export function Rail({ orgId, section, onDialog }: { orgId: string | null; section: Section; onDialog: (d: ShellDialog) => void }) {
  const orgs = useRailOrgs();
  // Unread DMs and people waiting for an answer to their connection request.
  const dms = useOrbit(unreadPeopleCount) + useIncomingRequestCount();
  const t = useT();
  const home = section === "dms";
  const discovering = section === "discover";
  const homeLabel = `${t("rail_home")}${dms ? `, ${t("nav_unread", { n: dms })}` : ""}`;
  const strip = useRef<HTMLElement>(null);
  useScrollStrip(strip, "vertical", `${section}:${orgId}`);
  return (
    <nav className="rail" aria-label={t("rail_label")} ref={strip}>
      <a className="rail-home" href="/dms" aria-current={home ? "page" : undefined} aria-label={homeLabel} title={t("rail_home")}>
        <img className="rail-mascot" src="/meldling-96.webp" srcSet="/meldling-96.webp 96w, /meldling-192.webp 192w" sizes="46px" width={46} height={46} alt="" draggable={false} />
        {dms > 0 && (
          <span className="count accent" aria-hidden="true">
            {capCount(dms)}
          </span>
        )}
      </a>
      <div className="rail-sep" />
      {orgs.length > 0 && (
        <div role="group" aria-label={t("rail_communities")} className="rail-orgs">
          {orgs.map((o) => {
            // Direct messages belong to no community, so none is selected there (as on Discord).
            const selected = !home && !discovering && o.id === orgId;
            return <CommunityButton key={o.id} org={o} selected={selected} size={44} onDialog={onDialog} />;
          })}
        </div>
      )}
      <button className="rail-round" onClick={() => onDialog({ kind: "createWorkspace" })} aria-label={t("rail_create")} title={t("rail_create")}>
        <Plus size={22} aria-hidden="true" />
      </button>
      <a className="rail-round" href="/discover" aria-current={discovering ? "page" : undefined} aria-label={t("rail_discover")} title={t("rail_discover")}>
        <Compass size={22} aria-hidden="true" />
      </a>
      <div className="rail-spacer" />
    </nav>
  );
}

type RailOrg = { id: string; name: string; photoRev: number | null; accent: string | null; myRole: string | null; unread: number; mentions: number };

/** The communities in rail order, with their rolled-up unread activity. */
function useRailOrgs(): RailOrg[] {
  return useOrbit(
    (s) => s.orgs.map((o) => ({ id: o.id, name: o.name, photoRev: o.photoRev, accent: o.accent, myRole: o.myRole, ...orgActivity(s, o.id) })),
    (a, b) => a.length === b.length && a.every((x, i) => shallowEqual(x, b[i])),
  );
}

/**
 * One community's icon: selects it and opens its channels (from DMs too); its side marker and badge say what's new.
 * A right-click (or the Menu key) opens its menu: open, invite, mark as read, settings, copy its id, leave.
 */
function CommunityButton({ org: o, selected, size, onDialog }: { org: RailOrg; selected: boolean; size: number; onDialog: (d: ShellDialog) => void }) {
  const t = useT();
  const engine = useEngine();
  const menu = useMenu();
  const [leaving, setLeaving] = useState(false);
  const readTargets = useOrbit((s) => (menu.anchor ? markAllReadTargets(s, o.id) : []), shallowEqual);
  const marker = unreadMarker(o.unread, o.mentions, false);
  const label = `${o.name}${o.mentions ? `, ${t("rail_mentions", { n: o.mentions })}` : ""}${o.unread ? `, ${t("nav_unread", { n: o.unread })}` : ""}`;
  const openIt = () => {
    setPrefs({ orgId: o.id });
    navigate({ section: "home" });
  };
  const entries: MenuEntry[] = [
    { label: "Open", icon: <LogIn size={16} />, onSelect: openIt },
    ...(o.myRole && o.myRole !== "GUEST"
      ? [
          {
            label: "Invite people",
            icon: <UserPlus size={16} />,
            onSelect: () => onDialog({ kind: "addMembers", orgId: o.id }),
          },
        ]
      : []),
    ...(readTargets.length > 0 ? [{ label: "Mark all as read", icon: <CheckCheck size={16} />, onSelect: () => void Promise.all(readTargets.map((c) => engine.markRead(c))) }] : []),
    {
      label: "Community settings",
      icon: <Settings2 size={16} />,
      onSelect: () => {
        setPrefs({ orgId: o.id });
        navigate({ section: "workspace", workspacePage: "overview" });
      },
    },
    "separator",
    {
      label: "Copy community ID",
      icon: <Hash size={16} />,
      onSelect: () => {
        void navigator.clipboard?.writeText(o.id).catch(() => undefined);
        engine.notice("info", "Community ID copied.");
      },
    },
    ...(o.myRole !== "OWNER" ? ["separator" as const, { label: "Leave community…", icon: <LogOut size={16} />, danger: true, onSelect: () => setLeaving(true) }] : []),
  ];
  return (
    <>
      <button
        className={`rail-org${isHighlighted(marker) ? " unread" : ""}${o.accent ? ` ${ACCENT_CLASS}` : ""}`}
        style={accentStyle(o.accent)}
        aria-current={selected}
        title={o.name}
        aria-label={label}
        aria-haspopup="menu"
        onClick={openIt}
        {...contextMenuProps(menu.openAt)}
      >
        <OrgAvatar orgId={o.id} name={o.name} photoRev={o.photoRev} size={size} />
        {!selected && <UnreadBadge marker={marker} />}
      </button>
      {menu.anchor && <Menu anchor={menu.anchor} point={menu.point} label={o.name} onClose={menu.close} entries={entries} />}
      {leaving && <LeaveDialog orgId={o.id} name={o.name} onClose={() => setLeaving(false)} />}
    </>
  );
}

/**
 * Phones have no rail (the tab bar takes its place): this strip at the top of the conversation list carries the same
 * communities and the round Create and Discover, scrolling sideways when there are many.
 */
export function PhoneRail({ orgId, onDialog }: { orgId: string | null; onDialog: (d: ShellDialog) => void }) {
  const orgs = useRailOrgs();
  const t = useT();
  const strip = useRef<HTMLElement>(null);
  useScrollStrip(strip, "horizontal", orgId);
  return (
    <nav className="phone-rail" aria-label={t("rail_communities")} ref={strip}>
      {orgs.map((o) => (
        <CommunityButton key={o.id} org={o} selected={o.id === orgId} size={44} onDialog={onDialog} />
      ))}
      <button className="rail-round" onClick={() => onDialog({ kind: "createWorkspace" })} aria-label={t("rail_create")} title={t("rail_create")}>
        <Plus size={22} aria-hidden="true" />
      </button>
      <a className="rail-round" href="/discover" aria-label={t("rail_discover")} title={t("rail_discover")}>
        <Compass size={22} aria-hidden="true" />
      </a>
    </nav>
  );
}
