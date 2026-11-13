import { formatUiNumber } from "../../i18n/format";
import { UNSUPPORTED_TEXT } from "../../sync/rules";
import { countLabel } from "../../i18n/counts";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { CharLimitNote, overCharLimit } from "../mojo/CharLimit";
import { useMojoLimits } from "../mojo/useMojoLimits";
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
  IdCard,
} from "lucide-react";
import { useContext, memo, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { CustomEmojiImage, useExpressions } from "../community/CustomEmoji";
import { reactionName } from "../../sync/expressions";
import { useEngine, useOrbit } from "../../application/orbit";
import { PERSONAL } from "../../sync/navPrefs";
import { DEFAULT_QUICK_REACTIONS } from "../../sync/quickReactions";
import { RemindMeDialog } from "../later/RemindMeDialog";
import type { RichContent, StoredMessage } from "../../model/types";
import { nameTone } from "../components/Avatar";
import { UserAvatar } from "../components/OrgAvatar";
import { callLine } from "../../sync/callHistory";
import { ForwardDialog } from "../dialogs/ForwardDialog";
import { Dialog, keepsNativeMenu, Menu, type MenuEntry, useMenu } from "../components/Overlay";
import { ReactionList, ReactionsDialog } from "./Reactions";
import { useLongPress } from "./longPress";
import { type ContextTarget, contextEntries, contextTarget } from "./contextTarget";
import { GifView } from "./GifView";
import { mergeHandlers, SWIPE_REPLY_PX, useMessageGestures } from "./gestures";
import { bytes, clock, dayLabel, fullTime } from "../format";
import { openInApp } from "./inAppLinks";
import { useT } from "../../i18n";
import { LookAvatar, LookName } from "../people/NameStyle";
import { isWebUrl } from "../../protocol/payload";
import { Attachments } from "./Attachments";
import { ChatFileSelection } from "./ChatFileSelection";
import { saveKey } from "../../sync/bulkSave";
import { isEmojiOnly } from "./RichText";
import { MessageBody } from "./MessageBody";
import { SafeLink } from "./SafeLink";
import { AnimojiView } from "./AnimojiView";
import { ManagedPollView } from "./ManagedPollView";
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
import { PostedContent } from "./PostedContent";
import { WebhookAvatar, WebhookName } from "./WebhookSender";
import { useReactionRolesItem } from "../community/reactionRoles/useReactionRolesItem";
import { isInlineImage, saveAttachment } from "../../sync/attachments";
import { attachmentName } from "../../sync/attachmentPolicy";
import { isVoice } from "../../sync/voice";
import type { AttachmentRef } from "../../protocol/payload";
import { Icon } from "../icons/Icon";
export const QUICK_EMOJI = DEFAULT_QUICK_REACTIONS;
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
  replyTo: {
    name: string;
    text: string;
    id: string;
  } | null;
  threadCount: number;
  canPost: boolean;
  /** Reactions and votes; differs from posting in a community's rules channel (API 0.65.0). Defaults to canPost. */
  canReact?: boolean;
  /** Community parity A1: reacting with an emoji not yet on a message (joining one stays open). Defaults to true. */
  newReactions?: boolean;
  /** Community parity A1: pinning and deleting anyone's message (messages.manage). Defaults to canPost for pins only. */
  moderate?: boolean;
  highlighted: boolean;
  onReply: (m: StoredMessage) => void;
  onThread: ((m: StoredMessage) => void) | null;
  onJump: (id: string) => void;
  onReview: () => void;
}
export const MessageItem = memo(function MessageItem(p: MessageItemProps) {
  const engine = useEngine();
  const fileSelection = useContext(ChatFileSelection);
  const [attachmentTarget, setAttachmentTarget] = useState<string | undefined>();
  const trackAttachment = (target: EventTarget | null) => {
    setAttachmentTarget(target instanceof Element ? target.closest<HTMLElement>("[data-attachment-id]")?.dataset.attachmentId : undefined);
  };
  const canReact = p.canReact ?? p.canPost;
  const canAddReaction = canReact && (p.newReactions ?? true);
  const canPin = p.moderate ?? p.canPost;
  const t = useT();
  const { m } = p;
  const [editing, setEditing] = useState(false);
  const editInput = useRef<HTMLTextAreaElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false),
    [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteAttempt = useRef<string | null>(null);
  const [forwarding, setForwarding] = useState(false);
  const [info, setInfo] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [reminding, setReminding] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const reportable = useOrbit((st) => st.server?.features.includes("reports") ?? false);
  // An action on it waits for the server's copy (a snapshot's message, engine.live()): shown after a moment.
  const waiting = useOrbit((st) => st.waiting[m.id] === true);
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
  const { mediaCards, swipeToReply, doubleTapReact, quickReaction, builderMode: builder } = usePrefs();
  const saved = useOrbit((st) => st.nav[PERSONAL]?.saved?.find((x) => x.messageId === m.id));
  const quickEmoji = useOrbit((st) => st.nav[PERSONAL]?.quickReactions ?? DEFAULT_QUICK_REACTIONS);
  const more = useMenu();
  const picker = useMenu();
  // Touch screens have no hover toolbar: a long press opens the menu with quick reactions, reply and the rest.
  const [pressed, setPressed] = useState(false);
  const mine = m.outgoing;
  const mentioned = !mine && (m.mentions.includes(p.myUserId) || m.mentionAll);
  const live = m.kind === "text" && !m.deleted;
  // Community parity C: a webhook's post shows the webhook, and text made from its boxes only where there are none.
  const webhook = m.rich?.webhook ?? null;
  const posted = !!(m.rich?.embeds?.length || m.rich?.buttons?.length || m.rich?.giveaway || m.rich?.botComponents);
  const structured = !!(m.rich?.managedPoll || m.rich?.poll || m.rich?.contact || m.rich?.location || m.rich?.sticker || m.rich?.animoji || m.rich?.customSticker || m.rich?.gif);
  const canEdit = live && mine && p.canPost && m.serverTs !== null && !structured && !posted;
  const editLabel = t("messaging.interface.edit_message_9757ccd");
  const startEdit = () => {
    // Focus during the tap, after the phone menu's focus trap has released the conversation.
    flushSync(() => setEditing(true));
    editInput.current?.focus({ preventScroll: true });
    editInput.current?.scrollIntoView({ block: "nearest" });
  };
  const finishEdit = () => {
    setEditing(false);
    row.current?.focus({ preventScroll: true });
  };
  const shownText = m.rich?.textFromEmbeds ? "" : m.text;
  const reactionRoles = useReactionRolesItem(m, inCommunity, !!more.anchor);
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
          <ShieldAlert size={15} />{" "}
          {m.text === UNSUPPORTED_TEXT ? uiText("errors.unsupportedMessage") : uiText("workspace.interface.this_message_couldn_t_be_verified_or_decrypted_and_was_discarded_7c51036")}
        </span>
      );
    if (m.deleted) return <span className="msg-deleted">{t("msg_deleted")}</span>;
    // A poll, contact, location, sticker or animated emoji is the message itself: no card under it (android MessageBubble).
    const mediaLink = mediaCards && !structured ? findMediaLink(m.text) : null;
    return (
      <>
        {p.replyTo && (
          <button
            className="msg-quote"
            onClick={() => p.onJump(p.replyTo!.id)}
            aria-label={uiText("messaging.interface.reply_to_value0_value1_a83fb3e", { value0: p.replyTo.name, value1: p.replyTo.text })}
          >
            <strong>{p.replyTo.name}</strong>
            <span className="ellipsis">{p.replyTo.text || uiText("messaging.interface.attachment_040d2b3")}</span>
          </button>
        )}
        {m.forwarded && <ForwardedLine origin={m.rich?.origin} />}
        {editing ? (
          <EditBox m={m} input={editInput} onDone={finishEdit} />
        ) : m.rich?.managedPoll ? (
          <div>
            <ManagedPollView m={m} myUserId={p.myUserId} canPost={!!conv?.canPost} />
            {mine && <Status receipts={conv?.type === "DM"} m={m} onRetry={() => void engine.retry(m.id)} onReview={p.onReview} />}
          </div>
        ) : m.rich?.poll ? (
          <div>
            <PollView m={m} myUserId={p.myUserId} canPost={canReact} />
            {mine && <Status receipts={conv?.type === "DM"} m={m} onRetry={() => void engine.retry(m.id)} onReview={p.onReview} />}
          </div>
        ) : m.rich?.gif ? (
          <div>
            <GifView gif={m.rich.gif} />
            {mine && <Status receipts={conv?.type === "DM"} m={m} onRetry={() => void engine.retry(m.id)} onReview={p.onReview} />}
          </div>
        ) : m.rich?.sticker ? (
          <div>
            <StickerView sticker={m.rich.sticker} fallback={m.text} />
            {mine && <Status receipts={conv?.type === "DM"} m={m} onRetry={() => void engine.retry(m.id)} onReview={p.onReview} />}
          </div>
        ) : m.rich?.customSticker ? (
          <div>
            <CustomEmojiImage id={m.rich.customSticker.id} name={m.rich.customSticker.name} sha256={m.rich.customSticker.sha256} sticker />
            {mine && <Status receipts={conv?.type === "DM"} m={m} onRetry={() => void engine.retry(m.id)} onReview={p.onReview} />}
          </div>
        ) : m.rich?.animoji ? (
          <div>
            <AnimojiView emoji={m.rich.animoji} />
            {mine && <Status receipts={conv?.type === "DM"} m={m} onRetry={() => void engine.retry(m.id)} onReview={p.onReview} />}
          </div>
        ) : m.rich?.contact?.userId ? (
          <div>
            <ProfileCardView card={m.rich.contact} />
            {mine && <Status receipts={conv?.type === "DM"} m={m} onRetry={() => void engine.retry(m.id)} onReview={p.onReview} />}
          </div>
        ) : m.rich?.contact ? (
          <span className="msg-call">
            <UserRound size={16} /> {m.rich.contact.name}
            {m.rich.contact.phones.length ? uiText("calls.interface.value0_9402340", { value0: m.rich.contact.phones.join(", ") }) : ""}
          </span>
        ) : m.rich?.location ? (
          <a
            className="msg-call"
            href={`https://www.openstreetmap.org/?mlat=${m.rich.location.lat}&mlon=${m.rich.location.lon}#map=16/${m.rich.location.lat}/${m.rich.location.lon}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Localized k="messaging.interface.open_map_31608b9" slots={[<MapPin size={16} />, m.rich.location.label ?? uiText("messaging.interface.shared_location_32da1fa")]} />
          </a>
        ) : shownText ? (
          <div dir="auto" className={`msg-text${isEmojiOnly(shownText) ? " big-emoji" : ""}`}>
            <MessageBody text={shownText} mentionNames={p.mentionNames} myUsername={p.myUsername} customEmoji={m.rich?.customEmoji} />
            {m.editedAt && (
              <span className="msg-meta">
                <Localized k="messaging.interface.edited_de44feb" />
              </span>
            )}
            {translation && <TranslationView text={translation} onHide={() => setTranslation(null)} />}
            {mine && <Status receipts={conv?.type === "DM"} m={m} onRetry={() => void engine.retry(m.id)} onReview={p.onReview} />}
          </div>
        ) : (
          mine && (
            <div>
              <Status receipts={conv?.type === "DM"} m={m} onRetry={() => void engine.retry(m.id)} onReview={p.onReview} />
            </div>
          )
        )}
        {posted && m.rich && <PostedContent rich={m.rich} orgId={inCommunity} channelId={m.conversationId} messageId={m.id} botId={m.senderUserId} />}
        <Attachments
          message={m}
          refs={m.attachments}
          viewer={{
            sender: p.senderName,
            at: m.sortTs,
            text: m.text,
            quick: quickEmoji,
            reacted: Object.entries(m.reactions)
              .filter(([, who]) => who.includes(p.myUserId))
              .map(([e]) => e),
            onReact: live && canAddReaction ? (e) => void engine.react(m, e) : null,
          }}
        />
        {editing ? null : mediaLink ? (
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
  // What the menu was opened on (a photo, a link, selected text): its own items come first (chat/contextTarget.tsx).
  const [target, setTarget] = useState<ContextTarget | null>(null);
  const attachment = m.attachments.find((r) => r.id === attachmentTarget);
  const menuAttachment = attachment ?? (m.attachments.length === 1 ? m.attachments[0] : undefined);
  const showActions = live && !editing && !fileSelection?.selecting;
  const downloadOriginal = (ref: AttachmentRef) => {
    void saveAttachment(engine, ref).catch((e: unknown) => {
      if (!(e instanceof DOMException && e.name === "AbortError")) engine.notice("error", e instanceof Error ? e.message : uiText("messaging.interface.couldn_t_save_this_file_try_again_d658776"));
    });
  };
  const pressedOn = useRef<EventTarget | null>(null);
  const press = useLongPress(
    (el) => {
      trackAttachment(pressedOn.current);
      setPressed(true);
      setTarget(contextTarget(pressedOn.current));
      more.open(el);
    },
    !editing && !fileSelection?.selecting && m.kind !== "call",
  );
  // Swipe left to reply (touch), double-tap or double-click to react (Settings › Appearance › Gestures).
  const canAct = showActions && p.canPost;
  const reply = () => {
    if (more.anchor) flushSync(() => more.close());
    p.onReply(m);
  };
  const gestures = useMessageGestures(canAct && swipeToReply ? reply : null, showActions && canAddReaction && doubleTapReact ? () => void engine.react(m, quickReaction) : null);
  const quickRow: MenuEntry[] =
    pressed && live && canAddReaction
      ? [
          {
            custom: (
              <div className="menu-quick" role="group" aria-label={t("msg_quick_reactions")}>
                {quickEmoji.map((e) => (
                  <button
                    key={e}
                    className="icon-btn quick-emoji"
                    aria-label={uiText("messaging.interface.react_value0_e09da0a", { value0: e })}
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
        ]
      : [];
  return (
    <div
      ref={row}
      {...mergeHandlers(press, gestures.handlers)}
      onPointerDownCapture={(e) => {
        if (e.currentTarget.contains(e.target as Node)) pressedOn.current = e.target;
      }}
      // A right-click or two-finger click: the message's menu at the pointer (the quick reactions on top, as a long
      // press shows them), with what was clicked first (a photo: open, download, copy; a link; selected text); the Menu
      // key or Shift+F10 opens it from the keyboard. Only the edit box keeps the browser's menu.
      onContextMenu={(e) => {
        if (editing || !e.currentTarget.contains(e.target as Node) || keepsNativeMenu(e.target)) return;
        e.preventDefault();
        if (m.kind === "call") return;
        setPressed(true);
        trackAttachment(e.target);
        setTarget(contextTarget(e.target));
        more.openAt(e.currentTarget, e);
      }}
      onKeyDown={(e) => {
        if (editing || !e.currentTarget.contains(e.target as Node) || !(e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) || keepsNativeMenu(e.target)) return;
        e.preventDefault();
        setPressed(true);
        trackAttachment(e.target);
        setTarget(contextTarget(e.target));
        more.openAt(e.currentTarget, null);
      }}
      style={gestures.offset ? { transform: `translateX(${gestures.offset}px)` } : undefined}
      className={`msg${waiting ? " waiting" : ""}${gestures.offset ? " swiping" : ""}${mine ? " mine" : ""}${p.first ? " first" : ""}${mentioned ? " mentioned" : ""}${p.highlighted ? " highlight" : ""}${more.anchor || picker.anchor ? " menu-open" : ""}${showActions ? " has-actions" : ""}`}
      id={`msg-${m.id}`}
      role="article"
      aria-label={uiText("messaging.interface.value0_value1_c55f6a8", { value0: webhook?.name ?? p.senderName, value1: fullTime(m.sortTs) })}
      tabIndex={-1}
    >
      {gestures.offset < -16 && (
        <span className={`msg-swipe-cue${gestures.offset <= -SWIPE_REPLY_PX ? " armed" : ""}`} aria-hidden="true">
          <Icon name="communication.reply" size={20} />
        </span>
      )}
      <div className="msg-gutter">
        {p.first && webhook ? (
          <WebhookAvatar id={webhook.id} name={webhook.name} avatarRev={webhook.avatarRev} />
        ) : p.first ? (
          <button
            className="msg-avatar-btn"
            onClick={() => openProfile(m.senderUserId, p.senderName)}
            aria-label={uiText("messaging.interface.value0_s_profile_facc1bc", { value0: p.senderName })}
            tabIndex={-1}
          >
            <LookAvatar userId={m.senderUserId} name={p.senderName} colorIndex={p.senderColor} photoRev={p.senderPhotoRev} size={38} />
          </button>
        ) : (
          <time dateTime={new Date(m.sortTs).toISOString()}>{clock(m.sortTs)}</time>
        )}
      </div>
      <div className="msg-main">
        {p.first && (
          <div className="msg-head">
            {webhook ? (
              <WebhookName webhook={webhook} />
            ) : (
              <button className="msg-name" onClick={() => openProfile(m.senderUserId, p.senderName)}>
                <SenderName userId={m.senderUserId} name={p.senderName} toneClass={nameTone(p.senderColor)} />
              </button>
            )}
            <time dateTime={new Date(m.sortTs).toISOString()} title={fullTime(m.sortTs)}>
              {clock(m.sortTs)}
            </time>
            {m.pinned && (
              <span className="tag">
                <Localized k="messaging.interface.pinned_409745c" slots={[<Pin size={11} />]} />
              </span>
            )}
          </div>
        )}
        {body()}
        <ReactionList message={m} myUserId={p.myUserId} canPost={canReact} communityEmoji={communityEmoji} onAdd={canAddReaction ? (anchor) => picker.open(anchor) : undefined} />
        {p.threadCount > 0 && p.onThread && (
          <button className="thread-link" onClick={() => p.onThread?.(m)}>
            <MessagesSquare size={15} /> {countLabel(p.threadCount, "replies")}
          </button>
        )}
      </div>

      {showActions && (
        <div className="msg-actions" role="toolbar" aria-label={t("msg_actions")}>
          {canAddReaction &&
            quickEmoji.slice(0, 3).map((e) => (
              <button key={e} className="icon-btn quick-emoji" onClick={() => void engine.react(m, e)} aria-label={uiText("messaging.interface.react_value0_e09da0a", { value0: e })}>
                {e}
              </button>
            ))}
          {canAddReaction && (
            <button className="icon-btn" onClick={(e) => picker.open(e.currentTarget)} aria-label={t("msg_add_reaction")} title={t("msg_add_reaction")} aria-haspopup="menu">
              <SmilePlus size={TOOL_ICON} />
            </button>
          )}
          {p.canPost && (
            <button className="icon-btn" onClick={reply} aria-label={t("msg_reply")} title={t("msg_reply")}>
              <MessageSquareReply size={TOOL_ICON} />
            </button>
          )}
          {p.onThread && !m.threadRootId && (
            <button className="icon-btn" onClick={() => p.onThread?.(m)} aria-label={t("msg_reply_thread")} title={t("msg_reply_thread")}>
              <MessagesSquare size={TOOL_ICON} />
            </button>
          )}
          {canEdit && (
            <button className="icon-btn" onClick={startEdit} aria-label={editLabel} title={editLabel}>
              <Pencil size={TOOL_ICON} />
            </button>
          )}
          <button className="icon-btn" onClick={() => setForwarding(true)} aria-label={t("msg_forward")} title={t("msg_forward")}>
            <Forward size={TOOL_ICON} />
          </button>
          <button
            className="icon-btn msg-more"
            onClick={(e) => {
              setPressed(true);
              setTarget(null);
              setAttachmentTarget(undefined);
              more.open(e.currentTarget);
            }}
            aria-label={t("msg_more")}
            title={t("msg_more")}
            aria-haspopup="menu"
            aria-expanded={!!more.anchor}
          >
            <MoreHorizontal size={TOOL_ICON} />
          </button>
        </div>
      )}
      {picker.anchor && (
        <Menu
          anchor={picker.anchor}
          align="end"
          label={t("messaging.reactions")}
          onClose={picker.close}
          entries={[
            {
              custom: (
                <EmojiPicker
                  community={communityEmoji ? { list: communityEmoji, reactions: true } : undefined}
                  onPick={(e) => {
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
          point={more.point}
          align="end"
          label={t("messaging.message")}
          onClose={() => {
            more.close();
            setPressed(false);
            setTarget(null);
            setAttachmentTarget(undefined);
          }}
          entries={[
            ...quickRow,
            ...(canEdit ? [{ label: editLabel, icon: <Pencil size={16} />, onSelect: startEdit }] : []),
            ...(live && p.canPost && !fileSelection?.selecting ? [{ label: t("msg_reply"), icon: <MessageSquareReply size={16} />, onSelect: reply }] : []),
            ...(live && p.onThread && !m.threadRootId ? [{ label: t("msg_reply_thread"), icon: <MessagesSquare size={16} />, onSelect: () => p.onThread?.(m) }] : []),
            ...contextEntries(target?.kind === "media" && attachment && !isInlineImage(attachment) ? null : target, (text) => engine.notice("info", text)),
            ...(live && menuAttachment && !isInlineImage(menuAttachment)
              ? [
                  {
                    label: isVoice(menuAttachment)
                      ? uiText("messaging.download_voice_message")
                      : uiText("messaging.interface.download_value0_value1_68feb19", { value0: attachmentName(menuAttachment.name), value1: bytes(menuAttachment.size) }),
                    icon: <Icon name="files.download" size={16} />,
                    onSelect: () => downloadOriginal(menuAttachment),
                  },
                ]
              : []),
            ...(reactions.length > 0 ? [{ label: t("react_dialog_title"), icon: <SmilePlus size={16} />, onSelect: () => setShowReactions(true) }] : []),
            ...reactionRoles.entries,
            ...(canPin
              ? [
                  {
                    label: m.pinned ? t("msg_unpin") : t("msg_pin"),
                    icon: m.pinned ? <PinOff size={16} /> : <Pin size={16} />,
                    onSelect: () => void engine.setPinned(m, !m.pinned, p.moderate === true),
                  },
                ]
              : []),
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
                      const copy = () =>
                        void navigator.clipboard?.writeText(messageLink(m.conversationId, m.id)).then(
                          () => engine.notice("info", t("msg_link_copied")),
                          () => engine.notice("error", uiText("messaging.interface.couldn_t_copy_the_link_c4fe74d")),
                        );
                      // A message drawn from the snapshot: copied once the server's page shows it's still there.
                      if (!engine.waitsForServer(m)) copy();
                      else void engine.whenLive(m).then((x) => x && copy());
                    },
                  },
                ]
              : []),
            ...(mine ? [{ label: t("msg_info"), icon: <Info size={16} />, onSelect: () => setInfo(true) }] : []),
            ...(builder
              ? [
                  {
                    get label() {
                      return uiText("messaging.interface.copy_message_id_39aa2ab");
                    },
                    icon: <IdCard size={16} />,
                    onSelect: () => {
                      void navigator.clipboard?.writeText(m.id).catch(() => undefined);
                      engine.notice("info", uiText("messaging.interface.message_id_copied_cb652b0"));
                    },
                  },
                ]
              : []),
            ...(!mine && live && reportable && conv ? ["separator" as const, { label: t("msg_report"), icon: <Flag size={16} />, danger: true, onSelect: () => setReporting(true) }] : []),
            ...((mine && p.canPost) || (!mine && live && p.moderate === true && !!inCommunity)
              ? ["separator" as const, { label: t("msg_delete_all"), icon: <Trash2 size={16} />, danger: true, onSelect: () => setConfirmDelete(true) }]
              : []),
            ...(live && m.attachments.length && fileSelection
              ? [
                  "separator" as const,
                  ...(attachment
                    ? [
                        {
                          label: uiText("messaging.interface.select_value0_b4b262a", { value0: attachment.name }),
                          onSelect: () => fileSelection.include([saveKey(m.id, attachment.id)]),
                        },
                      ]
                    : []),
                  ...(!attachment || m.attachments.length > 1
                    ? [
                        {
                          label:
                            m.attachments.length === 1
                              ? uiText("messaging.interface.select_files_to_save_eb50da0")
                              : uiText("messaging.interface.select_all_1fc9a38") + " · " + formatUiNumber(m.attachments.length),
                          onSelect: () => fileSelection.include(m.attachments.map((r) => saveKey(m.id, r.id))),
                        },
                      ]
                    : []),
                ]
              : []),
          ]}
        />
      )}
      {reactionRoles.dialog}
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
          title={uiText("messaging.interface.remind_me_about_this_message_e8c7aaa")}
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
          title={uiText("messaging.interface.delete_this_message_for_everyone_fc9f597")}
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>
                {t("common.actions.cancel")}
              </button>
              <button
                className="btn btn-danger"
                data-autofocus
                disabled={deleteBusy}
                onClick={async () => {
                  if (deleteBusy) return;
                  deleteAttempt.current ??= crypto.randomUUID();
                  setDeleteBusy(true);
                  setDeleteError(null);
                  try {
                    await engine.deleteForEveryone(m, !mine, deleteAttempt.current);
                    setConfirmDelete(false);
                  } catch (e) {
                    setDeleteError(e instanceof Error ? e.message : String(e));
                  } finally {
                    setDeleteBusy(false);
                  }
                }}
              >
                {t("common.actions.delete")}
              </button>
            </>
          }
        >
          <div className="dialog-body">
            {deleteError && <p role="alert">{deleteError}</p>}
            <p className="muted" style={{ margin: 0 }}>
              <Localized k="messaging.interface.it_s_removed_for_everyone_in_the_conversation_on_every_device_ff48f7f" />
            </p>
          </div>
        </Dialog>
      )}
    </div>
  );
});
function Status({ m, onRetry, onReview, receipts }: { m: StoredMessage; onRetry: () => void; onReview: () => void; receipts: boolean }) {
  const l10n = useLocalization();

  if (!receipts && ["SENT", "DELIVERED", "READ"].includes(m.status)) return null;
  switch (m.status) {
    case "SENDING":
      return (
        <span className="msg-meta" title={uiText("messaging.interface.sending_e595f17")}>
          <Clock size={12} aria-label={uiText("messaging.interface.sending_e595f17")} />
        </span>
      );
    case "SENT":
      return (
        <span className="msg-meta" title={uiText("messaging.interface.sent_c16bc82")}>
          <Check size={13} aria-label={uiText("messaging.interface.sent_c16bc82")} />
        </span>
      );
    case "DELIVERED":
      return (
        <span className="msg-meta" title={uiText("messaging.interface.delivered_9061156")}>
          <CheckCheck size={13} aria-label={uiText("messaging.interface.delivered_9061156")} />
        </span>
      );
    case "READ":
      return (
        <span
          className="msg-meta read"
          title={uiText("messaging.interface.read_value0_be73150", { value0: m.readBy.length ? uiText("workspace.interface.by_value0_943cd46", { value0: m.readBy.length }) : "" })}
        >
          <CheckCheck size={13} aria-label={uiText("messaging.interface.read_9b9a8d0")} />
        </span>
      );
    case "FAILED":
      return (
        <span className="msg-meta failed">
          <CircleAlert size={13} /> {m.errorText ?? uiText("messaging.interface.not_sent_cd5f943")} ·{" "}
          <button className="msg-retry" onClick={onRetry}>
            <Localized k="messaging.interface.retry_942087c" />
          </button>
        </span>
      );
    case "HELD":
      return (
        <span className="msg-meta failed">
          <Localized k="messaging.interface.paused_a_security_key_changed_d2187cb" slots={[<ShieldAlert size={13} />]} />
          <button className="msg-retry" onClick={onReview}>
            {l10n("messaging.conv_review")}
          </button>
        </span>
      );
    default:
      return null;
  }
}
function EditBox({ m, input, onDone }: { m: StoredMessage; input: RefObject<HTMLTextAreaElement | null>; onDone: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [text, setText] = useState(m.text);
  // Edits get the same room as new messages (server docs/MOJO.md).
  const limit = useMojoLimits()?.messageChars ?? null;
  const tooLong = overCharLimit(text, limit);
  const allowEmpty = m.attachments.length > 0;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const attempt = useRef<{ body: string; id: string } | null>(null);
  const save = async () => {
    if (tooLong || busy) return;
    const body = text.trim();
    if (!body && !allowEmpty) return;
    if (body === m.text) {
      onDone();
      return;
    }
    if (attempt.current?.body !== body) attempt.current = { body, id: crypto.randomUUID() };
    setBusy(true);
    setError(null);
    try {
      await engine.edit(m, body, attempt.current.id);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="msg-edit"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {error && <p role="alert">{error}</p>}
      <textarea
        ref={input}
        disabled={busy}
        className="textarea"
        value={text}
        rows={Math.min(8, text.split("\n").length + 1)}
        aria-label={uiText("messaging.interface.edit_message_9757ccd")}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void save();
          } else if (e.key === "Escape" && !busy) {
            e.preventDefault();
            onDone();
          }
        }}
      />
      <CharLimitNote text={text} limit={limit} />
      <div className="msg-edit-actions">
        <span className="msg-edit-hint faint">
          <Localized k="messaging.interface.enter_to_save_esc_to_cancel_f9ddecc" />
        </span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onDone} disabled={busy}>
          {l10n("common.actions.cancel")}
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={(!text.trim() && !allowEmpty) || tooLong || busy}>
          {l10n("common.actions.save")}
        </button>
      </div>
    </form>
  );
}
/**
 * "Forwarded", and for a message forwarded out of a community channel where it came from (android, 2026-10-23):
 * "Forwarded · Community • time ›", which opens the original for people in that channel.
 */
function ForwardedLine({ origin }: { origin: RichContent["origin"] }) {
  useLocaleRender();
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
        <button className="msg-forwarded-origin" onClick={() => openInApp(engine, link)} aria-label={uiText("messaging.interface.open_the_original_in_value0_9d0c43f", { value0: origin.place })}>
          {where} ›
        </button>
      ) : (
        <span>{where}</span>
      )}
    </div>
  );
}
/** The author's name with their name style and tag (API 0.46.0), as this browser knows them. */
function SenderName({ userId, name, toneClass }: { userId: string; name: string; toneClass: string }) {
  useLocaleRender();
  return <LookName userId={userId} name={name} withMarks toneClass={toneClass} />;
}
