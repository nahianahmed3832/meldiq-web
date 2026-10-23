import { Check, CheckCheck, ChevronDown, Compass, Inbox, LogIn, PenSquare, Plus, Settings2, Ticket, UsersRound } from "lucide-react";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { markAllReadTargets } from "../selectors";
import { setPrefs, usePrefs } from "../../application/prefs";
import { navigate, type Section } from "../../application/router";
import { Avatar } from "../components/Avatar";
import { OrgAvatar } from "../components/OrgAvatar";
import { Menu, useMenu } from "../components/Overlay";
import { members } from "../format";
import type { ShellDialog } from "./Shell";
import { ArchivedList, ChannelSections, Collapsible, LaterLink, MentionsLink, PeopleExtras, PeopleList, PersonalSections, SkeletonRows } from "./SidebarSections";
import { VoiceRoomsSection } from "./VoiceRooms";
import { CommunityHeader, hideMutedKey } from "../community/CommunityHeader";
import { CommunityPanel } from "../community/CommunityPanel";
import { useCommunityDetail } from "../community/useCommunityPermissions";

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

  return (
    <aside className={`sidebar${open ? " open" : ""}`} aria-label="Conversations">
      <div className="side-head">
        {section === "dms" ? (
          // Direct messages aren't part of a community: their own heading, not the community's.
          <h2 className="side-title grow">Direct messages</h2>
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
        <button className="icon-btn" onClick={() => onDialog({ kind: "new" })} aria-label="New message" title="New message">
          <PenSquare size={18} />
        </button>
      </div>
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

      {section !== "dms" && (
        <div className="side-quick">
          <button
            className="side-item"
            aria-pressed={unreadOnly}
            onClick={() => setPrefs({ collapsed: unreadOnly ? prefs.collapsed.filter((k) => k !== "::unread-only") : [...prefs.collapsed, "::unread-only"] })}
          >
            <span className="glyph">{unreadOnly ? <Check size={16} /> : <Inbox size={16} />}</span>
            <span className="grow">{unreadOnly ? "Showing unreads only" : "Unreads"}</span>
          </button>
          <MentionsLink orgId={orgId} active={section === "activity"} />
          <LaterLink active={section === "later"} />
        </div>
      )}

      <div className="side-scroll scroll">
        {!synced && empty ? (
          <SkeletonRows />
        ) : section === "dms" ? (
          <>
            <PeopleExtras onRequests={() => onDialog({ kind: "requests" })} onConnections={hasConnections ? () => onDialog({ kind: "connections" }) : undefined} />
            <PeopleList twoLine />
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
            <Collapsible id="people" title="Direct messages">
              <PeopleExtras onRequests={() => onDialog({ kind: "requests" })} />
              <PeopleList unreadOnly={unreadOnly} orgId={orgId} excludePlaced />
              <button className="side-item" onClick={() => onDialog({ kind: "new" })}>
                <span className="glyph">
                  <Plus size={16} />
                </span>
                <span className="grow">New message</span>
              </button>
              <button className="side-item" onClick={() => onDialog({ kind: "newGroup" })}>
                <span className="glyph">
                  <UsersRound size={16} />
                </span>
                <span className="grow">New group</span>
              </button>
            </Collapsible>
          </>
        )}
      </div>
    </aside>
  );
}

function roleLabel(role: string | null): string {
  return role ? role.charAt(0) + role.slice(1).toLowerCase() : "Member";
}
