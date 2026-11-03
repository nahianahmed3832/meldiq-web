import { conversationPreview } from "../../sync/rules";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
  BookText,
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
import { GroupAvatar } from "../components/OrgAvatar";
import { LookAvatar, LookName } from "../people/NameStyle";
import { Dialog, Menu, type MenuEntry, useMenu } from "../components/Overlay";
import { conversationTitle, dmPeer, members, shortWhen } from "../format";
import { isMuted, isPeople } from "../selectors";
import { usePrefs } from "../../application/prefs";
import { useT } from "../../i18n";
const LEVELS: {
  level: NotifyLevel;
  label: string;
}[] = [
  {
    level: "all",
    get label() {
      return uiText("messaging.interface.all_new_messages_0bd334d");
    },
  },
  {
    level: "mentions",
    get label() {
      return uiText("messaging.interface.mentions_only_78732e1");
    },
  },
  {
    level: "none",
    get label() {
      return uiText("workspace.interface.off_muted_686a4e8");
    },
  },
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
        // Who (the first of them), for "Bob is meldling…" in the row.
        typer: (() => {
          const u = Object.entries(s.typing[id] ?? {}).find(([who, until]) => until > Date.now() && who !== s.me?.userId)?.[0];
          return u ? (s.users[u]?.displayName ?? null) : null;
        })(),
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
      a.typer === b.typer &&
      a.muted === b.muted &&
      a.peerPhoto === b.peerPhoto,
  );
  // Settings › Appearance › Message previews (android chat-list previews): all, unread ones only, or none.
  // API 0.65.0: a community's rules channel shows a book.
  const isRules = useOrbit((s) => {
    const conv = s.conversations[id];
    return conv?.type === "CHANNEL" && !!conv.orgId && s.orgs.find((o) => o.id === conv.orgId)?.rulesChannel?.channelId === id;
  });
  const { listPreview } = usePrefs();
  const t = useT();
  if (!data) return null;
  const { c, local, title, online, presence, peerId, peerColor, peerPhoto, typing, typer, muted } = data;
  const unread = local?.unread ?? 0;
  const showPreview = listPreview === "all" || (listPreview === "unread" && unread > 0);
  const mentions = local?.mentions ?? 0;
  const current = route.conversationId === id;
  if (hideRead && unread === 0 && !current) return null;
  const section = route.section === "dms" || route.section === "discover" ? "dms" : route.section === "activity" ? "activity" : "home";
  const glyph =
    c.type === "CHANNEL" ? (
      isRules ? (
        <BookText size={15} aria-label={t("organization.rules_title")} />
      ) : c.kind === "PRIVATE" ? (
        <Lock size={15} />
      ) : c.kind === "ANNOUNCEMENT" ? (
        <Megaphone size={15} />
      ) : (
        <Hash size={16} />
      )
    ) : c.type === "GROUP" ? (
      <GroupAvatar conversationId={c.id} name={title} photoRev={c.photoRev} size={twoLine ? 36 : 22} />
    ) : (
      <LookAvatar userId={peerId ?? ""} name={title} colorIndex={peerColor} photoRev={peerPhoto} size={twoLine ? 36 : 22} online={online} presence={presence} />
    );
  const marker = unreadMarker(unread, mentions, muted, c.type !== "CHANNEL");
  const label = `${c.type === "CHANNEL" ? uiText("workspace.interface.channel_af0e6a9") : ""}${title}${unreadLabel(unread, mentions, muted, { unread: (n) => uiText("organization.interface.value0_unread_f307d99", { value0: n }), mentions: (n) => uiText("organization.interface.value0_mentions_939b7f1", { value0: n }), muted: uiText("common.states.muted") })}`;
  const count = <UnreadBadge marker={marker} />;
  const highlight = isHighlighted(marker) ? " unread" : "";
  const href = `/${section}/c/${encodeURIComponent(id)}`;
  const openMenu = (e: MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const row = e.currentTarget.closest(".side-row") as HTMLElement;
    // A right-click opens the menu at the pointer; the ⋯ button, below itself.
    if (e.type === "contextmenu") menu.openAt(row, e);
    else menu.open(row);
  };
  const more = (
    <button className="row-more" aria-label={uiText("organization.interface.more_for_value0_87b81e8", { value0: title })} aria-haspopup="menu" onClick={openMenu}>
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
          {c.type === "DM" && peerId ? (
            <span className="grow ellipsis">
              <LookName userId={peerId} name={title} withSubscription />
            </span>
          ) : (
            <span className="grow ellipsis">{title}</span>
          )}
          <span className="time">{shortWhen(local?.lastActivityAt ?? 0)}</span>
        </span>
        <span className="row">
          <small className="grow ellipsis">
            {typing ? (
              <span className="row-typing" title={t("row_typing")}>
                <span aria-hidden="true">
                  {typer
                    ? uiText("workspace.interface.value0_value1_9fe094e", { value0: typer, value1: t("meldling_one") })
                    : uiText("workspace.interface.value0_48ee9c0", { value0: t("typing_meldling") })}
                </span>
                <span className="sr-only">{t("row_typing")}</span>
              </span>
            ) : !showPreview ? (
              ""
            ) : local?.lastPreview ? (
              uiText("messaging.interface.value0_value1_82032eb", {
                value0:
                  local.lastSenderName && c.type !== "DM"
                    ? `${(local.lastSenderOwn ?? local.lastSenderName === "You") ? t("workspace.nav_you") : local.lastSenderName}: `
                    : (local.lastSenderOwn ?? local.lastSenderName === "You")
                      ? uiText("workspace.interface.you_624103e")
                      : "",
                value1: conversationPreview(local) ?? "",
              })
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
      {menu.anchor && <RowMenu id={id} title={title} inPlace={!!inPlace} unread={unread > 0} anchor={menu.anchor} point={menu.point} onClose={menu.close} />}
    </div>
  );
});
function RowMenu({
  id,
  title,
  inPlace,
  unread,
  anchor,
  point,
  onClose,
}: {
  id: string;
  title: string;
  inPlace: boolean;
  unread: boolean;
  anchor: HTMLElement;
  point: {
    x: number;
    y: number;
  } | null;
  onClose: () => void;
}) {
  useLocaleRender();
  const l10n = useLocalization();
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
      ? {
          get label() {
            return uiText("organization.interface.remove_from_starred_1ae7d78");
          },
          icon: <StarOff size={16} />,
          onSelect: () => arrange({ op: "place", conversationId: id, sectionId: null, starred: false }),
        }
      : {
          get label() {
            return uiText("organization.interface.star_e357d39");
          },
          icon: <Star size={16} />,
          onSelect: () => arrange({ op: "place", conversationId: id, sectionId: null, starred: true }),
        },
    ...sections
      .filter((s) => !(place.k === "section" && place.id === s.id))
      .map((s) => ({
        label: uiText("workspace.interface.move_to_value0_c241e13", { value0: s.name }),
        icon: <FolderInput size={16} />,
        onSelect: () => arrange({ op: "place", conversationId: id, sectionId: s.id, starred: false }),
      })),
    {
      get label() {
        return uiText("workspace.interface.move_to_a_new_section_c8ba4d1");
      },
      icon: <FolderPlus size={16} />,
      onSelect: () => setNaming(true),
    },
    ...(place.k === "section"
      ? [
          {
            get label() {
              return uiText("workspace.interface.remove_from_section_a8f82a6");
            },
            icon: <FolderMinus size={16} />,
            onSelect: () => arrange({ op: "place", conversationId: id, sectionId: null, starred: false }),
          },
        ]
      : []),
    ...(inPlace && place.k !== "default"
      ? [
          {
            get label() {
              return uiText("organization.interface.move_up_c66feb5");
            },
            icon: <ArrowUp size={16} />,
            onSelect: () => arrange({ op: "move", conversationId: id, delta: -1 }),
          },
          {
            get label() {
              return uiText("organization.interface.move_down_40bb50d");
            },
            icon: <ArrowDown size={16} />,
            onSelect: () => arrange({ op: "move", conversationId: id, delta: 1 }),
          },
        ]
      : []),
    "separator",
    { heading: l10n("settings.notifications") },
    ...LEVELS.map((l) => ({
      label: l.label,
      icon: l.level === "all" ? <Bell size={16} /> : l.level === "mentions" ? <BellDot size={16} /> : <BellOff size={16} />,
      checked: level === l.level,
      onSelect: () => arrange({ op: "notify", conversationId: id, level: l.level }),
    })),
    "separator",
    unread
      ? { label: l10n("notifications.markRead"), icon: <Eye size={16} />, onSelect: () => void engine.setUnreadLocally(id, false) }
      : {
          get label() {
            return uiText("workspace.interface.mark_as_unread_2c19d58");
          },
          icon: <EyeOff size={16} />,
          onSelect: () => void engine.setUnreadLocally(id, true),
        },
    ...(isPeople(c)
      ? [
          archived
            ? {
                get label() {
                  return uiText("workspace.interface.unarchive_f565318");
                },
                icon: <ArchiveRestore size={16} />,
                onSelect: () => void engine.setArchivedLocally(id, false),
              }
            : {
                get label() {
                  return uiText("workspace.interface.archive_66f4804");
                },
                icon: <Archive size={16} />,
                onSelect: () => void engine.setArchivedLocally(id, true),
              },
        ]
      : []),
    {
      get label() {
        return uiText("organization.interface.details_45989de");
      },
      icon: <Info size={16} />,
      onSelect: () => navigate({ section: c.type === "CHANNEL" ? "home" : "dms", conversationId: id, panel: "details" }),
    },
  ];
  return (
    <>
      {!naming && <Menu anchor={anchor} point={point} entries={entries} onClose={onClose} align="end" label={uiText("workspace.interface.arrange_value0_508b91b", { value0: title })} />}
      {naming && (
        <SectionNameDialog
          title={uiText("workspace.interface.new_section_843c4a5")}
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
  useLocaleRender();
  const l10n = useLocalization();
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
        <input
          className="input"
          data-autofocus
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          aria-label={uiText("workspace.interface.section_name_7c0fadd")}
          placeholder={uiText("organization.interface.e_g_projects_03697e0")}
        />
        <p className="faint" style={{ margin: 0, fontSize: 13 }}>
          <Localized k="workspace.interface.sections_are_yours_alone_and_follow_you_to_every_device_the_serve_345b6df" />
        </p>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!name.trim()}>
            {l10n("common.actions.save")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
