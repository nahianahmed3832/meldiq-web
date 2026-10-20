import { callLine } from "./callHistory";
import type { ConversationType, QueueItem } from "../api/schemas";
import type { RichContent, StoredMessage } from "../model/types";
import { type AttachmentRef, MAX_RECEIVED_ATTACHMENTS, type Payload, safeFileName } from "../protocol/payload";
import { cleanPoll } from "./polls";
import { cleanSticker } from "./stickers";
import { cleanContact } from "./rich";

/**
 * What a received payload does to this device's copy of a conversation. Pure functions, so they're unit-tested on their own;
 * each mirrors android data/repo/MessageRepository.kt `apply` so the browser and the phone end in the same state.
 */

export interface MentionSet {
  ids: string[];
  /** @everyone, counted only with the server's mark on this copy, in a group or channel (docs/MENTIONS.md). */
  all: boolean;
}

export function receivedMentions(p: Payload, attested: boolean, type: ConversationType | null): MentionSet {
  const ids = [...new Set((p.mentions ?? []).filter((x) => x.trim() !== "" && x.length <= 64))];
  return { ids, all: p.mentionAll === true && attested && type !== null && type !== "DM" };
}

function richOf(p: Payload): RichContent | null {
  const r: RichContent = {};
  const contact = p.contact ? cleanContact(p.contact) : null;
  if (contact) r.contact = contact;
  if (p.location) r.location = p.location;
  if (p.animoji) r.animoji = p.animoji;
  if (p.link) r.link = p.link;
  const poll = cleanPoll(p.poll);
  if (poll) r.poll = poll;
  const sticker = cleanSticker(p.sticker);
  if (sticker) r.sticker = sticker;
  return Object.keys(r).length ? r : null;
}

export function attachmentsOf(p: Payload): AttachmentRef[] {
  return (p.attachments ?? []).slice(0, MAX_RECEIVED_ATTACHMENTS).map((a) => ({ ...a, name: safeFileName(a.name) }));
}

/** A received (or own other device's) text message. Server time orders it. */
export function textMessage(p: Payload, item: QueueItem, mine: boolean, serverTs: number, mentions: MentionSet): StoredMessage {
  return {
    id: item.messageId,
    conversationId: item.conversationId,
    senderUserId: item.senderUserId,
    senderDeviceId: item.senderDeviceId,
    outgoing: mine,
    kind: "text",
    text: p.text ?? "",
    replyToId: p.replyTo ?? null,
    threadRootId: p.threadRoot ?? null,
    mentions: mentions.ids,
    mentionAll: mentions.all,
    attachments: attachmentsOf(p),
    sentAt: item.payload.sentAt ?? serverTs,
    serverTs,
    sortTs: serverTs,
    status: mine ? "SENT" : "RECEIVED",
    errorText: null,
    editedAt: null,
    deleted: false,
    pinned: false,
    reactions: {},
    readBy: [],
    deliveredTo: [],
    call: null,
    rich: richOf(p),
    forwarded: p.forwarded === true,
  };
}

/** Only the author can edit, and not after deleting. Mentions follow the new text; @everyone stays as sent. */
export function applyEdit(t: StoredMessage, senderUserId: string, p: Payload, serverTs: number): StoredMessage | null {
  if (t.senderUserId !== senderUserId || t.deleted) return null;
  const ids = p.mentions ? [...new Set(p.mentions)] : t.mentions;
  return { ...t, text: p.text ?? "", editedAt: serverTs, mentions: ids };
}

/** Deletion for everyone: only the author's. */
export function applyDelete(t: StoredMessage, senderUserId: string): StoredMessage | null {
  if (t.senderUserId !== senderUserId) return null;
  return { ...t, deleted: true, text: "", attachments: [], rich: null };
}

export function applyReaction(t: StoredMessage, userId: string, emoji: string, add: boolean): StoredMessage {
  const current = t.reactions[emoji] ?? [];
  const next = add ? (current.includes(userId) ? current : [...current, userId]) : current.filter((u) => u !== userId);
  const reactions = { ...t.reactions };
  if (next.length) reactions[emoji] = next;
  else delete reactions[emoji];
  return { ...t, reactions };
}

export function applyPin(t: StoredMessage, pinned: boolean): StoredMessage {
  return { ...t, pinned };
}

/** Someone read up to [upTo]: their user id joins each of this account's earlier messages' readers. */
export function applyRead(m: StoredMessage, readerId: string): StoredMessage {
  return { ...m, readBy: m.readBy.includes(readerId) ? m.readBy : [...m.readBy, readerId], status: "READ" };
}

export function applyDelivered(m: StoredMessage, toUserId: string): StoredMessage {
  return {
    ...m,
    deliveredTo: m.deliveredTo.includes(toUserId) ? m.deliveredTo : [...m.deliveredTo, toUserId],
    status: m.status === "SENT" || m.status === "SENDING" ? "DELIVERED" : m.status,
  };
}

export function callEntry(item: QueueItem, mine: boolean, callId: string, video: boolean, serverTs: number): StoredMessage {
  return {
    ...textMessage({ type: "text" }, item, mine, serverTs, { ids: [], all: false }),
    id: `call-${callId}`,
    kind: "call",
    text: video ? "Video call" : "Voice call",
    call: { callId, video },
  };
}

export function undecryptable(item: QueueItem, reason: string): StoredMessage {
  return {
    ...textMessage({ type: "text" }, item, false, item.createdAt, { ids: [], all: false }),
    kind: "undecryptable",
    text: "This message couldn't be verified or decrypted and was discarded.",
    errorText: reason,
  };
}

type FileKind = "photo" | "video" | "file";
const kindOf = (mime: string): FileKind => (mime.toLowerCase().startsWith("image/") ? "photo" : mime.toLowerCase().startsWith("video/") ? "video" : "file");

/** The sidebar line for a message (android MessageRepository.preview and AttachmentPolicy.preview). */
export function preview(m: Pick<StoredMessage, "deleted" | "kind" | "text" | "attachments" | "rich" | "call" | "outgoing">): string {
  if (m.deleted) return "Message deleted";
  if (m.kind === "call") return `📞 ${m.call?.info ? callLine(m.call.info, m.call.video, m.outgoing, null).title : m.call?.video ? "Video call" : "Voice call"}`;
  if (m.kind === "undecryptable") return "Couldn't be decrypted";
  if (m.rich?.contact) return `👤 ${m.rich.contact.name}`;
  if (m.rich?.location) return `📍 ${m.rich.location.label ?? "Location"}`;
  const a = m.attachments;
  if (a.length && m.text.trim() === "") {
    if (a[0].voice) return "🎤 Voice message";
    if (a.length === 1) return kindOf(a[0].mime) === "photo" ? "📷 Photo" : kindOf(a[0].mime) === "video" ? "🎬 Video" : `📎 ${a[0].name}`;
    const photos = a.filter((x) => kindOf(x.mime) === "photo").length;
    const videos = a.filter((x) => kindOf(x.mime) === "video").length;
    if (photos === a.length) return `📷 ${photos} photos`;
    if (videos === a.length) return `🎬 ${videos} videos`;
    return `📎 ${a.length} attachments`;
  }
  if (a.length) return `📎 ${m.text}`;
  return m.text;
}

/** Read receipts go only to DMs and groups of up to 20 people where this account can post (android markConversationRead). */
export function sendsReadReceipts(type: ConversationType, memberCount: number, canPost: boolean): boolean {
  return type !== "CHANNEL" && memberCount <= 20 && canPost;
}
