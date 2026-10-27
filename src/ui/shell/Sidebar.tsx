import { CheckCheck, ChevronDown, Compass, Link2, LogIn, PenSquare, Plus, Settings2, Ticket, UsersRound } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { markAllReadTargets } from "../selectors";
import { setPrefs, usePrefs } from "../../application/prefs";
import { navigate, type Section } from "../../application/router";
import { Avatar } from "../components/Avatar";
import { OrgAvatar } from "../components/OrgAvatar";
import { Menu, useMenu } from "../components/Overlay";
import { members } from "../format";
import type { ShellDialog } from "./Shell";
import { ArchivedList, ChannelSections, Collapsible, DmHub, PeopleExtras, PeopleList, PersonalSections, SkeletonRows } from "./SidebarSections";
import { VoiceRoomsSection } from "./VoiceRooms";
import { PhoneRail } from "./Rail";
import { CommunityHeader, hideMutedKey } from "../community/CommunityHeader";
import { CommunityPanel } from "../community/CommunityPanel";
import { ACCENT_CLASS, accentStyle } from "../community/accent";
import { usePhoto } from "../components/photos";
import { useCommunityDetail } from "../community/useCommunityPermissions";
import { useT } from "../../i18n";
import { UserPanel } from "./UserPanel";

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
  // API 0.44.0: the community's own accent and banner, on its channel list only (never the DMs or other communities).
  const branded = communities && section !== "dms" && !!org;
  // Home with no community yet (none joined, or the chosen one left) shows the messages hub rather than an empty list.
  const messages = section === "dms" || (communities && !org);
  const bannerUrl = usePhoto("banner", org?.id ?? "", branded ? org?.bannerRev : null);
  // Each community's channel list (and the messages list) keeps its scroll position when you come back to it.
  const list = useRef<HTMLDivElement>(null);
  const listKey = messages ? "dms" : (orgId ?? "none");
  useLayoutEffect(() => {
    if (list.current) list.current.scrollTop = scrollMemory.get(listKey) ?? 0;
  }, [listKey]);

  return (
    <aside className={`sidebar${open ? " open" : ""}${branded && org?.accent ? ` ${ACCENT_CLASS}` : ""}`} style={branded ? accentStyle(org?.accent) : undefined} aria-label="Conversations">
      {section !== "dms" && <PhoneRail orgId={orgId} onDialog={onDialog} />}
      <div className="side-head">
        {messages ? (
          // Direct messages aren't part of a community: their own heading, not the community's.
          <h2 className="side-title grow">{t("side_direct_messages")}</h2>
        ) : communities ? (
          <CommunityHeader orgId={orgId} perms={perms} onDialog={onDialog} />
        ) : (
          <button
            className="org-switch"
            onClick={(e) => switcher.open(e.currentTarget)}
            aria-haspopup="menu"
            aria-expanded={!!switcher.anchor}
            aria-label={`Workspace: ${org?.name ?? "none"}. Switch workspace`}
          >
            {org ? <OrgAvatar orgId={org.id} name={org.name} photoRev={org.photoRev} size={34} /> : <Avatar name="Meldiq" colorIndex={7} size={34} square decorative />}
            <span className="grow">
              <strong className="ellipsis" style={{ display: "block" }}>
                {org?.name ?? "Meldiq"}
              </strong>
              <small>{org ? `${members(org.memberCount)} · ${roleLabel(org.myRole)}` : "No workspace yet"}</small>
            </span>
            <ChevronDown size={16} className="faint" />
          </button>
        )}
        {!communities && section !== "dms" && (
          <button className="icon-btn" onClick={() => onDialog({ kind: "new" })} aria-label={t("side_new_message")} title={t("side_new_message")}>
            <PenSquare size={18} />
          </button>
        )}
      </div>
      {branded && !messages && (bannerUrl || perms.canInvite) && (
        <div className="community-top">
          {bannerUrl && <div className="community-banner" style={{ backgroundImage: `url(${bannerUrl})` }} role="img" aria-label={`${org?.name ?? "Community"} banner`} />}
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
            { heading: "Your workspaces" },
            ...orgs.map((o) => ({
              label: o.name,
              icon: <OrgAvatar orgId={o.id} name={o.name} photoRev={o.photoRev} size={22} />,
              checked: o.id === orgId,
              onSelect: () => setPrefs({ orgId: o.id }),
            })),
            ...(orgs.length === 0 ? [{ custom: <div className="side-quiet">You're not in a workspace yet.</div> }] : []),
            "separator" as const,
            ...(org
              ? [
                  { label: "Workspace settings", icon: <Settings2 size={16} />, onSelect: () => navigate({ section: "workspace", workspacePage: "overview" }) },
                  { label: "Invite people", icon: <Ticket size={16} />, onSelect: () => navigate({ section: "workspace", workspacePage: "invitations" }) },
                  { label: "Browse channels", icon: <Compass size={16} />, onSelect: () => onDialog({ kind: "channels" }) },
                  // Round 3 (the reference's server menu "Mark As Read"): this workspace's unread channels.
                  ...(readTargets.length > 0 ? [{ label: "Mark all as read", icon: <CheckCheck size={16} />, onSelect: () => void Promise.all(readTargets.map((cid) => engine.markRead(cid))) }] : []),
                  "separator" as const,
                ]
              : []),
            { label: "Create a workspace", icon: <Plus size={16} />, onSelect: () => onDialog({ kind: "createWorkspace" }) },
            { label: "Join with a code", icon: <LogIn size={16} />, onSelect: () => onDialog({ kind: "joinWorkspace" }) },
          ]}
        />
      )}

      <div className="side-scroll scroll" ref={list} onScroll={(e) => scrollMemory.set(listKey, e.currentTarget.scrollTop)}>
        {!synced && empty ? (
          <SkeletonRows />
        ) : messages ? (
          <>
            <DmHub onDialog={(kind) => onDialog({ kind })} onInvite={(id) => onDialog({ kind: "addMembers", orgId: id })} onCreate={() => onDialog({ kind: "createWorkspace" })} />
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
      <UserPanel />
    </aside>
  );
}

/** Scroll positions of the channel lists, per community, for this page's life. */
const scrollMemory = new Map<string, number>();

function roleLabel(role: string | null): string {
  return role ? role.charAt(0) + role.slice(1).toLowerCase() : "Member";
}
