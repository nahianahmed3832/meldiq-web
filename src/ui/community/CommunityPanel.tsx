import { isHighlighted, unreadLabel, unreadMarker } from "../unread";
import { UnreadBadge } from "../components/UnreadBadge";
import { BellOff, ChevronDown, Eye, MonitorUp, MoreHorizontal, Plus } from "lucide-react";
import { LiveCallBadge } from "../components/LiveCallBadge";
import { useT } from "../../i18n";
import { memo, type MouseEvent, useEffect, useMemo, useState } from "react";
import type { Category } from "../../api/communitySchemas";
import type { Conversation } from "../../api/schemas";
import { shallowEqual, useEngine, useOrbit } from "../../application/orbit";
import { navigate, useRoute } from "../../application/router";
import { joinCommunityChannel, saveLayout, updateChannel } from "../../sync/community";
import {
  allMuted,
  categoryMenu,
  type CategoryMenuItem,
  channelMenu,
  type ChannelMenuItem,
  hasNews,
  layoutPositions,
  markReadTargets,
  moved,
  muteTargets,
  type PanelChannel,
  type PanelSection,
  panelSections,
} from "../../sync/communityRules";
import { placeOf } from "../../sync/navPrefs";
import { UserAvatar } from "../components/OrgAvatar";
import { Menu, type MenuEntry, useMenu } from "../components/Overlay";
import { homeLayout, liveCallOf, roomPeople } from "../selectors";
import { useTickAt } from "./useTickAt";
import { CategoryNameDialog, DeleteCategoryDialog, MuteForDialog } from "./CategoryDialogs";
import { ChannelGlyph, CreateChannelDialog, DeleteChannelDialog, EditChannelDialog, MoveChannelDialog } from "./ChannelDialogs";
import { CHANNEL_ITEM, CATEGORY_ITEM } from "./menuLabels";
import { CategoryLevelDialog, HiddenChannelsDialog } from "./NotifyDialogs";
import { panelChannels, categoriesOf, nextMuteEnd } from "./panelData";
import { PermissionsDialog } from "./PermissionsDialog";
import type { CommunityPermissions } from "./useCommunityPermissions";

type PanelDialog =
  | { k: "create"; categoryId: string | null }
  | { k: "edit"; channel: Conversation }
  | { k: "delete"; channel: Conversation }
  | { k: "move"; channel: Conversation }
  | { k: "mute"; ids: string[]; title: string }
  | { k: "category"; category: Category | null }
  | { k: "deleteCategory"; category: Category }
  | { k: "categoryLevel"; category: Category }
  | { k: "permissions"; type: "category" | "channel"; id: string; title: string }
  | { k: "hidden" }
  | null;

/**
 * A community's channels on Home (android CommunityHomeScreen's panel, docs/product/MELDIQ_COMMUNITY_CHAT_SPEC.md §2):
 * categories in the community's order, collapsed state synced to every device, channels you haven't joined dimmed until
 * opened, hidden channels behind "Browse channels", and a menu on every channel and category. The server checks every
 * change; menus only offer what the person's permissions allow.
 */
export function CommunityPanel({ orgId, unreadOnly, hideMuted, perms }: { orgId: string; unreadOnly: boolean; hideMuted: boolean; perms: CommunityPermissions }) {
  const engine = useEngine();
  const route = useRoute();
  const features = useOrbit((s) => s.server?.features ?? [], shallowEqual);
  const categories = useOrbit((s) => categoriesOf(s, orgId));
  const channels = useOrbit(
    (s) => panelChannels(s, orgId),
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  );
  const collapsedList = useOrbit((s) => s.nav[orgId]?.collapsed ?? [], shallowEqual);
  const hiddenList = useOrbit((s) => s.nav[orgId]?.hidden ?? [], shallowEqual);
  const placedIds = useOrbit((s) => [...homeLayout(s, orgId).placed], shallowEqual);
  const muteEnd = useOrbit((s) => nextMuteEnd(s, orgId));
  const [dialog, setDialog] = useState<PanelDialog>(null);
  useTickAt(muteEnd);

  useEffect(() => {
    void engine.community.refresh(orgId);
  }, [engine, orgId]);

  const keepEmpty = perms.canCreateChannels || perms.canManageChannels;
  const sections = useMemo(
    () =>
      panelSections(channels, categories, {
        collapsed: new Set(collapsedList),
        selectedId: route.conversationId,
        hideMuted,
        unreadOnly,
        placed: new Set(placedIds),
        keepEmpty,
        hidden: new Set(hiddenList),
      }),
    [channels, categories, collapsedList, route.conversationId, hideMuted, unreadOnly, placedIds, keepEmpty, hiddenList],
  );
  const allSections = useMemo(() => panelSections(channels, categories, { collapsed: new Set(), keepEmpty: false }), [channels, categories]);
  const hiddenCount = channels.filter((c) => hiddenList.includes(c.id) && !(c.mentions > 0 || c.id === route.conversationId)).length;

  const convOf = (id: string): Conversation | undefined => engine.state.get().conversations[id] ?? engine.state.get().communities[orgId]?.channels.find((c) => c.id === id);
  const siblingsOf = (categoryId: string | null) => allSections.find((s) => s.categoryId === categoryId)?.channels.map((c) => c.id) ?? [];
  const keepAllCategories = panelSections(channels, categories, { collapsed: new Set(), keepEmpty: true })
    .filter((s) => s.categoryId)
    .map((s) => s.categoryId as string);

  const toggle = (key: string, collapsed: boolean) => void engine.nav.change(orgId, { op: "collapse", key, collapsed });
  const setMuted = (ids: string[], mute: boolean) => {
    for (const id of ids) {
      const c = convOf(id);
      void engine.nav.change(orgId, { op: "notify", conversationId: id, level: mute ? "none" : "all", categoryId: c?.categoryId ?? null });
    }
  };
  const muteFor = (ids: string[], ms: number | null) => {
    const now = Date.now();
    for (const id of ids) {
      if (ms === null) void engine.nav.change(orgId, { op: "notify", conversationId: id, level: "none", categoryId: convOf(id)?.categoryId ?? null });
      else void engine.nav.change(orgId, { op: "muteUntil", conversationId: id, until: now + ms });
    }
  };
  const timed = features.includes("channel-preferences");

  const onChannel = (ch: PanelChannel, item: ChannelMenuItem, sectionIds: string[]) => {
    const conv = convOf(ch.id);
    switch (item) {
      case "markRead":
        return void engine.markRead(ch.id);
      case "favourite":
      case "unfavourite":
        return void engine.arrange(ch.id, { op: "place", conversationId: ch.id, sectionId: null, starred: item === "favourite" });
      case "mute":
        return setDialog({ k: "mute", ids: [ch.id], title: `#${ch.name}` });
      case "unmute":
        return setMuted([ch.id], false);
      case "hide":
      case "show":
        return void engine.nav.change(orgId, { op: "hide", conversationId: ch.id, hidden: item === "hide" });
      case "copyName":
        void navigator.clipboard?.writeText(ch.name).catch(() => undefined);
        return engine.notice("info", "Channel name copied.");
      case "edit":
        return conv && setDialog({ k: "edit", channel: conv });
      case "permissions":
        return setDialog({ k: "permissions", type: "channel", id: ch.id, title: `#${ch.name}` });
      case "moveTo":
        return conv && setDialog({ k: "move", channel: conv });
      case "moveUp":
      case "moveDown":
        return void saveLayout(engine, orgId, { channels: layoutPositions(ch.categoryId, moved(sectionIds, ch.id, item === "moveUp" ? -1 : 1)) }).catch((e: unknown) =>
          engine.notice("error", e instanceof Error ? e.message : "Couldn't move the channel."),
        );
      case "archive":
      case "restore":
        return void updateChannel(engine, ch.id, { archived: item === "archive" }).catch((e: unknown) => engine.notice("error", e instanceof Error ? e.message : "Couldn't change the channel."));
      case "delete":
        return conv && setDialog({ k: "delete", channel: conv });
    }
  };

  const onCategory = (s: PanelSection, item: CategoryMenuItem) => {
    const category = categories.find((c) => c.id === s.categoryId) ?? null;
    switch (item) {
      case "markRead":
        return void Promise.all(markReadTargets(s.channels).map((id) => engine.markRead(id)));
      case "collapse":
      case "expand":
        return toggle(s.key, item === "collapse");
      case "collapseAll":
        return sections.filter((x) => !x.collapsed).forEach((x) => toggle(x.key, true));
      case "mute":
        return timed ? setDialog({ k: "mute", ids: muteTargets(s.channels, true), title: s.title ?? "channels" }) : setMuted(muteTargets(s.channels, true), true);
      case "unmute":
        return setMuted(muteTargets(s.channels, false), false);
      case "notify":
        return category && setDialog({ k: "categoryLevel", category });
      case "newChannel":
        return setDialog({ k: "create", categoryId: s.categoryId });
      case "rename":
        return category && setDialog({ k: "category", category });
      case "permissions":
        return category && setDialog({ k: "permissions", type: "category", id: category.id, title: category.name });
      case "moveUp":
      case "moveDown":
        return (
          category &&
          void saveLayout(engine, orgId, { categories: moved(keepAllCategories, category.id, item === "moveUp" ? -1 : 1) }).catch((e: unknown) =>
            engine.notice("error", e instanceof Error ? e.message : "Couldn't move the category."),
          )
        );
      case "delete":
        return category && setDialog({ k: "deleteCategory", category });
    }
  };

  if (!engine.community.available) return null;
  return (
    <>
      {sections.length === 0 && <div className="side-quiet">No channels here yet.</div>}
      {sections.map((s) => {
        const category = categories.find((c) => c.id === s.categoryId);
        const catIndex = s.categoryId ? keepAllCategories.indexOf(s.categoryId) : -1;
        const items = categoryMenu({
          isCategory: !!s.categoryId,
          collapsed: s.collapsed,
          hasNews: s.channels.some(hasNews),
          hasJoined: s.channels.some((c) => c.joined),
          allMuted: allMuted(s.channels),
          canCreate: s.categoryId ? !!category?.canCreateChannels : perms.canCreateTop,
          canManage: !!category?.canManage && perms.canManageChannels,
          canMoveUp: catIndex > 0,
          canMoveDown: catIndex >= 0 && catIndex < keepAllCategories.length - 1,
          canSetLevel: timed,
        });
        const sectionIds = siblingsOf(s.categoryId);
        return (
          <CategorySection
            key={s.key}
            section={s}
            title={s.title ?? "Channels"}
            menu={items}
            canAdd={items.includes("newChannel")}
            onToggle={() => toggle(s.key, !s.collapsed)}
            onAdd={() => setDialog({ k: "create", categoryId: s.categoryId })}
            onPick={(item) => onCategory(s, item)}
          >
            {s.shown.map((ch) => {
              const i = sectionIds.indexOf(ch.id);
              const starred = placeOf(engine.state.get().nav[orgId] ?? { starred: [], sections: [], collapsed: [], notify: {} }, ch.id).k === "starred";
              return (
                <ChannelItem
                  key={ch.id}
                  orgId={orgId}
                  ch={ch}
                  current={route.conversationId === ch.id}
                  menu={channelMenu(ch, {
                    starred,
                    canArrange: perms.canManageChannels,
                    canMoveUp: i > 0,
                    canMoveDown: i >= 0 && i < sectionIds.length - 1,
                    canDelete: features.includes("channel-delete"),
                    canHide: timed,
                    hidden: hiddenList.includes(ch.id),
                  })}
                  onPick={(item) => onChannel(ch, item, sectionIds)}
                />
              );
            })}
          </CategorySection>
        );
      })}
      {timed && (hiddenCount > 0 || channels.length > 0) && (
        <button className="side-item side-browse" onClick={() => setDialog({ k: "hidden" })}>
          <span className="glyph">
            <Eye size={16} />
          </span>
          <span className="grow">{hiddenCount > 0 ? `${hiddenCount} hidden · Browse channels` : "Browse channels"}</span>
        </button>
      )}

      {dialog?.k === "create" && <CreateChannelDialog orgId={orgId} categories={categories} categoryId={dialog.categoryId} canCreateTop={perms.canCreateTop} onClose={() => setDialog(null)} />}
      {dialog?.k === "edit" && <EditChannelDialog channel={dialog.channel} onClose={() => setDialog(null)} />}
      {dialog?.k === "delete" && <DeleteChannelDialog orgId={orgId} channel={dialog.channel} onClose={() => setDialog(null)} />}
      {dialog?.k === "move" && <MoveChannelDialog orgId={orgId} channel={dialog.channel} categories={categories} siblingsOf={siblingsOf} onClose={() => setDialog(null)} />}
      {dialog?.k === "mute" && <MuteForDialog title={dialog.title} timed={timed} onPick={(ms) => muteFor(dialog.ids, ms)} onClose={() => setDialog(null)} />}
      {dialog?.k === "category" && <CategoryNameDialog orgId={orgId} category={dialog.category} onClose={() => setDialog(null)} />}
      {dialog?.k === "deleteCategory" && <DeleteCategoryDialog orgId={orgId} category={dialog.category} onClose={() => setDialog(null)} />}
      {dialog?.k === "categoryLevel" && <CategoryLevelDialog orgId={orgId} categoryId={dialog.category.id} name={dialog.category.name} onClose={() => setDialog(null)} />}
      {dialog?.k === "permissions" && <PermissionsDialog orgId={orgId} target={{ type: dialog.type, id: dialog.id }} title={dialog.title} onClose={() => setDialog(null)} />}
      {dialog?.k === "hidden" && <HiddenChannelsDialog orgId={orgId} sections={allSections.map((s) => ({ title: s.title ?? "Channels", channels: s.channels }))} onClose={() => setDialog(null)} />}
    </>
  );
}

function CategorySection(props: {
  section: PanelSection;
  title: string;
  menu: CategoryMenuItem[];
  canAdd: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onPick: (item: CategoryMenuItem) => void;
  children: React.ReactNode;
}) {
  const { section: s, title, menu, canAdd, onToggle, onAdd, onPick, children } = props;
  const m = useMenu();
  const open = (e: MouseEvent<HTMLElement>) => {
    e.preventDefault();
    const row = e.currentTarget.closest(".side-section-row") as HTMLElement;
    // A right-click opens the menu at the pointer; the ⋯ button, below itself.
    if (e.type === "contextmenu") m.openAt(row, e);
    else m.open(row);
  };
  return (
    <section className="side-section" aria-label={title}>
      <div className="side-section-row" onContextMenu={open}>
        <button className="side-section-head" aria-expanded={!s.collapsed} onClick={onToggle}>
          <ChevronDown size={14} className="chev" />
          <span className="grow ellipsis" style={{ textAlign: "left" }}>
            {title}
          </span>
          {s.collapsed && s.unreadChannels > 0 ? <span className="count">{s.unreadChannels}</span> : null}
        </button>
        {canAdd && (
          <button className="row-more" aria-label={`Create a channel in ${title}`} title="Create channel" onClick={onAdd}>
            <Plus size={15} />
          </button>
        )}
        <button className="row-more" aria-label={`More for ${title}`} aria-haspopup="menu" aria-expanded={!!m.anchor} onClick={open}>
          <MoreHorizontal size={15} />
        </button>
      </div>
      {m.anchor && <Menu anchor={m.anchor} point={m.point} align="end" label={title} onClose={m.close} entries={entriesOf(menu, CATEGORY_ITEM, onPick, ["newChannel", "delete"])} />}
      <div className="side-channels">{children}</div>
    </section>
  );
}

function entriesOf<T extends string>(items: T[], labels: Record<T, { label: string; icon: React.ReactNode; danger?: boolean }>, onPick: (item: T) => void, separatorsBefore: T[]): MenuEntry[] {
  const out: MenuEntry[] = [];
  items.forEach((item, i) => {
    if (i > 0 && separatorsBefore.includes(item)) out.push("separator");
    const l = labels[item];
    out.push({ label: l.label, icon: l.icon, danger: l.danger, onSelect: () => onPick(item) });
  });
  return out;
}

const ChannelItem = memo(function ChannelItem({
  orgId,
  ch,
  current,
  menu,
  onPick,
}: {
  orgId: string;
  ch: PanelChannel;
  current: boolean;
  menu: ChannelMenuItem[];
  onPick: (item: ChannelMenuItem) => void;
}) {
  const engine = useEngine();
  const m = useMenu();
  const people = useOrbit((s) => (ch.voice ? roomPeople(s, ch.id) : []), shallowEqual);
  const sharing = useOrbit((s) => liveCallOf(s, ch.id)?.sharing ?? [], shallowEqual);
  const t = useT();
  const users = useOrbit((s) => s.users);
  const [joining, setJoining] = useState(false);
  const open = (e: MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const row = e.currentTarget.closest(".side-row") as HTMLElement;
    if (e.type === "contextmenu") m.openAt(row, e);
    else m.open(row);
  };
  const go = async (e: MouseEvent<HTMLAnchorElement>) => {
    if (ch.joined) return;
    e.preventDefault();
    setJoining(true);
    try {
      await joinCommunityChannel(engine, orgId, ch.id);
      navigate({ section: "home", conversationId: ch.id });
    } catch (err) {
      engine.notice("error", err instanceof Error ? err.message : "Couldn't open that channel.");
    } finally {
      setJoining(false);
    }
  };
  const marker = unreadMarker(ch.unread, ch.mentions, ch.muted);
  const label = `${ch.voice ? "Voice channel" : "Channel"} ${ch.name}${ch.joined ? "" : ", not joined yet"}${unreadLabel(ch.unread, ch.mentions, ch.muted, { unread: (n) => `${n} unread`, mentions: (n) => `${n} mentions`, muted: "muted" })}`;
  return (
    <div className="side-row">
      <a
        className={`side-item channel-item${isHighlighted(marker) ? " unread" : ""}${ch.muted ? " muted" : ""}${ch.joined ? "" : " unjoined"}`}
        href={`/home/c/${encodeURIComponent(ch.id)}`}
        aria-current={current ? "page" : undefined}
        aria-label={label}
        aria-busy={joining || undefined}
        onClick={(e) => void go(e)}
        onContextMenu={open}
      >
        <span className={`glyph${ch.liveCall ? " live" : ""}`}>
          <ChannelGlyph kind={ch.kind} voice={ch.voice} format={ch.format} />
        </span>
        <span className="grow ellipsis">{ch.name}</span>
        {ch.liveCall && <LiveCallBadge conversationId={ch.id} />}
        {ch.muted && <BellOff size={12} className="faint" aria-hidden="true" />}
        <UnreadBadge marker={marker} />
      </a>
      <button className="row-more" aria-label={`More for ${ch.name}`} aria-haspopup="menu" onClick={open}>
        <MoreHorizontal size={16} />
      </button>
      {m.anchor && (
        <Menu anchor={m.anchor} point={m.point} align="end" label={ch.name} onClose={m.close} entries={entriesOf(menu, CHANNEL_ITEM, onPick, ["edit", "moveTo", "archive", "restore", "delete"])} />
      )}
      {people.length > 0 && (
        <div className="voice-channel-people" aria-label={`${people.length} in ${ch.name}`}>
          {people.slice(0, 8).map((u) => (
            <span key={u} className="voice-person">
              <UserAvatar userId={u} name={users[u]?.displayName ?? "Someone"} colorIndex={users[u]?.avatarColor ?? 0} photoRev={users[u]?.photoRev} size={18} decorative />
              <span className="ellipsis">{users[u]?.displayName ?? "Someone"}</span>
              {sharing.includes(u) && (
                <span className="voice-sharing">
                  <MonitorUp size={11} aria-hidden="true" /> {t("live_sharing_short")}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});
