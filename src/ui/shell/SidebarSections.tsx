import { formatUiNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
export function Collapsible(props: {
  id: string;
  title: string;
  count?: number;
  children: ReactNode;
  synced?: {
    workspaceId: string;
    collapsed: boolean;
    sectionId?: string;
  };
  menu?: ReactNode;
}) {
  useLocaleRender();
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
          <span className="grow ellipsis" style={{ textAlign: "start" }}>
            {props.title}
          </span>
          {collapsed && props.count ? <span className="count">{formatUiNumber(props.count)}</span> : null}
        </button>
        {props.menu}
      </div>
      {!collapsed && <div>{props.children}</div>}
    </section>
  );
}
/** Starred conversations and the person's own sections, at the top of Home (docs/WORKSPACE_ADMINISTRATION.md §5). */
export function PersonalSections({ orgId, unreadOnly }: { orgId: string | null; unreadOnly: boolean }) {
  useLocaleRender();
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
        <Collapsible id="::starred" title={uiText("workspace.interface.starred_07a2d57")} count={layout.starredUnread}>
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
  useLocaleRender();
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
          <button
            className="row-more"
            aria-label={uiText("workspace.interface.more_for_section_value0_0e6df31", { value0: section.name })}
            aria-haspopup="menu"
            onClick={(e) => menu.open(e.currentTarget)}
          >
            <MoreHorizontal size={15} />
          </button>
          {menu.anchor && (
            <Menu
              anchor={menu.anchor}
              align="end"
              label={uiText("workspace.interface.section_value0_33f5178", { value0: section.name })}
              onClose={menu.close}
              entries={[
                {
                  get label() {
                    return uiText("workspace.interface.rename_6fa62b3");
                  },
                  icon: <Pencil size={16} />,
                  onSelect: () => setRenaming(true),
                },
                {
                  get label() {
                    return uiText("workspace.interface.delete_section_5bf2328");
                  },
                  icon: <Trash2 size={16} />,
                  danger: true,
                  onSelect: () => void engine.nav.change(ws, { op: "deleteSection", id: section.id }),
                },
              ]}
            />
          )}
          {renaming && (
            <SectionNameDialog
              title={uiText("workspace.interface.rename_section_ae32b9f")}
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
        <div className="side-quiet">
          <Localized k="workspace.interface.empty_use_a_conversation_s_menu_to_move_it_here_9e65a98" />
        </div>
      ) : (
        section.ids.map((id) => <ConversationRow key={id} id={id} hideRead={unreadOnly} inPlace />)
      )}
    </Collapsible>
  );
}
/** The workspace's joined channels by organisation, branch and team, without those placed in Starred or a section. */
export function ChannelSections({ orgId, unreadOnly, onBrowse }: { orgId: string | null; unreadOnly: boolean; onBrowse?: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
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
      <Collapsible id="channels" title={l10n("organization.channels")}>
        <div className="side-quiet">
          <Localized k="workspace.interface.you_haven_t_joined_any_channels_in_this_community_78d98b7" />
        </div>
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
  useLocaleRender();
  return (
    <button className="side-item" onClick={onBrowse}>
      <span className="glyph">
        <Compass size={16} />
      </span>
      <span className="grow">
        <Localized k="organization.interface.browse_channels_79d490f" />
      </span>
    </button>
  );
}
/** Direct messages and groups; on Home without those in Starred or a section. */
export function PeopleList({ twoLine, unreadOnly, orgId, excludePlaced }: { twoLine?: boolean; unreadOnly?: boolean; orgId?: string | null; excludePlaced?: boolean }) {
  useLocaleRender();
  const ids = useOrbit((s) => {
    const placed = excludePlaced ? homeLayout(s, orgId ?? null).placed : null;
    return people(s)
      .map((c) => c.id)
      .filter((id) => !placed?.has(id));
  }, shallowEqual);
  if (ids.length === 0)
    return (
      <div className="side-quiet">
        <Localized k="workspace.interface.no_direct_messages_yet_7b41e02" />
      </div>
    );
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
  useLocaleRender();
  const ids = useOrbit((s) => archivedPeople(s).map((c) => c.id), shallowEqual);
  const unread = useOrbit((s) => archivedPeople(s).filter((c) => (s.local[c.id]?.unread ?? 0) > 0).length);
  const prefs = usePrefs();
  if (ids.length === 0) return null;
  const open = prefs.collapsed.includes("::archived-open");
  return (
    <section className="side-section" aria-label={uiText("workspace.interface.archived_bdb8650")}>
      <button
        className="side-item"
        aria-expanded={open}
        onClick={() => setPrefs({ collapsed: open ? prefs.collapsed.filter((k) => k !== "::archived-open") : [...prefs.collapsed, "::archived-open"] })}
      >
        <span className="glyph">
          <Archive size={16} />
        </span>
        <span className="grow">
          <Localized k="workspace.interface.archived_fb6cca7" slots={[ids.length, unread ? uiText("workspace.interface.value0_unread_2c7d0c6", { value0: unread }) : ""]} />
        </span>
      </button>
      {open && (
        <>
          <div className="side-quiet">
            <Localized k="workspace.interface.archived_here_only_they_still_notify_unless_muted_88179b1" />
          </div>
          {ids.map((id) => (
            <ConversationRow key={id} id={id} twoLine />
          ))}
        </>
      )}
    </section>
  );
}
export function SkeletonRows() {
  useLocaleRender();
  return (
    <div aria-busy="true" aria-label={uiText("workspace.interface.loading_conversations_8d384c5")} style={{ display: "grid", gap: 10, padding: "14px 8px" }}>
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
  useLocaleRender();
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
        <button
          className={`side-item${asked > 0 ? " unread" : ""}`}
          onClick={onConnections}
          aria-label={asked > 0 ? uiText("workspace.interface.connection_requests_value0_waiting_68476ca", { value0: asked }) : t("workspace.side_connections")}
        >
          <span className="glyph">
            <Contact size={16} />
          </span>
          <span className="grow">{asked > 0 ? t("side_connection_requests") : t("side_connections")}</span>
          {asked > 0 && <span className="count accent">{formatUiNumber(asked)}</span>}
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
  useLocaleRender();
  const hasConnections = useOrbit((s) => s.server?.features.includes("connections") ?? false);
  const waiting = useOrbit((s) => messageRequests(s).length);
  const asked = useIncomingRequestCount();
  const t = useT();
  const section = useRoute().section;
  return (
    <>
      <InviteToMeldiqCard />
      <MojoPromoCard />
      <nav className="dm-hub" aria-label={uiText("calls.interface.people_7db2089")}>
        {hasConnections && (
          <button
            className={`dm-hub-item${asked > 0 ? " unread" : ""}`}
            aria-current={section === "friends" ? "page" : undefined}
            onClick={() => navigate({ section: "friends" })}
            aria-label={asked > 0 ? uiText("workspace.interface.connection_requests_value0_waiting_68476ca", { value0: asked }) : t("workspace.friends")}
          >
            <Contact size={20} aria-hidden="true" />
            <span className="grow">{t("workspace.friends")}</span>
            {asked > 0 && <span className="count accent">{formatUiNumber(asked)}</span>}
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
          <span className="grow">
            <Localized k="workspace.interface.find_people_17a85d8" />
          </span>
        </button>
        <button className="dm-hub-item" onClick={() => onDialog("newGroup")}>
          <UserRoundPlus size={20} aria-hidden="true" />
          <span className="grow">
            <Localized k="workspace.interface.create_group_35be9c5" />
          </span>
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
