import { AtSign, Check, ChevronDown, Compass, Hash, Inbox, Lock, LogIn, Megaphone, PenSquare, Plus, Settings2, Ticket, UsersRound } from "lucide-react";
import { memo } from "react";
import type { Conversation } from "../../api/schemas";
import { shallowEqual, useOrbit } from "../../app/orbit";
import { setPrefs, usePrefs } from "../../app/prefs";
import { navigate, type Section, useRoute } from "../../app/router";
import type { ConversationLocal } from "../../model/types";
import { Avatar, colorIndexOf } from "../components/Avatar";
import { OrgAvatar } from "../components/OrgAvatar";
import { Menu, useMenu } from "../components/Overlay";
import { conversationTitle, dmPeer, members, shortWhen } from "../format";
import { channelGroups, mentionConversations, people } from "../selectors";
import type { ShellDialog } from "./Shell";

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
  const switcher = useMenu();
  const prefs = usePrefs();
  const unreadOnly = prefs.collapsed.includes("::unread-only");

  return (
    <aside className={`sidebar${open ? " open" : ""}`} aria-label="Conversations">
      <div className="side-head">
        <button
          className="org-switch"
          onClick={(e) => switcher.open(e.currentTarget)}
          aria-haspopup="menu"
          aria-expanded={!!switcher.anchor}
          aria-label={`Workspace: ${org?.name ?? "none"}. Switch workspace`}
        >
          {org ? <OrgAvatar orgId={org.id} name={org.name} photoRev={org.photoRev} size={34} /> : <Avatar name="Orbit" colorIndex={7} size={34} square decorative />}
          <span className="grow">
            <strong className="ellipsis" style={{ display: "block" }}>
              {org?.name ?? "Orbit"}
            </strong>
            <small>{org ? `${members(org.memberCount)} · ${roleLabel(org.myRole)}` : "No workspace yet"}</small>
          </span>
          <ChevronDown size={16} className="faint" />
        </button>
        <button className="icon-btn" onClick={() => onDialog({ kind: "new" })} aria-label="New message" title="New message">
          <PenSquare size={18} />
        </button>
      </div>
      {switcher.anchor && (
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
        </div>
      )}

      <div className="side-scroll scroll">
        {!synced && empty ? (
          <SkeletonRows />
        ) : section === "dms" ? (
          <PeopleList twoLine />
        ) : (
          <>
            <ChannelSections orgId={orgId} unreadOnly={unreadOnly} onBrowse={org ? () => onDialog({ kind: "channels" }) : undefined} />
            <Collapsible id="people" title="Direct messages">
              <PeopleList unreadOnly={unreadOnly} />
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

function MentionsLink({ orgId, active }: { orgId: string | null; active: boolean }) {
  const n = useOrbit((s) => mentionConversations(s, orgId).reduce((a, c) => a + (s.local[c.id]?.mentions ?? 0), 0));
  return (
    <a className="side-item" href="#/activity" aria-current={active ? "page" : undefined}>
      <span className="glyph">
        <AtSign size={16} />
      </span>
      <span className="grow">Mentions</span>
      {n > 0 && <span className="count accent">{n}</span>}
    </a>
  );
}

function Collapsible({ id, title, count, children }: { id: string; title: string; count?: number; children: React.ReactNode }) {
  const prefs = usePrefs();
  const collapsed = prefs.collapsed.includes(id);
  return (
    <section className="side-section" aria-label={title}>
      <button className="side-section-head" aria-expanded={!collapsed} onClick={() => setPrefs({ collapsed: collapsed ? prefs.collapsed.filter((k) => k !== id) : [...prefs.collapsed, id] })}>
        <ChevronDown size={14} className="chev" />
        <span className="grow ellipsis" style={{ textAlign: "left" }}>
          {title}
        </span>
        {collapsed && count ? <span className="count">{count}</span> : null}
      </button>
      {!collapsed && <div>{children}</div>}
    </section>
  );
}

function ChannelSections({ orgId, unreadOnly, onBrowse }: { orgId: string | null; unreadOnly: boolean; onBrowse?: () => void }) {
  const groups = useOrbit(
    (s) => channelGroups(s, orgId).map((g) => ({ key: g.key, title: g.title, ids: g.channels.map((c) => c.id), unread: g.channels.filter((c) => (s.local[c.id]?.unread ?? 0) > 0).length })),
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );
  if (!orgId) return null;
  if (groups.length === 0)
    return (
      <Collapsible id="channels" title="Channels">
        <div className="side-quiet">You haven't joined any channels in this workspace.</div>
        {onBrowse && <BrowseRow onBrowse={onBrowse} />}
      </Collapsible>
    );
  return (
    <>
      {groups.map((g, i) => (
        <Collapsible key={g.key} id={g.key} title={g.title} count={g.unread}>
          {g.ids.map((id) => (
            <ConversationRow key={id} id={id} hideRead={unreadOnly} />
          ))}
          {i === 0 && onBrowse && <BrowseRow onBrowse={onBrowse} />}
        </Collapsible>
      ))}
    </>
  );
}

function BrowseRow({ onBrowse }: { onBrowse: () => void }) {
  return (
    <button className="side-item" onClick={onBrowse}>
      <span className="glyph">
        <Compass size={16} />
      </span>
      <span className="grow">Browse channels</span>
    </button>
  );
}

function PeopleList({ twoLine, unreadOnly }: { twoLine?: boolean; unreadOnly?: boolean }) {
  const ids = useOrbit((s) => people(s).map((c) => c.id), shallowEqual);
  if (ids.length === 0) return <div className="side-quiet">No direct messages yet.</div>;
  return (
    <>
      {ids.map((id) => (
        <ConversationRow key={id} id={id} twoLine={twoLine} hideRead={unreadOnly} />
      ))}
    </>
  );
}

const ConversationRow = memo(function ConversationRow({ id, twoLine, hideRead }: { id: string; twoLine?: boolean; hideRead?: boolean }) {
  const route = useRoute();
  const data = useOrbit(
    (s) => {
      const c = s.conversations[id];
      if (!c || !s.me) return null;
      const peer = c.type === "DM" ? dmPeer(c, s.me.userId) : null;
      return {
        c,
        local: s.local[id] as ConversationLocal | undefined,
        title: conversationTitle(c, s.me.userId, s.users),
        online: peer ? (s.users[peer.id]?.online ?? null) : null,
        peerColor: peer?.avatarColor ?? 0,
        typing: Object.values(s.typing[id] ?? {}).some((t) => t > Date.now()),
      };
    },
    (a, b) => !!a && !!b && a.c === b.c && a.local === b.local && a.title === b.title && a.online === b.online && a.typing === b.typing,
  );
  if (!data) return null;
  const { c, local, title, online, peerColor, typing } = data;
  const unread = local?.unread ?? 0;
  const mentions = local?.mentions ?? 0;
  const current = route.conversationId === id;
  if (hideRead && unread === 0 && !current) return null;
  const section = route.section === "dms" ? "dms" : route.section === "activity" ? "activity" : "home";
  const glyph =
    c.type === "CHANNEL" ? (
      c.kind === "PRIVATE" ? (
        <Lock size={15} />
      ) : c.kind === "ANNOUNCEMENT" ? (
        <Megaphone size={15} />
      ) : (
        <Hash size={16} />
      )
    ) : c.type === "GROUP" ? (
      <Avatar name={title} colorIndex={colorIndexOf(c.id)} size={twoLine ? 36 : 22} decorative />
    ) : (
      <Avatar name={title} colorIndex={peerColor} size={twoLine ? 36 : 22} online={online} decorative />
    );
  const label = `${c.type === "CHANNEL" ? "Channel " : ""}${title}${unread ? `, ${unread} unread` : ""}${mentions ? `, ${mentions} mentions` : ""}`;
  const count = unread > 0 && <span className={`count${mentions > 0 || c.type !== "CHANNEL" ? " accent" : ""}`}>{mentions > 0 ? `@${mentions}` : unread}</span>;
  if (twoLine) {
    const preview = typing
      ? "typing…"
      : local?.lastPreview
        ? `${local.lastSenderName && c.type !== "DM" ? `${local.lastSenderName}: ` : local.lastSenderName === "You" ? "You: " : ""}${local.lastPreview}`
        : c.type === "GROUP"
          ? members(c.memberCount)
          : "No messages yet";
    return (
      <a className={`side-item two-line${unread ? " unread" : ""}`} href={`#/${section}/c/${encodeURIComponent(id)}`} aria-current={current ? "page" : undefined} aria-label={label}>
        <span className="glyph" style={{ width: 36 }}>
          {glyph}
        </span>
        <span className="lines">
          <span className="row">
            <span className="grow ellipsis">{title}</span>
            <span className="time">{shortWhen(local?.lastActivityAt ?? 0)}</span>
          </span>
          <span className="row">
            <small className="grow ellipsis">{preview}</small>
            {count}
          </span>
        </span>
      </a>
    );
  }
  return (
    <a className={`side-item${unread ? " unread" : ""}`} href={`#/${section}/c/${encodeURIComponent(id)}`} aria-current={current ? "page" : undefined} aria-label={label}>
      <span className="glyph">{glyph}</span>
      <span className="grow ellipsis">{title}</span>
      {local?.draft && !current ? <span className="draft">Draft</span> : null}
      {c.type === "GROUP" && <UsersRound size={13} className="faint" aria-hidden="true" />}
      {count}
    </a>
  );
});

function SkeletonRows() {
  return (
    <div aria-busy="true" aria-label="Loading conversations" style={{ display: "grid", gap: 10, padding: "14px 8px" }}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="row">
          <span className="skeleton" style={{ width: 22, height: 22, borderRadius: 6 }} />
          <span className="skeleton" style={{ height: 12, width: `${50 + ((i * 37) % 40)}%` }} />
        </div>
      ))}
    </div>
  );
}

export type { Conversation };
