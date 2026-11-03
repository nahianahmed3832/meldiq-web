import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { CheckCheck, Compass, LogIn, MessageSquarePlus, Plus, Settings2, UsersRound } from "lucide-react";
import { useRef, useState } from "react";
import { useScrollStrip } from "../components/scrollStrip";
import { type DragItem, useDragSort } from "../components/dragSort";
import { type DragRef, dropOnRail, railItems, type RailState } from "../../sync/railFolders";
import { PERSONAL } from "../../sync/navPrefs";
import { railOrdered } from "../../sync/communityRules";
import { RailFolderItem } from "./RailFolder";
import { CommunityButton, type RailOrg, useRailOrgs } from "./RailCommunity";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { contextMenuProps, Menu, type MenuEntry, useMenu } from "../components/Overlay";
import { usePrefs } from "../../application/prefs";
import { navigate, type Section } from "../../application/router";
import { useIncomingRequestCount } from "../people/connectionRequests";
import { isMuted, isPeople, people, unreadOf, unreadPeopleCount } from "../selectors";
import { conversationTitle, dmPeer } from "../format";
import { GroupAvatar } from "../components/OrgAvatar";
import { LookAvatar } from "../people/NameStyle";
import { capCount } from "../unread";
import { useT } from "../../i18n";
import type { ShellDialog } from "./Shell";
/**
 * The rail, top to bottom: the mascot (Home and messages: the DM list), the communities with their rolled-up unread
 * state, then round Create and Discover. Activity and Later live in the top bar and the sidebar (community-first brief
 * §G); their routes are unchanged. Phones show it on the Home tab beside the channels, as the Android app does (brief v4
 * §18), without the mascot and message bubbles: Messages is a tab there.
 */
export function Rail({ orgId, section, onDialog }: { orgId: string | null; section: Section; onDialog: (d: ShellDialog) => void }) {
  useLocaleRender();
  const orgs = useRailOrgs();
  // Unread DMs and people waiting for an answer to their connection request.
  const dms = useOrbit(unreadPeopleCount) + useIncomingRequestCount();
  const t = useT();
  const home = section === "dms" || section === "friends";
  const discovering = section === "discover";
  const homeLabel = `${t("rail_home")}${dms ? `, ${t("nav_unread", { n: dms })}` : ""}`;
  const strip = useRef<HTMLElement>(null);
  useScrollStrip(strip, `${section}:${orgId}`);
  const engine = useEngine();
  // The person's order and folders (synced with their other devices); dragging changes both (sync/railFolders.ts).
  const folders = useOrbit((s) => s.server?.features.includes("rail-folders") ?? false);
  const railOrder = useOrbit((s) => s.nav[PERSONAL]?.railOrder);
  const folderList = useOrbit(
    (s) => (s.server?.features.includes("rail-folders") ? (s.nav[PERSONAL]?.railFolders ?? []) : []),
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );
  const ordered = railOrdered(orgs, railOrder, (o) => o.id);
  const byId = new Map(orgs.map((o) => [o.id, o]));
  const items = railItems(
    ordered.map((o) => o.id),
    folderList,
  );
  const save = (next: RailState) =>
    void engine.nav
      .change(PERSONAL, folders ? { op: "railLayout", orgIds: next.order, folders: next.folders } : { op: "railOrder", orgIds: next.order })
      .catch(() => engine.notice("error", uiText("workspace.interface.couldn_t_save_the_new_order_try_again_c21e765")));
  useDragSort(strip, (drag, target, at) => {
    const state: RailState = { order: ordered.map((o) => o.id), folders: folderList };
    const ref = (d: DragItem): DragRef => (d.kind === "folder" ? { kind: "folder", id: d.id } : { kind: "org", id: d.id });
    const next = dropOnRail(state, ref(drag), ref(target), at, target.group);
    if (next !== state) save(next);
  });
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
    { label: t("workspace.home_start_community"), icon: <Plus size={16} />, onSelect: () => onDialog({ kind: "createWorkspace" }) },
    { label: t("workspace.home_join_code"), icon: <LogIn size={16} />, onSelect: () => onDialog({ kind: "joinWorkspace" }) },
    { label: t("workspace.rail_discover"), icon: <Compass size={16} />, onSelect: () => navigate({ section: "discover" }) },
  ];
  const homeEntries: MenuEntry[] = [
    {
      get label() {
        return uiText("workspace.interface.mark_all_messages_as_read_638bab2");
      },
      icon: <CheckCheck size={16} />,
      disabled: dmTargets.length === 0,
      onSelect: () => void Promise.all(dmTargets.map((c) => engine.markRead(c))),
    },
    "separator",
    {
      get label() {
        return uiText("workspace.interface.start_a_conversation_258150c");
      },
      icon: <MessageSquarePlus size={16} />,
      onSelect: () => onDialog({ kind: "new" }),
    },
    {
      get label() {
        return uiText("workspace.interface.create_a_group_e3c4877");
      },
      icon: <UsersRound size={16} />,
      onSelect: () => onDialog({ kind: "newGroup" }),
    },
    "separator",
    { label: t("settings.title"), icon: <Settings2 size={16} />, onSelect: () => navigate({ section: "settings", settingsPage: "profile" }) },
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
          {items.map((it) =>
            it.kind === "org" ? (
              byId.get(it.id) && (
                // Direct messages belong to no community, so none is selected there (as on Discord).
                <CommunityButton key={it.id} org={byId.get(it.id)!} selected={!home && !discovering && it.id === orgId} size={44} onDialog={onDialog} drag={{ group: null, into: folders }} />
              )
            ) : (
              <RailFolderItem
                key={it.folder.id}
                folder={it.folder}
                orgs={it.folder.orgIds.map((id) => byId.get(id)).filter((o): o is RailOrg => !!o)}
                selectedId={!home && !discovering ? orgId : null}
                onDialog={onDialog}
                onChange={(next: RailState) => save(next)}
                state={{ order: ordered.map((o) => o.id), folders: folderList }}
              />
            ),
          )}
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
/** At most this many people who just messaged you, as bubbles under Home (Settings › Appearance). */
const DM_BUBBLES = 5;
/**
 * People with unread direct messages or groups, as round bubbles under Home (the reference's rail): one click opens
 * the conversation. Muted ones and message requests don't show. Off in Settings › Appearance.
 */
function RailDmBubbles() {
  useLocaleRender();
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
    <div className="rail-dms" role="group" aria-label={uiText("workspace.interface.unread_messages_5b1aa06")}>
      {items.map((it) => (
        <a
          key={it.id}
          className="rail-dm"
          href={`/dms/c/${encodeURIComponent(it.id)}`}
          title={it.title}
          aria-label={uiText("workspace.interface.value0_value1_unread_ff8b523", { value0: it.title, value1: it.unread })}
        >
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
