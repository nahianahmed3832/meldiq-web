import { InviteToMeldiqCard, MojoPromoCard } from "./DmPromos";
import { navigate, useRoute } from "../../application/router";
import { Archive, ChevronDown, Compass, Contact, MailQuestion, MoreHorizontal, Pencil, Plus, Search, Trash2, UserRoundPlus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { setPrefs, usePrefs } from "../../application/prefs";
import { Menu, useMenu } from "../components/Overlay";
import { archivedPeople, channelGroups, homeLayout, type HomeSection, messageRequests, people } from "../selectors";
import { ConversationRow, SectionNameDialog } from "./ConversationRow";
import { useIncomingRequestCount } from "../people/connectionRequests";
import { useT } from "../../i18n";

/**
 * A group in the sidebar. [synced]: its open/closed state is kept in a workspace's preferences document (the phone's
 * groups and custom sections), otherwise in this browser's preferences.
 */
export function Collapsible(props: { id: string; title: string; count?: number; children: ReactNode; synced?: { workspaceId: string; collapsed: boolean; sectionId?: string }; menu?: ReactNode }) {
  const engine = useEngine();
  const prefs = usePrefs();
  const collapsed = props.synced ? props.synced.collapsed : prefs.collapsed.includes(props.id);
  const toggle = () => {
    if (props.synced) {
      const { workspaceId, sectionId } = props.synced;
      void engine.nav.change(workspaceId, sectionId ? { op: "collapseSection", id: sectionId, collapsed: !collapsed } : { op: "collapse", key: props.id, collapsed: !collapsed });
    } else setPrefs({ collapsed: collapsed ? prefs.collapsed.filter((k) => k !== props.id) : [...prefs.collapsed, props.id] });
  };
  return (
    <section className="side-section" aria-label={props.title}>
      <div className="side-section-row">
        <button className="side-section-head" aria-expanded={!collapsed} onClick={toggle}>
          <ChevronDown size={14} className="chev" />
          <span className="grow ellipsis" style={{ textAlign: "left" }}>
            {props.title}
          </span>
          {collapsed && props.count ? <span className="count">{props.count}</span> : null}
        </button>
        {props.menu}
      </div>
      {!collapsed && <div>{props.children}</div>}
    </section>
  );
}

/** Starred conversations and the person's own sections, at the top of Home (docs/WORKSPACE_ADMINISTRATION.md §5). */
export function PersonalSections({ orgId, unreadOnly }: { orgId: string | null; unreadOnly: boolean }) {
  const layout = useOrbit(
    (s) => {
      const l = homeLayout(s, orgId);
      const unread = (ids: string[]) => ids.filter((id) => (s.local[id]?.unread ?? 0) > 0).length;
      return { starred: l.starred, starredUnread: unread(l.starred), sections: l.sections.map((sec) => ({ ...sec, unread: unread(sec.ids) })) };
    },
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );
  return (
    <>
      {layout.starred.length > 0 && (
        <Collapsible id="::starred" title="Starred" count={layout.starredUnread}>
          {layout.starred.map((id) => (
            <ConversationRow key={id} id={id} hideRead={unreadOnly} inPlace />
          ))}
        </Collapsible>
      )}
      {layout.sections.map((sec) => (
        <CustomSection key={`${sec.workspaceId}/${sec.id}`} section={sec} unreadOnly={unreadOnly} count={sec.unread} />
      ))}
    </>
  );
}

function CustomSection({ section, unreadOnly, count }: { section: HomeSection; unreadOnly: boolean; count: number }) {
  const engine = useEngine();
  const menu = useMenu();
  const [renaming, setRenaming] = useState(false);
  const ws = section.workspaceId;
  return (
    <Collapsible
      id={`section:${section.id}`}
      title={section.name}
      count={count}
      synced={{ workspaceId: ws, collapsed: section.collapsed, sectionId: section.id }}
      menu={
        <>
          <button className="row-more" aria-label={`More for section ${section.name}`} aria-haspopup="menu" onClick={(e) => menu.open(e.currentTarget)}>
            <MoreHorizontal size={15} />
          </button>
          {menu.anchor && (
            <Menu
              anchor={menu.anchor}
              align="end"
              label={`Section ${section.name}`}
              onClose={menu.close}
              entries={[
                { label: "Rename…", icon: <Pencil size={16} />, onSelect: () => setRenaming(true) },
                { label: "Delete section", icon: <Trash2 size={16} />, danger: true, onSelect: () => void engine.nav.change(ws, { op: "deleteSection", id: section.id }) },
              ]}
            />
          )}
          {renaming && (
            <SectionNameDialog
              title="Rename section"
              initial={section.name}
              onClose={() => setRenaming(false)}
              onSave={(name) => {
                void engine.nav.change(ws, { op: "renameSection", id: section.id, name });
                setRenaming(false);
              }}
            />
          )}
        </>
      }
    >
      {section.ids.length === 0 ? (
        <div className="side-quiet">Empty. Use a conversation's … menu to move it here.</div>
      ) : (
        section.ids.map((id) => <ConversationRow key={id} id={id} hideRead={unreadOnly} inPlace />)
      )}
    </Collapsible>
  );
}

/** The workspace's joined channels by organisation, branch and team, without those placed in Starred or a section. */
export function ChannelSections({ orgId, unreadOnly, onBrowse }: { orgId: string | null; unreadOnly: boolean; onBrowse?: () => void }) {
  const groups = useOrbit(
    (s) => {
      const placed = homeLayout(s, orgId).placed;
      const collapsed = new Set(orgId ? (s.nav[orgId]?.collapsed ?? []) : []);
      return channelGroups(s, orgId).map((g) => {
        const ids = g.channels.map((c) => c.id).filter((id) => !placed.has(id));
        return { key: g.key, title: g.title, ids, collapsed: collapsed.has(g.key), unread: ids.filter((id) => (s.local[id]?.unread ?? 0) > 0).length };
      });
    },
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );
  if (!orgId) return null;
  if (groups.length === 0)
    return (
      <Collapsible id="channels" title="Channels">
        <div className="side-quiet">You haven't joined any channels in this community.</div>
        {onBrowse && <BrowseRow onBrowse={onBrowse} />}
      </Collapsible>
    );
  return (
    <>
      {groups.map((g, i) => (
        <Collapsible key={g.key} id={g.key} title={g.title} count={g.unread} synced={{ workspaceId: orgId, collapsed: g.collapsed }}>
          {g.ids.map((id) => (
            <ConversationRow key={id} id={id} hideRead={unreadOnly} />
          ))}
          {i === 0 && onBrowse && <BrowseRow onBrowse={onBrowse} />}
        </Collapsible>
      ))}
    </>
  );
}

export function BrowseRow({ onBrowse }: { onBrowse: () => void }) {
  return (
    <button className="side-item" onClick={onBrowse}>
      <span className="glyph">
        <Compass size={16} />
      </span>
      <span className="grow">Browse channels</span>
    </button>
  );
}

/** Direct messages and groups; on Home without those in Starred or a section. */
export function PeopleList({ twoLine, unreadOnly, orgId, excludePlaced }: { twoLine?: boolean; unreadOnly?: boolean; orgId?: string | null; excludePlaced?: boolean }) {
  const ids = useOrbit((s) => {
    const placed = excludePlaced ? homeLayout(s, orgId ?? null).placed : null;
    return people(s)
      .map((c) => c.id)
      .filter((id) => !placed?.has(id));
  }, shallowEqual);
  if (ids.length === 0) return <div className="side-quiet">No direct messages yet.</div>;
  return (
    <>
      {ids.map((id) => (
        <ConversationRow key={id} id={id} twoLine={twoLine} hideRead={unreadOnly} />
      ))}
    </>
  );
}

/** Chats archived on this browser, behind a closed "Archived" group (android ChatsScreen). */
export function ArchivedList() {
  const ids = useOrbit((s) => archivedPeople(s).map((c) => c.id), shallowEqual);
  const unread = useOrbit((s) => archivedPeople(s).filter((c) => (s.local[c.id]?.unread ?? 0) > 0).length);
  const prefs = usePrefs();
  if (ids.length === 0) return null;
  const open = prefs.collapsed.includes("::archived-open");
  return (
    <section className="side-section" aria-label="Archived">
      <button
        className="side-item"
        aria-expanded={open}
        onClick={() => setPrefs({ collapsed: open ? prefs.collapsed.filter((k) => k !== "::archived-open") : [...prefs.collapsed, "::archived-open"] })}
      >
        <span className="glyph">
          <Archive size={16} />
        </span>
        <span className="grow">
          Archived · {ids.length}
          {unread ? `, ${unread} unread` : ""}
        </span>
      </button>
      {open && (
        <>
          <div className="side-quiet">Archived here only. They still notify unless muted.</div>
          {ids.map((id) => (
            <ConversationRow key={id} id={id} twoLine />
          ))}
        </>
      )}
    </section>
  );
}

export function SkeletonRows() {
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

/**
 * Batch B6: "Message requests · N waiting" (when there are any) and Connections, at the top of the direct messages
 * (android ChatsScreen). Requests make no sound and count in no badge.
 */
/**
 * Message requests, and Connections with the connection requests waiting for you. [onlyWhenAsked]: the Connections row
 * shows only while someone is waiting (Home's Direct messages section); DMs always show it.
 */
export function PeopleExtras({ onRequests, onConnections, onlyWhenAsked }: { onRequests: () => void; onConnections?: () => void; onlyWhenAsked?: boolean }) {
  const waiting = useOrbit((s) => messageRequests(s).length);
  const asked = useIncomingRequestCount();
  const t = useT();
  return (
    <>
      {waiting > 0 && (
        <button className="side-item" onClick={onRequests}>
          <span className="glyph">
            <MailQuestion size={16} />
          </span>
          <span className="grow">{t("side_message_requests", { n: waiting })}</span>
        </button>
      )}
      {onConnections && (asked > 0 || !onlyWhenAsked) && (
        <button className={`side-item${asked > 0 ? " unread" : ""}`} onClick={onConnections} aria-label={asked > 0 ? `Connection requests, ${asked} waiting` : "Connections"}>
          <span className="glyph">
            <Contact size={16} />
          </span>
          <span className="grow">{asked > 0 ? t("side_connection_requests") : t("side_connections")}</span>
          {asked > 0 && <span className="count accent">{asked}</span>}
        </button>
      )}
    </>
  );
}

/**
 * The top of Home and messages (the reference's DM hub): Friends (your connections, with requests waiting), message
 * requests, Find people and Create group; then the "Direct messages" heading with + for a new message.
 */
export function DmHub({ onDialog }: { onDialog: (kind: "requests" | "connections" | "new" | "newGroup") => void }) {
  const hasConnections = useOrbit((s) => s.server?.features.includes("connections") ?? false);
  const waiting = useOrbit((s) => messageRequests(s).length);
  const asked = useIncomingRequestCount();
  const t = useT();
  const section = useRoute().section;
  return (
    <>
      <InviteToMeldiqCard />
      <MojoPromoCard />
      <nav className="dm-hub" aria-label="People">
        {hasConnections && (
          <button
            className={`dm-hub-item${asked > 0 ? " unread" : ""}`}
            aria-current={section === "friends" ? "page" : undefined}
            onClick={() => navigate({ section: "friends" })}
            aria-label={asked > 0 ? `Connection requests, ${asked} waiting` : "Friends"}
          >
            <Contact size={20} aria-hidden="true" />
            <span className="grow">Friends</span>
            {asked > 0 && <span className="count accent">{asked}</span>}
          </button>
        )}
        {waiting > 0 && (
          <button className="dm-hub-item unread" onClick={() => onDialog("requests")}>
            <MailQuestion size={20} aria-hidden="true" />
            <span className="grow">{t("side_message_requests", { n: waiting })}</span>
          </button>
        )}
        <button className="dm-hub-item" onClick={() => onDialog("new")}>
          <Search size={20} aria-hidden="true" />
          <span className="grow">Find people</span>
        </button>
        <button className="dm-hub-item" onClick={() => onDialog("newGroup")}>
          <UserRoundPlus size={20} aria-hidden="true" />
          <span className="grow">Create group</span>
        </button>
      </nav>
      <div className="dm-hub-label">
        <h3>{t("side_direct_messages")}</h3>
        <button className="icon-btn" onClick={() => onDialog("new")} aria-label={t("side_new_message")} title={t("side_new_message")}>
          <Plus size={16} />
        </button>
      </div>
    </>
  );
}
