import { LiveCallBadge } from "../components/LiveCallBadge";
import { isHighlighted, unreadLabel, unreadMarker } from "../unread";
import { UnreadBadge } from "../components/UnreadBadge";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Bell,
  BellDot,
  BellOff,
  Eye,
  EyeOff,
  FolderInput,
  FolderMinus,
  FolderPlus,
  Hash,
  Info,
  Lock,
  Megaphone,
  MoreHorizontal,
  Star,
  StarOff,
  UsersRound,
} from "lucide-react";
import { memo, type MouseEvent, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { navigate, useRoute } from "../../application/router";
import type { ConversationLocal } from "../../model/types";
import { levelOf, newSectionId, type NotifyLevel, placeOf, workspaceOf } from "../../sync/navPrefs";
import { GroupAvatar, UserAvatar } from "../components/OrgAvatar";
import { Dialog, Menu, type MenuEntry, useMenu } from "../components/Overlay";
import { conversationTitle, dmPeer, members, shortWhen } from "../format";
import { isMuted, isPeople } from "../selectors";
import { usePrefs } from "../../application/prefs";
import { useT } from "../../i18n";

const LEVELS: { level: NotifyLevel; label: string }[] = [
  { level: "all", label: "All new messages" },
  { level: "mentions", label: "Mentions only" },
  { level: "none", label: "Off (muted)" },
];

/**
 * One conversation in the sidebar. Its menu (the … button, or right-click) arranges it as on the phone's long-press:
 * star, move to a section, order, notification level (synced to every device), mark read or unread and archive (this
 * browser only).
 */
export const ConversationRow = memo(function ConversationRow({ id, twoLine, hideRead, inPlace }: { id: string; twoLine?: boolean; hideRead?: boolean; inPlace?: boolean }) {
  const route = useRoute();
  const menu = useMenu();
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
        presence: peer ? (s.users[peer.id]?.presence ?? null) : null,
        peerId: peer?.id ?? null,
        peerColor: peer?.avatarColor ?? 0,
        peerPhoto: peer ? (s.users[peer.id]?.photoRev ?? null) : null,
        typing: Object.values(s.typing[id] ?? {}).some((t) => t > Date.now()),
        muted: isMuted(s, c),
      };
    },
    (a, b) =>
      !!a &&
      !!b &&
      a.c === b.c &&
      a.local === b.local &&
      a.title === b.title &&
      a.online === b.online &&
      a.presence === b.presence &&
      a.typing === b.typing &&
      a.muted === b.muted &&
      a.peerPhoto === b.peerPhoto,
  );
  // Settings › Appearance › Message previews (android chat-list previews): all, unread ones only, or none.
  const { listPreview } = usePrefs();
  const t = useT();
  if (!data) return null;
  const { c, local, title, online, presence, peerId, peerColor, peerPhoto, typing, muted } = data;
  const unread = local?.unread ?? 0;
  const showPreview = listPreview === "all" || (listPreview === "unread" && unread > 0);
  const mentions = local?.mentions ?? 0;
  const current = route.conversationId === id;
  if (hideRead && unread === 0 && !current) return null;
  const section = route.section === "dms" || route.section === "discover" ? "dms" : route.section === "activity" ? "activity" : "home";
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
      <GroupAvatar conversationId={c.id} name={title} photoRev={c.photoRev} size={twoLine ? 36 : 22} />
    ) : (
      <UserAvatar userId={peerId ?? ""} name={title} colorIndex={peerColor} photoRev={peerPhoto} size={twoLine ? 36 : 22} online={online} presence={presence} decorative />
    );
  const marker = unreadMarker(unread, mentions, muted, c.type !== "CHANNEL");
  const label = `${c.type === "CHANNEL" ? "Channel " : ""}${title}${unreadLabel(unread, mentions, muted, { unread: (n) => `${n} unread`, mentions: (n) => `${n} mentions`, muted: "muted" })}`;
  const count = <UnreadBadge marker={marker} />;
  const highlight = isHighlighted(marker) ? " unread" : "";
  const href = `/${section}/c/${encodeURIComponent(id)}`;
  const openMenu = (e: MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    menu.open(e.currentTarget.closest(".side-row") as HTMLElement);
  };
  const more = (
    <button className="row-more" aria-label={`More for ${title}`} aria-haspopup="menu" onClick={openMenu}>
      <MoreHorizontal size={16} />
    </button>
  );
  const body = twoLine ? (
    <a className={`side-item two-line${highlight}${muted ? " muted" : ""}`} href={href} aria-current={current ? "page" : undefined} aria-label={label} onContextMenu={openMenu}>
      <span className="glyph" style={{ width: 36 }}>
        {glyph}
      </span>
      <span className="lines">
        <span className="row">
          <span className="grow ellipsis">{title}</span>
          <span className="time">{shortWhen(local?.lastActivityAt ?? 0)}</span>
        </span>
        <span className="row">
          <small className="grow ellipsis">
            {typing ? (
              <span className="row-typing" title={t("row_typing")}>
                <img src="/meldling-96.webp" width={14} height={14} alt="" draggable={false} />
                <span aria-hidden="true">{t("typing_meldling")}…</span>
                <span className="sr-only">{t("row_typing")}</span>
              </span>
            ) : !showPreview ? (
              ""
            ) : local?.lastPreview ? (
              `${local.lastSenderName && c.type !== "DM" ? `${local.lastSenderName}: ` : local.lastSenderName === "You" ? "You: " : ""}${local.lastPreview}`
            ) : c.type === "GROUP" ? (
              members(c.memberCount)
            ) : (
              t("row_no_messages")
            )}
          </small>
          <LiveCallBadge conversationId={id} />
          {muted && <BellOff size={12} className="faint" aria-hidden="true" />}
          {count}
        </span>
      </span>
    </a>
  ) : (
    <a className={`side-item${highlight}${muted ? " muted" : ""}`} href={href} aria-current={current ? "page" : undefined} aria-label={label} onContextMenu={openMenu}>
      <span className="glyph">{glyph}</span>
      <span className="grow ellipsis">{title}</span>
      {local?.draft && !current ? <span className="draft">{t("row_draft")}</span> : null}
      {c.type === "GROUP" && <UsersRound size={13} className="faint" aria-hidden="true" />}
      <LiveCallBadge conversationId={id} />
      {muted && <BellOff size={12} className="faint" aria-hidden="true" />}
      {count}
    </a>
  );
  return (
    <div className="side-row">
      {body}
      {more}
      {menu.anchor && <RowMenu id={id} title={title} inPlace={!!inPlace} unread={unread > 0} anchor={menu.anchor} onClose={menu.close} />}
    </div>
  );
});

function RowMenu({ id, title, inPlace, unread, anchor, onClose }: { id: string; title: string; inPlace: boolean; unread: boolean; anchor: HTMLElement; onClose: () => void }) {
  const engine = useEngine();
  const c = useOrbit((s) => s.conversations[id]);
  const ws = workspaceOf(c?.orgId ?? null);
  const prefs = useOrbit((s) => s.nav[ws]);
  const archived = useOrbit((s) => !!s.local[id]?.archivedAt);
  const [naming, setNaming] = useState(false);
  if (!c) return null;
  const place = prefs ? placeOf(prefs, id) : { k: "default" as const };
  const level = levelOf(prefs, id, c.categoryId);
  const sections = prefs?.sections ?? [];
  const arrange = (op: Parameters<typeof engine.arrange>[1]) => void engine.arrange(id, op);
  const entries: MenuEntry[] = [
    place.k === "starred"
      ? { label: "Remove from Starred", icon: <StarOff size={16} />, onSelect: () => arrange({ op: "place", conversationId: id, sectionId: null, starred: false }) }
      : { label: "Star", icon: <Star size={16} />, onSelect: () => arrange({ op: "place", conversationId: id, sectionId: null, starred: true }) },
    ...sections
      .filter((s) => !(place.k === "section" && place.id === s.id))
      .map((s) => ({ label: `Move to ${s.name}`, icon: <FolderInput size={16} />, onSelect: () => arrange({ op: "place", conversationId: id, sectionId: s.id, starred: false }) })),
    { label: "Move to a new section…", icon: <FolderPlus size={16} />, onSelect: () => setNaming(true) },
    ...(place.k === "section"
      ? [{ label: "Remove from section", icon: <FolderMinus size={16} />, onSelect: () => arrange({ op: "place", conversationId: id, sectionId: null, starred: false }) }]
      : []),
    ...(inPlace && place.k !== "default"
      ? [
          { label: "Move up", icon: <ArrowUp size={16} />, onSelect: () => arrange({ op: "move", conversationId: id, delta: -1 }) },
          { label: "Move down", icon: <ArrowDown size={16} />, onSelect: () => arrange({ op: "move", conversationId: id, delta: 1 }) },
        ]
      : []),
    "separator",
    { heading: "Notifications" },
    ...LEVELS.map((l) => ({
      label: l.label,
      icon: l.level === "all" ? <Bell size={16} /> : l.level === "mentions" ? <BellDot size={16} /> : <BellOff size={16} />,
      checked: level === l.level,
      onSelect: () => arrange({ op: "notify", conversationId: id, level: l.level }),
    })),
    "separator",
    unread
      ? { label: "Mark as read", icon: <Eye size={16} />, onSelect: () => void engine.setUnreadLocally(id, false) }
      : { label: "Mark as unread", icon: <EyeOff size={16} />, onSelect: () => void engine.setUnreadLocally(id, true) },
    ...(isPeople(c)
      ? [
          archived
            ? { label: "Unarchive", icon: <ArchiveRestore size={16} />, onSelect: () => void engine.setArchivedLocally(id, false) }
            : { label: "Archive", icon: <Archive size={16} />, onSelect: () => void engine.setArchivedLocally(id, true) },
        ]
      : []),
    { label: "Details", icon: <Info size={16} />, onSelect: () => navigate({ section: c.type === "CHANNEL" ? "home" : "dms", conversationId: id, panel: "details" }) },
  ];
  return (
    <>
      {!naming && <Menu anchor={anchor} entries={entries} onClose={onClose} align="end" label={`Arrange ${title}`} />}
      {naming && (
        <SectionNameDialog
          title="New section"
          initial=""
          onClose={onClose}
          onSave={(name) => {
            const sectionId = newSectionId();
            void engine.nav.change(ws, { op: "addSection", id: sectionId, name }).then(() => engine.nav.change(ws, { op: "place", conversationId: id, sectionId, starred: false }));
            onClose();
          }}
        />
      )}
    </>
  );
}

export function SectionNameDialog({ title, initial, onSave, onClose }: { title: string; initial: string; onSave: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState(initial);
  return (
    <Dialog title={title} onClose={onClose}>
      <form
        className="dialog-body"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim());
        }}
      >
        <input className="input" data-autofocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label="Section name" placeholder="e.g. Projects" />
        <p className="faint" style={{ margin: 0, fontSize: 13 }}>
          Sections are yours alone and follow you to every device. The server can see their names, never your messages.
        </p>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!name.trim()}>
            Save
          </button>
        </div>
      </form>
    </Dialog>
  );
}
