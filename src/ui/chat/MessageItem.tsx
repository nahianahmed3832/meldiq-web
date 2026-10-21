import {
  AlarmClock,
  Bookmark,
  BookmarkX,
  Check,
  CheckCheck,
  CircleAlert,
  Clock,
  Copy,
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
import { useEngine, useOrbit } from "../../app/orbit";
import { PERSONAL } from "../../sync/navPrefs";
import { RemindMeDialog } from "../later/RemindMeDialog";
import type { StoredMessage } from "../../model/types";
import { Avatar } from "../components/Avatar";
import { callLine } from "../../sync/callHistory";
import { ForwardDialog } from "../dialogs/ForwardDialog";
import { Dialog, Menu, useMenu } from "../components/Overlay";
import { clock, fullTime } from "../format";
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
import { translationSupported } from "../../sync/translate";
import { findMediaLink } from "../../sync/mediaLinks";
import { usePrefs } from "../../app/prefs";
import { EmojiPicker } from "./EmojiPicker";

export const QUICK_EMOJI = ["👍", "❤️", "😂", "🎉", "🙏", "👀"];

export interface MessageItemProps {
  m: StoredMessage;
  first: boolean;
  senderName: string;
  senderColor: number;
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
  const { m } = p;
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [forwarding, setForwarding] = useState(false);
  const [info, setInfo] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [reminding, setReminding] = useState(false);
  // Saved for later (android Home › Later): synced in the personal document when the server keeps saved items.
  const savable = useOrbit((st) => st.server?.features.includes("saved-items") ?? false);
  const { mediaCards } = usePrefs();
  const saved = useOrbit((st) => st.nav[PERSONAL]?.saved?.find((x) => x.messageId === m.id));
  const more = useMenu();
  const picker = useMenu();
  const mine = m.outgoing;
  const mentioned = !mine && (m.mentions.includes(p.myUserId) || m.mentionAll);
  const live = m.kind === "text" && !m.deleted;

  const body = () => {
    if (m.kind === "call") {
      const line = callLine(m.call?.info, m.call?.video ?? false, mine, p.senderName);
      return (
        <span className={`msg-call${line.missed ? " missed" : ""}`}>
          {m.call?.video ? <Video size={16} /> : line.missed ? <PhoneMissed size={16} /> : <Phone size={16} />}
          <span>
            {line.title}
            {line.detail && <small className="msg-call-detail">{line.detail}</small>}
          </span>
        </span>
      );
    }
    if (m.kind === "undecryptable")
      return (
        <span className="msg-undecryptable" title={m.errorText ?? undefined}>
          <ShieldAlert size={15} /> {m.text}
        </span>
      );
    if (m.deleted) return <span className="msg-deleted">This message was deleted.</span>;
    if (editing) return <EditBox m={m} onDone={() => setEditing(false)} />;
    // A poll, contact, location, sticker or animated emoji is the message itself: no card under it (android MessageBubble).
    const structured = !!(m.rich?.poll || m.rich?.contact || m.rich?.location || m.rich?.sticker || m.rich?.animoji);
    const mediaLink = mediaCards && !structured ? findMediaLink(m.text) : null;
    return (
      <>
        {p.replyTo && (
          <button className="msg-quote" onClick={() => p.onJump(p.replyTo!.id)} aria-label={`Reply to ${p.replyTo.name}: ${p.replyTo.text}`}>
            <strong>{p.replyTo.name}</strong>
            <span className="ellipsis">{p.replyTo.text || "Attachment"}</span>
          </button>
        )}
        {m.forwarded && (
          <div className="msg-forwarded">
            <Forward size={12} aria-hidden="true" /> Forwarded
          </div>
        )}
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
            <RichText text={m.text} mentionNames={p.mentionNames} myUsername={p.myUsername} />
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
        <Attachments refs={m.attachments} />
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
  return (
    <div
      className={`msg${mine ? " mine" : ""}${p.first ? " first" : ""}${mentioned ? " mentioned" : ""}${p.highlighted ? " highlight" : ""}${more.anchor || picker.anchor ? " menu-open" : ""}`}
      id={`msg-${m.id}`}
      role="article"
      aria-label={`${p.senderName}, ${fullTime(m.sortTs)}`}
      tabIndex={-1}
    >
      <div className="msg-gutter">
        {p.first ? <Avatar name={p.senderName} colorIndex={p.senderColor} size={38} decorative /> : <time dateTime={new Date(m.sortTs).toISOString()}>{clock(m.sortTs)}</time>}
      </div>
      <div className="msg-main">
        {p.first && (
          <div className="msg-head">
            <strong className="ellipsis">{p.senderName}</strong>
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
        {reactions.length > 0 && (
          <div className="reactions">
            {reactions.map(([emoji, users]) => (
              <button
                key={emoji}
                className="reaction"
                aria-pressed={users.includes(p.myUserId)}
                disabled={!p.canPost}
                onClick={() => void engine.react(m, emoji)}
                aria-label={`${emoji} ${users.length}, ${users.includes(p.myUserId) ? "remove your reaction" : "react"}`}
              >
                <span>{emoji}</span>
                {users.length}
              </button>
            ))}
          </div>
        )}
        {p.threadCount > 0 && p.onThread && (
          <button className="thread-link" onClick={() => p.onThread?.(m)}>
            <MessagesSquare size={15} /> {p.threadCount} {p.threadCount === 1 ? "reply" : "replies"}
          </button>
        )}
      </div>

      {live && !editing && (
        <div className="msg-actions" role="toolbar" aria-label="Message actions">
          {p.canPost &&
            QUICK_EMOJI.slice(0, 3).map((e) => (
              <button key={e} className="icon-btn quick-emoji" onClick={() => void engine.react(m, e)} aria-label={`React ${e}`}>
                {e}
              </button>
            ))}
          {p.canPost && (
            <button className="icon-btn" onClick={(e) => picker.open(e.currentTarget)} aria-label="Add reaction" aria-haspopup="menu">
              <SmilePlus size={17} />
            </button>
          )}
          {p.canPost && (
            <button className="icon-btn" onClick={() => p.onReply(m)} aria-label="Reply">
              <MessageSquareReply size={17} />
            </button>
          )}
          {p.onThread && !m.threadRootId && (
            <button className="icon-btn" onClick={() => p.onThread?.(m)} aria-label="Reply in thread">
              <MessagesSquare size={17} />
            </button>
          )}
          <button className="icon-btn" onClick={(e) => more.open(e.currentTarget)} aria-label="More actions" aria-haspopup="menu">
            <MoreHorizontal size={17} />
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
          onClose={more.close}
          entries={[
            ...(mine && p.canPost ? [{ label: "Edit", icon: <Pencil size={16} />, onSelect: () => setEditing(true) }] : []),
            ...(p.canPost
              ? [{ label: m.pinned ? "Unpin" : "Pin to conversation", icon: m.pinned ? <PinOff size={16} /> : <Pin size={16} />, onSelect: () => void engine.setPinned(m, !m.pinned) }]
              : []),
            ...(live && savable
              ? [
                  saved
                    ? { label: "Remove from Later", icon: <BookmarkX size={16} />, onSelect: () => void engine.later({ op: "unsave", messageId: m.id }) }
                    : {
                        label: "Save for later",
                        icon: <Bookmark size={16} />,
                        onSelect: () => void engine.later({ op: "save", conversationId: m.conversationId, messageId: m.id, savedAt: Date.now(), remindAt: null }),
                      },
                  { label: saved?.remindAt ? "Change reminder…" : "Remind me…", icon: <AlarmClock size={16} />, onSelect: () => setReminding(true) },
                ]
              : []),
            ...(live ? [{ label: "Forward…", icon: <Forward size={16} />, onSelect: () => setForwarding(true) }] : []),
            ...(m.text ? [{ label: "Copy text", icon: <Copy size={16} />, onSelect: () => void navigator.clipboard?.writeText(m.text) }] : []),
            ...(!mine && m.text && translationSupported() ? [{ label: "Translate…", icon: <Languages size={16} />, onSelect: () => setTranslating(true) }] : []),
            ...(mine ? [{ label: "Message info", icon: <Info size={16} />, onSelect: () => setInfo(true) }] : []),
            ...(mine && p.canPost ? ["separator" as const, { label: "Delete for everyone", icon: <Trash2 size={16} />, danger: true, onSelect: () => setConfirmDelete(true) }] : []),
          ]}
        />
      )}
      {forwarding && <ForwardDialog message={m} onClose={() => setForwarding(false)} />}
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
