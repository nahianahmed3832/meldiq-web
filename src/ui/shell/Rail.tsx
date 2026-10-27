import { CheckCheck, Compass, LogIn, MessageSquarePlus, Plus, Settings2, UsersRound } from "lucide-react";
import { useRef, useState } from "react";
import { useScrollStrip } from "../components/scrollStrip";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { contextMenuProps, Menu, type MenuEntry, useMenu } from "../components/Overlay";
import { useCommunityMenu } from "../community/communityMenu";
import { useCommunityDetail } from "../community/useCommunityPermissions";
import { setPrefs, usePrefs } from "../../application/prefs";
import { navigate, type Section } from "../../application/router";
import { ACCENT_CLASS, accentStyle } from "../community/accent";
import { OrgAvatar } from "../components/OrgAvatar";
import { UnreadBadge } from "../components/UnreadBadge";
import { useIncomingRequestCount } from "../people/connectionRequests";
import { isMuted, isPeople, orgActivity, people, unreadOf, unreadPeopleCount } from "../selectors";
import { conversationTitle, dmPeer } from "../format";
import { GroupAvatar } from "../components/OrgAvatar";
import { LookAvatar } from "../people/NameStyle";
import { capCount, isHighlighted, unreadMarker } from "../unread";
import { useT } from "../../i18n";
import type { ShellDialog } from "./Shell";

/**
 * The rail, top to bottom: the mascot (Home and messages: the DM list), the communities with their rolled-up unread
 * state, then round Create and Discover. Activity and Later live in the top bar and the sidebar (community-first brief
 * §G); their routes are unchanged. Phones show it on the Home tab beside the channels, as the Android app does (brief v4
 * §18), without the mascot and message bubbles: Messages is a tab there.
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
  useScrollStrip(strip, `${section}:${orgId}`);
  const engine = useEngine();
  const dmTargets = useOrbit(
    (s) =>
      Object.values(s.conversations)
        .filter((c) => isPeople(c) && unreadOf(s, c.id) > 0)
        .map((c) => c.id),
    shallowEqual,
  );
  const menu = useMenu();
  const [which, setWhich] = useState<"home" | "create" | null>(null);
  const opener = (kind: "home" | "create") =>
    contextMenuProps((el, e) => {
      setWhich(kind);
      menu.openAt(el, e);
    });
  const createEntries: MenuEntry[] = [
    { label: "Start a community", icon: <Plus size={16} />, onSelect: () => onDialog({ kind: "createWorkspace" }) },
    { label: "Join with a code", icon: <LogIn size={16} />, onSelect: () => onDialog({ kind: "joinWorkspace" }) },
    { label: "Discover communities", icon: <Compass size={16} />, onSelect: () => navigate({ section: "discover" }) },
  ];
  const homeEntries: MenuEntry[] = [
    { label: "Mark all messages as read", icon: <CheckCheck size={16} />, disabled: dmTargets.length === 0, onSelect: () => void Promise.all(dmTargets.map((c) => engine.markRead(c))) },
    "separator",
    { label: "Start a conversation", icon: <MessageSquarePlus size={16} />, onSelect: () => onDialog({ kind: "new" }) },
    { label: "Create a group", icon: <UsersRound size={16} />, onSelect: () => onDialog({ kind: "newGroup" }) },
    "separator",
    { label: "Settings", icon: <Settings2 size={16} />, onSelect: () => navigate({ section: "settings", settingsPage: "profile" }) },
  ];
  return (
    <nav className="rail" aria-label={t("rail_label")} ref={strip}>
      <a className="rail-home" href="/dms" aria-current={home ? "page" : undefined} aria-label={homeLabel} title={t("rail_home")} {...opener("home")}>
        <img className="rail-mascot" src="/meldling-96.webp" srcSet="/meldling-96.webp 96w, /meldling-192.webp 192w" sizes="46px" width={46} height={46} alt="" draggable={false} />
        {dms > 0 && (
          <span className="count accent" aria-hidden="true">
            {capCount(dms)}
          </span>
        )}
      </a>
      <RailDmBubbles />
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
      <button className="rail-round" onClick={() => onDialog({ kind: "createWorkspace" })} aria-label={t("rail_create")} title={t("rail_create")} {...opener("create")}>
        <Plus size={22} aria-hidden="true" />
      </button>
      <a className="rail-round" href="/discover" aria-current={discovering ? "page" : undefined} aria-label={t("rail_discover")} title={t("rail_discover")} {...opener("create")}>
        <Compass size={22} aria-hidden="true" />
      </a>
      <div className="rail-spacer" />
      {menu.anchor && which && (
        <Menu anchor={menu.anchor} point={menu.point} label={which === "home" ? t("rail_home") : t("rail_create")} onClose={menu.close} entries={which === "home" ? homeEntries : createEntries} />
      )}
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
  const menu = useMenu();
  // The permissions behind the menu's items load only once it opens (one request per right-click, not per icon).
  const { perms } = useCommunityDetail(menu.anchor ? o.id : null);
  const community = useCommunityMenu(o.id, perms, onDialog);
  const marker = unreadMarker(o.unread, o.mentions, false);
  const ownColors = usePrefs().communityColors;
  const accent = ownColors ? o.accent : null;
  const label = `${o.name}${o.mentions ? `, ${t("rail_mentions", { n: o.mentions })}` : ""}${o.unread ? `, ${t("nav_unread", { n: o.unread })}` : ""}`;
  const openIt = () => {
    setPrefs({ orgId: o.id });
    navigate({ section: "home" });
  };
  return (
    <>
      <button
        className={`rail-org${isHighlighted(marker) ? " unread" : ""}${accent ? ` ${ACCENT_CLASS}` : ""}`}
        style={accentStyle(accent)}
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
      {menu.anchor && <Menu anchor={menu.anchor} point={menu.point} label={o.name} onClose={menu.close} entries={community.entries} />}
      {community.dialogs}
    </>
  );
}

/** At most this many people who just messaged you, as bubbles under Home (Settings › Appearance). */
const DM_BUBBLES = 5;

/**
 * People with unread direct messages or groups, as round bubbles under Home (the reference's rail): one click opens
 * the conversation. Muted ones and message requests don't show. Off in Settings › Appearance.
 */
function RailDmBubbles() {
  const on = usePrefs().railDmBubbles;
  const me = useOrbit((s) => s.me?.userId ?? "");
  const items = useOrbit(
    (s) =>
      on
        ? people(s)
            .filter((c) => unreadOf(s, c.id) > 0 && !isMuted(s, c))
            .slice(0, DM_BUBBLES)
            .map((c) => {
              const peer = c.type === "DM" ? dmPeer(c, me) : null;
              const u = peer ? s.users[peer.id] : undefined;
              return {
                id: c.id,
                type: c.type,
                title: conversationTitle(c, me, s.users),
                peerId: peer?.id ?? null,
                color: u?.avatarColor ?? peer?.avatarColor ?? 0,
                photoRev: u?.photoRev ?? null,
                groupPhoto: c.photoRev ?? null,
                unread: unreadOf(s, c.id),
              };
            })
        : [],
    (a, b) => a.length === b.length && a.every((x, i) => shallowEqual(x, b[i])),
  );
  if (!items.length) return null;
  return (
    <div className="rail-dms" role="group" aria-label="Unread messages">
      {items.map((it) => (
        <a key={it.id} className="rail-dm" href={`/dms/c/${encodeURIComponent(it.id)}`} title={it.title} aria-label={`${it.title}, ${it.unread} unread`}>
          {it.type === "DM" && it.peerId ? (
            <LookAvatar userId={it.peerId} name={it.title} colorIndex={it.color} photoRev={it.photoRev} size={44} />
          ) : (
            <GroupAvatar conversationId={it.id} name={it.title} photoRev={it.groupPhoto} size={44} />
          )}
          <span className="count accent" aria-hidden="true">
            {capCount(it.unread)}
          </span>
        </a>
      ))}
    </div>
  );
}
