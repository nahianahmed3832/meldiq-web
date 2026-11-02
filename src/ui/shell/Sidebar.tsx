import { CheckCheck, ChevronDown, Compass, Link2, LogIn, PenSquare, Plus, Search, Settings2, Ticket, UsersRound } from "lucide-react";
import { type MouseEvent, useLayoutEffect, useRef } from "react";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { markAllReadTargets } from "../selectors";
import { setPrefs, usePrefs } from "../../application/prefs";
import { navigate, type Section } from "../../application/router";
import { Avatar } from "../components/Avatar";
import { OrgAvatar } from "../components/OrgAvatar";
import { keepsNativeMenu, Menu, type MenuEntry, useMenu } from "../components/Overlay";
import { members } from "../format";
import type { ShellDialog } from "./Shell";
import { ArchivedList, ChannelSections, Collapsible, DmHub, PeopleExtras, PeopleList, PersonalSections, SkeletonRows } from "./SidebarSections";
import { VoiceRoomsSection } from "./VoiceRooms";
import { CommunityHeader, hideMutedKey } from "../community/CommunityHeader";
import { SparkGoal } from "../mojo/SparkGoal";
import { useCommunityMenu } from "../community/communityMenu";
import { CommunityPanel } from "../community/CommunityPanel";
import { ACCENT_CLASS, accentStyle, tintStyle } from "../community/accent";
import { useCommunityThemes } from "../community/useCommunityThemes";
import { usePhoto } from "../components/photos";
import { useCommunityDetail } from "../community/useCommunityPermissions";
import { useT } from "../../i18n";
import { ConnectedCallPanel } from "../call/ConnectedCallPanel";
import { LobbyRow } from "../lobby/LobbyRow";

interface SidebarProps {
  orgId: string | null;
  section: Section;
  open: boolean;
  onDialog: (d: ShellDialog) => void;
}

export function Sidebar({ orgId, section, open, onDialog }: SidebarProps) {
  const org = useOrbit((s) => s.orgs.find((o) => o.id === orgId) ?? null);
  const orgs = useOrbit((s) => s.orgs);
  const synced = useOrbit((s) => s.synced);
  const empty = useOrbit((s) => Object.keys(s.conversations).length === 0);
  // Until the server's features are known (cached from the last visit, else server-info), the layout isn't: a skeleton
  // rather than the older workspace layout, which would list categories alphabetically for a moment (brief v4 §15).
  const layoutKnown = useOrbit((s) => s.server !== null);
  const engine = useEngine();
  const readTargets = useOrbit((s) => markAllReadTargets(s, orgId), shallowEqual);
  const switcher = useMenu();
  const prefs = usePrefs();
  const unreadOnly = prefs.collapsed.includes("::unread-only");
  // Community servers (API 0.12+): categories, a channel panel and the community menu (android CommunityHomeScreen).
  const communities = useOrbit((s) => s.server?.features.includes("community-channels") ?? false);
  const { perms } = useCommunityDetail(communities ? orgId : null);
  const hideMuted = !!orgId && prefs.collapsed.includes(hideMutedKey(orgId));
  const hasConnections = useOrbit((s) => s.server?.features.includes("connections") ?? false);
  const t = useT();
  // Home with no community yet (none joined, or the chosen one left) shows the messages hub rather than an empty list.
  // Discover has its own short list (the owner, 2026-10-29: no friends list while finding communities).
  const discover = section === "discover";
  // API 0.44.0: the community's own accent and banner, on its channel list only (never the DMs or other communities).
  const themes = useCommunityThemes();
  const branded = communities && section !== "dms" && !discover && !!org && themes.on;
  const messages = !discover && (section === "dms" || (communities && !org));
  const bannerUrl = usePhoto("banner", org?.id ?? "", branded ? org?.bannerRev : null);
  // Each community's channel list (and the messages list) keeps its scroll position when you come back to it.
  const list = useRef<HTMLDivElement>(null);
  const listKey = messages ? "dms" : (orgId ?? "none");
  // A right-click on the list's empty space: the community's menu beside its channels, or starting a conversation
  // beside the messages (rows, headings and buttons have their own).
  const blankMenu = useMenu();
  const community = useCommunityMenu(communities && !messages ? orgId : null, perms, onDialog);
  const blankEntries: MenuEntry[] =
    communities && !messages && org
      ? community.entries
      : [
          { label: t("side_new_message"), icon: <Plus size={16} />, onSelect: () => onDialog({ kind: "new" }) },
          { label: "New group", icon: <UsersRound size={16} />, onSelect: () => onDialog({ kind: "newGroup" }) },
        ];
  const onBlankMenu = (e: MouseEvent<HTMLDivElement>) => {
    if (keepsNativeMenu(e.target) || (e.target as HTMLElement).closest("button, a, [role='button'], .side-row, .side-item, .side-section-row, summary")) return;
    e.preventDefault();
    blankMenu.openAt(e.currentTarget, e);
  };
  useLayoutEffect(() => {
    if (list.current) list.current.scrollTop = scrollMemory.get(listKey) ?? 0;
  }, [listKey]);

  return (
    <aside
      className={`sidebar${communities && !messages && !discover ? " community-sidebar" : ""}${open ? " open" : ""}${branded && org?.accent ? ` ${ACCENT_CLASS}` : ""}`}
      style={branded ? { ...accentStyle(org?.accent), ...tintStyle(org?.background) } : undefined}
      aria-label="Conversations"
    >
      <div className="side-head">
        {discover ? (
          <h2 className="side-title grow">{t("discover_title")}</h2>
        ) : messages ? (
          // Direct messages aren't part of a community: their own heading, not the community's.
          <h2 className="side-title grow">{t("side_direct_messages")}</h2>
        ) : communities ? (
          <>
            <CommunityHeader orgId={orgId} perms={perms} onDialog={onDialog} />
            {org && <SparkGoal orgId={org.id} name={org.name} compact />}
          </>
        ) : (
          <button
            className="org-switch"
            onClick={(e) => switcher.open(e.currentTarget)}
            aria-haspopup="menu"
            aria-expanded={!!switcher.anchor}
            aria-label={`Community: ${org?.name ?? "none"}. Switch community`}
          >
            {org ? <OrgAvatar orgId={org.id} name={org.name} photoRev={org.photoRev} size={34} /> : <Avatar name="Meldiq" colorIndex={7} size={34} square decorative />}
            <span className="grow">
              <strong className="ellipsis" style={{ display: "block" }}>
                {org?.name ?? "Meldiq"}
              </strong>
              <small>{org ? `${members(org.memberCount)} · ${roleLabel(org.myRole)}` : "No community yet"}</small>
            </span>
            <ChevronDown size={16} className="faint" />
          </button>
        )}
        {!communities && section !== "dms" && !discover && (
          <button className="icon-btn" onClick={() => onDialog({ kind: "new" })} aria-label={t("side_new_message")} title={t("side_new_message")}>
            <PenSquare size={18} />
          </button>
        )}
        {/* Phones have no top bar on the lists (brief v4 §18): search, and in Messages a new message, sit here. */}
        <span className="side-head-phone">
          <button className="icon-btn" onClick={() => onDialog({ kind: "search" })} aria-label="Search Meldiq" title="Search">
            <Search size={18} />
          </button>
          {messages && (
            <button className="icon-btn" onClick={() => onDialog({ kind: "new" })} aria-label={t("side_new_message")} title={t("side_new_message")}>
              <PenSquare size={18} />
            </button>
          )}
        </span>
      </div>
      {branded && !messages && bannerUrl && <div className="community-cover" role="img" aria-label={`${org?.name ?? "Community"} banner`} style={{ backgroundImage: `url(${bannerUrl})` }} />}
      {communities && !messages && !discover && org && <LobbyRow orgId={org.id} canEdit={perms.canManageOrg} current={section === "lobby"} />}
      {branded && !messages && perms.canInvite && (
        <div className="community-top">
          {perms.canInvite && (
            <button className="community-invite" onClick={() => onDialog({ kind: "addMembers" })}>
              <Link2 size={17} aria-hidden="true" /> Invite people
            </button>
          )}
        </div>
      )}
      {!communities && section !== "dms" && switcher.anchor && (
        <Menu
          anchor={switcher.anchor}
          label="Workspaces"
          onClose={switcher.close}
          entries={[
            { heading: "Your communities" },
            ...orgs.map((o) => ({
              label: o.name,
              icon: <OrgAvatar orgId={o.id} name={o.name} photoRev={o.photoRev} size={22} />,
              checked: o.id === orgId,
              onSelect: () => setPrefs({ orgId: o.id }),
            })),
            ...(orgs.length === 0 ? [{ custom: <div className="side-quiet">You're not in a community yet.</div> }] : []),
            "separator" as const,
            ...(org
              ? [
                  { label: "Community settings", icon: <Settings2 size={16} />, onSelect: () => navigate({ section: "workspace", workspacePage: "overview" }) },
                  { label: "Invite people", icon: <Ticket size={16} />, onSelect: () => navigate({ section: "workspace", workspacePage: "invitations" }) },
                  { label: "Browse channels", icon: <Compass size={16} />, onSelect: () => onDialog({ kind: "channels" }) },
                  // Round 3 (the reference's server menu "Mark As Read"): this workspace's unread channels.
                  ...(readTargets.length > 0 ? [{ label: "Mark all as read", icon: <CheckCheck size={16} />, onSelect: () => void Promise.all(readTargets.map((cid) => engine.markRead(cid))) }] : []),
                  "separator" as const,
                ]
              : []),
            { label: "Create a community", icon: <Plus size={16} />, onSelect: () => onDialog({ kind: "createWorkspace" }) },
            { label: "Join with a code", icon: <LogIn size={16} />, onSelect: () => onDialog({ kind: "joinWorkspace" }) },
          ]}
        />
      )}

      <div className="side-scroll scroll" ref={list} onScroll={(e) => scrollMemory.set(listKey, e.currentTarget.scrollTop)} onContextMenu={onBlankMenu}>
        {discover ? (
          <DiscoverSide onDialog={onDialog} />
        ) : (!synced && empty) || (!layoutKnown && !messages) ? (
          <SkeletonRows />
        ) : messages ? (
          <>
            <DmHub onDialog={(kind) => onDialog({ kind })} />
            <PeopleList twoLine={section === "dms"} />
            <ArchivedList />
          </>
        ) : (
          <>
            <PersonalSections orgId={orgId} unreadOnly={unreadOnly} />
            {communities && orgId ? (
              <CommunityPanel orgId={orgId} unreadOnly={unreadOnly} hideMuted={hideMuted} perms={perms} />
            ) : (
              <>
                <VoiceRoomsSection orgId={orgId} />
                <ChannelSections orgId={orgId} unreadOnly={unreadOnly} onBrowse={org ? () => onDialog({ kind: "channels" }) : undefined} />
              </>
            )}
            {/* Direct messages live under Home and messages (the mascot), not inside a community (the reference layout). */}
            {!communities && (
              <Collapsible id="people" title={t("side_direct_messages")}>
                <PeopleExtras onRequests={() => onDialog({ kind: "requests" })} onConnections={hasConnections ? () => onDialog({ kind: "connections" }) : undefined} onlyWhenAsked />
                <PeopleList unreadOnly={unreadOnly} orgId={orgId} excludePlaced />
                <button className="side-item" onClick={() => onDialog({ kind: "new" })}>
                  <span className="glyph">
                    <Plus size={16} />
                  </span>
                  <span className="grow">{t("side_new_message")}</span>
                </button>
                <button className="side-item" onClick={() => onDialog({ kind: "newGroup" })}>
                  <span className="glyph">
                    <UsersRound size={16} />
                  </span>
                  <span className="grow">New group</span>
                </button>
              </Collapsible>
            )}
          </>
        )}
      </div>
      <ConnectedCallPanel />
      {blankMenu.anchor && <Menu anchor={blankMenu.anchor} point={blankMenu.point} label={org && !messages ? org.name : t("side_direct_messages")} onClose={blankMenu.close} entries={blankEntries} />}
      {community.dialogs}
    </aside>
  );
}

/** Discover's side list: where you are, and the other ways into a community. */
function DiscoverSide({ onDialog }: { onDialog: (d: ShellDialog) => void }) {
  const t = useT();
  return (
    <nav className="discover-side" aria-label={t("discover_title")}>
      <button className="side-item" aria-current="page" onClick={() => navigate({ section: "discover" })}>
        <span className="glyph">
          <Compass size={16} />
        </span>
        <span className="grow">{t("discover_all")}</span>
      </button>
      <button className="side-item" onClick={() => onDialog({ kind: "joinWorkspace" })}>
        <span className="glyph">
          <LogIn size={16} />
        </span>
        <span className="grow">Join with a code</span>
      </button>
      <button className="side-item" onClick={() => onDialog({ kind: "createWorkspace" })}>
        <span className="glyph">
          <Plus size={16} />
        </span>
        <span className="grow">Start a community</span>
      </button>
    </nav>
  );
}

/** Scroll positions of the channel lists, per community: kept for this tab, so a reload opens each list where it was. */
const SCROLL_KEY = "meldiq.sideScroll";
const scrollMemory = new Map<string, number>(keptScroll());

function keptScroll(): [string, number][] {
  try {
    const kept: unknown = JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? "[]");
    return Array.isArray(kept) ? kept.filter((e): e is [string, number] => Array.isArray(e) && typeof e[0] === "string" && typeof e[1] === "number") : [];
  } catch {
    return [];
  }
}

if (typeof window !== "undefined")
  window.addEventListener("pagehide", () => {
    try {
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify([...scrollMemory]));
    } catch {
      /* storage unavailable: lists open at the top after a reload, as before */
    }
  });

function roleLabel(role: string | null): string {
  return role ? role.charAt(0) + role.slice(1).toLowerCase() : "Member";
}
