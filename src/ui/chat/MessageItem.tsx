import {
  AlarmClock,
  Bookmark,
  BookmarkX,
  Check,
  CheckCheck,
  CircleAlert,
  Clock,
  Copy,
  Flag,
  Link2,
  Forward,
  Info,
  Languages,
  MapPin,
  MessageSquareReply,
  MessagesSquare,
  MoreHorizontal,
  Pencil,
  Phone,
  PhoneMissed,
  Pin,
  PinOff,
  ShieldAlert,
  SmilePlus,
  Trash2,
  UserRound,
  Video,
} from "lucide-react";
import { memo, useState } from "react";
import { CustomEmojiImage, useExpressions } from "../community/CustomEmoji";
import { reactionName } from "../../sync/expressions";
import { useEngine, useOrbit } from "../../application/orbit";
import { PERSONAL } from "../../sync/navPrefs";
import { RemindMeDialog } from "../later/RemindMeDialog";
import type { RichContent, StoredMessage } from "../../model/types";
import { nameTone } from "../components/Avatar";
import { UserAvatar } from "../components/OrgAvatar";
import { callLine } from "../../sync/callHistory";
import { ForwardDialog } from "../dialogs/ForwardDialog";
import { Dialog, Menu, type MenuEntry, useMenu } from "../components/Overlay";
import { ReactionList, ReactionsDialog } from "./Reactions";
import { useLongPress } from "./longPress";
import { mergeHandlers, useMessageGestures } from "./gestures";
import { clock, dayLabel, fullTime } from "../format";
import { openInApp } from "./inAppLinks";
import { useT } from "../../i18n";
import { isWebUrl } from "../../protocol/payload";
import { Attachments } from "./Attachments";
import { isEmojiOnly, RichText } from "./RichText";
import { SafeLink } from "./SafeLink";
import { AnimojiView } from "./AnimojiView";
import { PollView } from "./PollView";
import { StickerView } from "./StickerView";
import { MediaLinkCard } from "./MediaLinkCard";
import { ProfileCardView } from "./ProfileCards";
import { MessageInfoDialog } from "./MessageInfo";
import { TranslateDialog, TranslationView } from "./Translate";
import { findMediaLink } from "../../sync/mediaLinks";
import { usePrefs } from "../../application/prefs";
import { EmojiPicker } from "./EmojiPicker";
import { ReportDialog } from "./ReportDialog";
import { openProfile } from "../people/ProfileDialog";
import { canLink, messageLink } from "../../sync/messageLinks";

export const QUICK_EMOJI = ["👍", "❤️", "😂", "🎉", "🙏", "👀"];
/** The hover toolbar's icon size, as large as Discord's so each action is easy to hit. */
const TOOL_ICON = 20;

export interface MessageItemProps {
  m: StoredMessage;
  first: boolean;
  senderName: string;
  senderColor: number;
  /** The sender's profile photo revision, where their privacy setting lets this account see it. */
  senderPhotoRev?: number | null;
  myUserId: string;
  myUsername: string;
  /** Usernames of the people this message mentions (for highlighting). */
  mentionNames: Set<string>;
  replyTo: { name: string; text: string; id: string } | null;
  threadCount: number;
  canPost: boolean;
  highlighted: boolean;
  onReply: (m: StoredMessage) => void;
  onThread: ((m: StoredMessage) => void) | null;
  onJump: (id: string) => void;
  onReview: () => void;
}

export const MessageItem = memo(function MessageItem(p: MessageItemProps) {
  const engine = useEngine();
  const t = useT();
  const { m } = p;
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [forwarding, setForwarding] = useState(false);
  const [info, setInfo] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [reminding, setReminding] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const reportable = useOrbit((st) => st.server?.features.includes("reports") ?? false);
  const inCommunity = useOrbit((st) => {
    const c = st.conversations[m.conversationId];
    return c?.type === "CHANNEL" && c.orgId ? c.orgId : null;
  });
  // Batch B12: community emoji reactions are drawn from the community's current emoji (only loaded where used).
  const hasCustomReaction = Object.keys(m.reactions).some((e) => reactionName(e) !== null);
  const communityEmoji = useExpressions(hasCustomReaction || inCommunity ? inCommunity : null);
  const conv = useOrbit((st) => st.conversations[m.conversationId]);
  const orgName = useOrbit((st) => (conv?.orgId ? (st.orgs.find((o) => o.id === conv.orgId)?.name ?? null) : null));
  // Saved for later (android Home › Later): synced in the personal document when the server keeps saved items.
  const savable = useOrbit((st) => st.server?.features.includes("saved-items") ?? false);
  const { mediaCards, swipeToReply, doubleTapReact, quickReaction } = usePrefs();
  const saved = useOrbit((st) => st.nav[PERSONAL]?.saved?.find((x) => x.messageId === m.id));
  const more = useMenu();
  const picker = useMenu();
  // Touch screens have no hover toolbar: a long press opens the menu with quick reactions, reply and the rest.
  const [pressed, setPressed] = useState(false);
  const mine = m.outgoing;
  const mentioned = !mine && (m.mentions.includes(p.myUserId) || m.mentionAll);
  const live = m.kind === "text" && !m.deleted;

  const body = () => {
    if (m.kind === "call") {
      // A call card (android, 2026-10-23): the outcome, its details, when it was, and who called; missed in red.
      const line = callLine(m.call?.info, m.call?.video ?? false, mine, p.senderName);
      const when = `${dayLabel(m.sortTs)} ${clock(m.sortTs)}`;
      return (
        <span className={`msg-call${line.missed ? " missed" : ""}`}>
          <span className="msg-call-icon" aria-hidden="true">
            {m.call?.video ? <Video size={17} /> : line.missed ? <PhoneMissed size={17} /> : <Phone size={17} />}
          </span>
          <span className="msg-call-lines">
            <strong>{line.title}</strong>
            <small className="msg-call-detail">{[line.detail, when].filter(Boolean).join(" · ")}</small>
          </span>
          <UserAvatar userId={m.senderUserId} name={p.senderName} colorIndex={p.senderColor} photoRev={p.senderPhotoRev} size={28} decorative />
        </span>
      );
    }
    if (m.kind === "undecryptable")
      return (
        <span className="msg-undecryptable" title={m.errorText ?? undefined}>
          <ShieldAlert size={15} /> {m.text}
        </span>
      );
    if (m.deleted) return <span className="msg-deleted">{t("msg_deleted")}</span>;
    if (editing) return <EditBox m={m} onDone={() => setEditing(false)} />;
    // A poll, contact, location, sticker or animated emoji is the message itself: no card under it (android MessageBubble).
    const structured = !!(m.rich?.poll || m.rich?.contact || m.rich?.location || m.rich?.sticker || m.rich?.animoji || m.rich?.customSticker);
    const mediaLink = mediaCards && !structured ? findMediaLink(m.text) : null;
    return (
      <>
        {p.replyTo && (
          <button className="msg-quote" onClick={() => p.onJump(p.replyTo!.id)} aria-label={`Reply to ${p.replyTo.name}: ${p.replyTo.text}`}>
            <strong>{p.replyTo.name}</strong>
            <span className="ellipsis">{p.replyTo.text || "Attachment"}</span>
          </button>
        )}
        {m.forwarded && <ForwardedLine origin={m.rich?.origin} />}
        {m.rich?.poll ? (
          <div>
            <PollView m={m} myUserId={p.myUserId} canPost={p.canPost} />
            {mine && <Status m={m} onRetry={() => void engine.retry(m.id)} onReview={p.onReview} />}
          </div>
        ) : m.rich?.sticker ? (
          <div>
            <StickerView sticker={m.rich.sticker} fallback={m.text} />
            {mine && <Status m={m} onRetry={() => void engine.retry(m.id)} onReview={p.onReview} />}
          </div>
        ) : m.rich?.customSticker ? (
          <div>
            <CustomEmojiImage id={m.rich.customSticker.id} name={m.rich.customSticker.name} sha256={m.rich.customSticker.sha256} sticker />
            {mine && <Status m={m} onRetry={() => void engine.retry(m.id)} onReview={p.onReview} />}
          </div>
        ) : m.rich?.animoji ? (
          <div>
            <AnimojiView emoji={m.rich.animoji} />
            {mine && <Status m={m} onRetry={() => void engine.retry(m.id)} onReview={p.onReview} />}
          </div>
        ) : m.rich?.contact?.userId ? (
          <div>
            <ProfileCardView card={m.rich.contact} />
            {mine && <Status m={m} onRetry={() => void engine.retry(m.id)} onReview={p.onReview} />}
          </div>
        ) : m.rich?.contact ? (
          <span className="msg-call">
            <UserRound size={16} /> {m.rich.contact.name}
            {m.rich.contact.phones.length ? ` · ${m.rich.contact.phones.join(", ")}` : ""}
          </span>
        ) : m.rich?.location ? (
          <a
            className="msg-call"
            href={`https://www.openstreetmap.org/?mlat=${m.rich.location.lat}&mlon=${m.rich.location.lon}#map=16/${m.rich.location.lat}/${m.rich.location.lon}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPin size={16} /> {m.rich.location.label ?? "Shared location"} · open map
          </a>
        ) : m.text ? (
          <div className={`msg-text${isEmojiOnly(m.text) ? " big-emoji" : ""}`}>
            <RichText text={m.text} mentionNames={p.mentionNames} myUsername={p.myUsername} customEmoji={m.rich?.customEmoji} />
            {m.editedAt && <span className="msg-meta">(edited)</span>}
            {translation && <TranslationView text={translation} onHide={() => setTranslation(null)} />}
            {mine && <Status m={m} onRetry={() => void engine.retry(m.id)} onReview={p.onReview} />}
          </div>
        ) : (
          mine && (
            <div>
              <Status m={m} onRetry={() => void engine.retry(m.id)} onReview={p.onReview} />
            </div>
          )
        )}
        <Attachments
          refs={m.attachments}
          viewer={{
            sender: p.senderName,
            at: m.sortTs,
            text: m.text,
            quick: QUICK_EMOJI,
            reacted: Object.entries(m.reactions)
              .filter(([, who]) => who.includes(p.myUserId))
              .map(([e]) => e),
            onReact: live && p.canPost ? (e) => void engine.react(m, e) : null,
          }}
        />
        {mediaLink ? (
          <MediaLinkCard link={mediaLink} preview={m.rich?.link?.url === mediaLink.url ? m.rich.link : null} />
        ) : (
          m.rich?.link &&
          isWebUrl(m.rich.link.url) && (
            <SafeLink className="msg-quote link-preview" href={m.rich.link.url}>
              <strong>{m.rich.link.title ?? m.rich.link.siteName ?? m.rich.link.url}</strong>
              {m.rich.link.description && (
                <span className="ellipsis" style={{ display: "block" }}>
                  {m.rich.link.description}
                </span>
              )}
            </SafeLink>
          )
        )}
      </>
    );
  };

  const reactions = Object.entries(m.reactions);
  const press = useLongPress(
    (el) => {
      setPressed(true);
      more.open(el);
    },
    !editing && m.kind !== "call",
  );
  // Swipe left to reply (touch), double-tap or double-click to react (Settings › Appearance › Gestures).
  const canAct = live && p.canPost && !editing;
  const gestures = useMessageGestures(canAct && swipeToReply ? () => p.onReply(m) : null, canAct && doubleTapReact ? () => void engine.react(m, quickReaction) : null);
  const quickRow: MenuEntry[] =
    pressed && live && p.canPost
      ? [
          {
            custom: (
              <div className="menu-quick" role="group" aria-label={t("msg_quick_reactions")}>
                {QUICK_EMOJI.map((e) => (
                  <button
                    key={e}
                    className="icon-btn quick-emoji"
                    aria-label={`React ${e}`}
                    onClick={() => {
                      more.close();
                      void engine.react(m, e);
                    }}
                  >
                    {e}
                  </button>
                ))}
                <button
                  className="icon-btn"
                  aria-label={t("msg_add_reaction")}
                  onClick={() => {
                    const anchor = more.anchor;
                    more.close();
                    if (anchor) picker.open(anchor);
                  }}
                >
                  <SmilePlus size={18} />
                </button>
              </div>
            ),
          },
          { label: t("msg_reply"), icon: <MessageSquareReply size={16} />, onSelect: () => p.onReply(m) },
          ...(p.onThread && !m.threadRootId ? [{ label: t("msg_reply_thread"), icon: <MessagesSquare size={16} />, onSelect: () => p.onThread?.(m) }] : []),
          "separator",
        ]
      : [];
  return (
    <div
      {...mergeHandlers(press, gestures.handlers)}
      style={gestures.offset ? { transform: `translateX(${gestures.offset}px)` } : undefined}
      className={`msg${gestures.offset ? " swiping" : ""}${mine ? " mine" : ""}${p.first ? " first" : ""}${mentioned ? " mentioned" : ""}${p.highlighted ? " highlight" : ""}${more.anchor || picker.anchor ? " menu-open" : ""}`}
      id={`msg-${m.id}`}
      role="article"
      aria-label={`${p.senderName}, ${fullTime(m.sortTs)}`}
      tabIndex={-1}
    >
      <div className="msg-gutter">
        {p.first ? (
          <button className="msg-avatar-btn" onClick={() => openProfile(m.senderUserId, p.senderName)} aria-label={`${p.senderName}'s profile`} tabIndex={-1}>
            <UserAvatar userId={m.senderUserId} name={p.senderName} colorIndex={p.senderColor} photoRev={p.senderPhotoRev} size={38} decorative />
          </button>
        ) : (
          <time dateTime={new Date(m.sortTs).toISOString()}>{clock(m.sortTs)}</time>
        )}
      </div>
      <div className="msg-main">
        {p.first && (
          <div className="msg-head">
            <button className={`msg-name ellipsis ${nameTone(p.senderColor)}`} onClick={() => openProfile(m.senderUserId, p.senderName)}>
              {p.senderName}
            </button>
            <time dateTime={new Date(m.sortTs).toISOString()} title={fullTime(m.sortTs)}>
              {clock(m.sortTs)}
            </time>
            {m.pinned && (
              <span className="tag">
                <Pin size={11} /> Pinned
              </span>
            )}
          </div>
        )}
        {body()}
        <ReactionList message={m} myUserId={p.myUserId} canPost={p.canPost} communityEmoji={communityEmoji} />
        {p.threadCount > 0 && p.onThread && (
          <button className="thread-link" onClick={() => p.onThread?.(m)}>
            <MessagesSquare size={15} /> {p.threadCount} {p.threadCount === 1 ? "reply" : "replies"}
          </button>
        )}
      </div>

      {live && !editing && (
        <div className="msg-actions" role="toolbar" aria-label={t("msg_actions")}>
          {p.canPost &&
            QUICK_EMOJI.slice(0, 3).map((e) => (
              <button key={e} className="icon-btn quick-emoji" onClick={() => void engine.react(m, e)} aria-label={`React ${e}`}>
                {e}
              </button>
            ))}
          {p.canPost && (
            <button className="icon-btn" onClick={(e) => picker.open(e.currentTarget)} aria-label={t("msg_add_reaction")} title={t("msg_add_reaction")} aria-haspopup="menu">
              <SmilePlus size={TOOL_ICON} />
            </button>
          )}
          {p.canPost && (
            <button className="icon-btn" onClick={() => p.onReply(m)} aria-label={t("msg_reply")} title={t("msg_reply")}>
              <MessageSquareReply size={TOOL_ICON} />
            </button>
          )}
          {p.onThread && !m.threadRootId && (
            <button className="icon-btn" onClick={() => p.onThread?.(m)} aria-label={t("msg_reply_thread")} title={t("msg_reply_thread")}>
              <MessagesSquare size={TOOL_ICON} />
            </button>
          )}
          {mine && p.canPost && (
            <button className="icon-btn" onClick={() => setEditing(true)} aria-label={t("msg_edit")} title={t("msg_edit")}>
              <Pencil size={TOOL_ICON} />
            </button>
          )}
          <button className="icon-btn" onClick={() => setForwarding(true)} aria-label={t("msg_forward")} title={t("msg_forward")}>
            <Forward size={TOOL_ICON} />
          </button>
          <button className="icon-btn" onClick={(e) => more.open(e.currentTarget)} aria-label={t("msg_more")} title={t("msg_more")} aria-haspopup="menu">
            <MoreHorizontal size={TOOL_ICON} />
          </button>
        </div>
      )}
      {picker.anchor && (
        <Menu
          anchor={picker.anchor}
          align="end"
          label="Reactions"
          onClose={picker.close}
          entries={[
            {
              custom: (
                <EmojiPicker
                  community={communityEmoji ? { list: communityEmoji, reactions: true } : undefined}
                  onPick={(e) => {
                    picker.close();
                    void engine.react(m, e);
                  }}
                />
              ),
            },
          ]}
        />
      )}
      {more.anchor && (
        <Menu
          anchor={more.anchor}
          align="end"
          label="Message"
          onClose={() => {
            more.close();
            setPressed(false);
          }}
          entries={[
            ...quickRow,
            ...(reactions.length > 0 ? [{ label: t("react_dialog_title"), icon: <SmilePlus size={16} />, onSelect: () => setShowReactions(true) }] : []),
            ...(mine && p.canPost ? [{ label: t("msg_edit"), icon: <Pencil size={16} />, onSelect: () => setEditing(true) }] : []),
            ...(p.canPost ? [{ label: m.pinned ? t("msg_unpin") : t("msg_pin"), icon: m.pinned ? <PinOff size={16} /> : <Pin size={16} />, onSelect: () => void engine.setPinned(m, !m.pinned) }] : []),
            ...(live && savable
              ? [
                  saved
                    ? { label: t("msg_remove_later"), icon: <BookmarkX size={16} />, onSelect: () => void engine.later({ op: "unsave", messageId: m.id }) }
                    : {
                        label: t("msg_save_later"),
                        icon: <Bookmark size={16} />,
                        onSelect: () => void engine.later({ op: "save", conversationId: m.conversationId, messageId: m.id, savedAt: Date.now(), remindAt: null }),
                      },
                  { label: saved?.remindAt ? t("msg_change_reminder") : t("msg_remind"), icon: <AlarmClock size={16} />, onSelect: () => setReminding(true) },
                ]
              : []),
            ...(live ? [{ label: t("msg_forward_dots"), icon: <Forward size={16} />, onSelect: () => setForwarding(true) }] : []),
            ...(m.text ? [{ label: t("msg_copy_text"), icon: <Copy size={16} />, onSelect: () => void navigator.clipboard?.writeText(m.text) }] : []),
            // Offered on every received message (2026-10-23): where the browser can't translate on the device, it says why.
            ...(!mine && m.text ? [{ label: t("msg_translate"), icon: <Languages size={16} />, onSelect: () => setTranslating(true) }] : []),
            ...(live && canLink(m.deleted, m.status)
              ? [
                  {
                    label: t("msg_copy_link"),
                    icon: <Link2 size={16} />,
                    onSelect: () => {
                      void navigator.clipboard?.writeText(messageLink(m.conversationId, m.id)).catch(() => undefined);
                      engine.notice("info", t("msg_link_copied"));
                    },
                  },
                ]
              : []),
            ...(mine ? [{ label: t("msg_info"), icon: <Info size={16} />, onSelect: () => setInfo(true) }] : []),
            ...(!mine && live && reportable && conv ? ["separator" as const, { label: t("msg_report"), icon: <Flag size={16} />, danger: true, onSelect: () => setReporting(true) }] : []),
            ...(mine && p.canPost ? ["separator" as const, { label: t("msg_delete_all"), icon: <Trash2 size={16} />, danger: true, onSelect: () => setConfirmDelete(true) }] : []),
          ]}
        />
      )}
      {showReactions && <ReactionsDialog message={m} initial={null} myUserId={p.myUserId} communityEmoji={communityEmoji} onClose={() => setShowReactions(false)} />}
      {forwarding && <ForwardDialog message={m} onClose={() => setForwarding(false)} />}
      {reporting && conv && <ReportDialog target={{ kind: "message", message: m, conversationId: m.conversationId, conversationType: conv.type, orgName }} onClose={() => setReporting(false)} />}
      {info && <MessageInfoDialog m={m} onClose={() => setInfo(false)} />}
      {translating && (
        <TranslateDialog
          text={m.text}
          onClose={() => setTranslating(false)}
          onDone={(t) => {
            setTranslating(false);
            setTranslation(t);
          }}
        />
      )}
      {reminding && (
        <RemindMeDialog
          title="Remind me about this message"
          current={saved?.remindAt ?? null}
          onPick={(at) => {
            setReminding(false);
            void engine.later({ op: "save", conversationId: m.conversationId, messageId: m.id, savedAt: saved?.savedAt ?? Date.now(), remindAt: at });
          }}
          onClear={saved ? () => (setReminding(false), void engine.later({ op: "remind", messageId: m.id, remindAt: null })) : undefined}
          onClose={() => setReminding(false)}
        />
      )}
      {confirmDelete && (
        <Dialog
          title="Delete this message for everyone?"
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                data-autofocus
                onClick={() => {
                  setConfirmDelete(false);
                  void engine.deleteForEveryone(m);
                }}
              >
                Delete
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p className="muted" style={{ margin: 0 }}>
              It's removed from this browser and your other devices, and everyone in the conversation is asked to remove it. Deletion is cooperative: an app that ignores it could keep a copy.
            </p>
          </div>
        </Dialog>
      )}
    </div>
  );
});

function Status({ m, onRetry, onReview }: { m: StoredMessage; onRetry: () => void; onReview: () => void }) {
  switch (m.status) {
    case "SENDING":
      return (
        <span className="msg-meta" title="Sending">
          <Clock size={12} aria-label="Sending" />
        </span>
      );
    case "SENT":
      return (
        <span className="msg-meta" title="Sent">
          <Check size={13} aria-label="Sent" />
        </span>
      );
    case "DELIVERED":
      return (
        <span className="msg-meta" title="Delivered">
          <CheckCheck size={13} aria-label="Delivered" />
        </span>
      );
    case "READ":
      return (
        <span className="msg-meta read" title={`Read${m.readBy.length ? ` by ${m.readBy.length}` : ""}`}>
          <CheckCheck size={13} aria-label="Read" />
        </span>
      );
    case "FAILED":
      return (
        <span className="msg-meta failed">
          <CircleAlert size={13} /> {m.errorText ?? "Not sent"} ·{" "}
          <button className="msg-retry" onClick={onRetry}>
            Retry
          </button>
        </span>
      );
    case "HELD":
      return (
        <span className="msg-meta failed">
          <ShieldAlert size={13} /> Paused: a security key changed ·{" "}
          <button className="msg-retry" onClick={onReview}>
            Review
          </button>
        </span>
      );
    default:
      return null;
  }
}

function EditBox({ m, onDone }: { m: StoredMessage; onDone: () => void }) {
  const engine = useEngine();
  const [text, setText] = useState(m.text);
  const save = () => {
    if (text.trim() && text.trim() !== m.text) void engine.edit(m, text);
    onDone();
  };
  return (
    <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
      <textarea
        className="textarea"
        value={text}
        autoFocus
        rows={Math.min(8, text.split("\n").length + 1)}
        aria-label="Edit message"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") onDone();
        }}
      />
      <div className="row">
        <span className="faint" style={{ fontSize: 12 }}>
          Enter to save · Esc to cancel
        </span>
        <span className="grow" />
        <button className="btn btn-secondary btn-sm" onClick={onDone}>
          Cancel
        </button>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={!text.trim()}>
          Save
        </button>
      </div>
    </div>
  );
}

/**
 * "Forwarded", and for a message forwarded out of a community channel where it came from (android, 2026-10-23):
 * "Forwarded · Community • time ›", which opens the original for people in that channel.
 */
function ForwardedLine({ origin }: { origin: RichContent["origin"] }) {
  const engine = useEngine();
  const t = useT();
  if (!origin)
    return (
      <div className="msg-forwarded">
        <Forward size={12} aria-hidden="true" /> {t("msg_forwarded")}
      </div>
    );
  const where = `${origin.place}${origin.at ? ` • ${dayLabel(origin.at)} ${clock(origin.at)}` : ""}`;
  const link = origin.conversationId && origin.messageId ? messageLink(origin.conversationId, origin.messageId) : null;
  return (
    <div className="msg-forwarded">
      <Forward size={12} aria-hidden="true" /> {t("msg_forwarded")} ·{" "}
      {link ? (
        <button className="msg-forwarded-origin" onClick={() => openInApp(engine, link)} aria-label={`Open the original in ${origin.place}`}>
          {where} ›
        </button>
      ) : (
        <span>{where}</span>
      )}
    </div>
  );
}
