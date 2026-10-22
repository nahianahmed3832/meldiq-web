import type { DeviceKeys } from "../crypto/identity";
import type { HistoryKeys } from "../crypto/history";
import type { ReminderKey } from "../crypto/reminderKeys";
import type { AttachmentRef, ContactCard, CustomEmojiRef, LinkPreview, Poll, SharedLocation, StickerRef } from "../protocol/payload";

/** Delivery state of a message, as the phone shows it (android data/model/Models.kt `MessageStatus`). */
export type MessageStatus = "SENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "RECEIVED" | "HELD";

export interface RichContent {
  contact?: ContactCard;
  location?: SharedLocation;
  animoji?: string;
  link?: LinkPreview;
  poll?: Poll;
  /** voter user id → their chosen option ids (polls; android RichContent.votes). */
  votes?: Record<string, string[]>;
  pollClosed?: boolean;
  sticker?: StickerRef;
  /** A forum post's title; its text still starts with it (sync/forumRules.ts body() strips it for display). */
  title?: string;
  /** A forum post's tag ids (the forum's tags name them). */
  tags?: string[];
  /** Batch B9: community emoji shown inside the text, and a community sticker. */
  customEmoji?: CustomEmojiRef[];
  customSticker?: CustomEmojiRef;
}

export interface CallEntry {
  callId: string;
  video: boolean;
  /** What happened, from the server's record of the call (sync/callHistory.ts); absent until known. */
  info?: CallInfo;
}

/** One recent call, for Activity › Missed calls. */
export interface CallLogItem {
  callId: string;
  conversationId: string;
  video: boolean;
  at: number;
  outcome: CallOutcome;
  startedBy: string;
  group: boolean;
}

export type CallOutcome = "completed" | "missed" | "declined" | "busy" | "no_answer" | "cancelled" | "failed" | "ongoing" | "ended";

export interface CallInfo {
  outcome: CallOutcome;
  startedBy: string;
  group: boolean;
  durationSec?: number;
  /** Group calls: how many people connected. */
  joined?: number;
}

/**
 * A message as this browser keeps it. Ids are the sender's message ids (the protocol's own, idempotent on the server);
 * [serverTs] is the server's acceptance time and orders the conversation once known.
 */
export interface StoredMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderDeviceId: string;
  /** Sent by this account (from this browser or another of its devices). */
  outgoing: boolean;
  kind: "text" | "call" | "undecryptable";
  text: string;
  replyToId: string | null;
  threadRootId: string | null;
  mentions: string[];
  mentionAll: boolean;
  attachments: AttachmentRef[];
  sentAt: number;
  serverTs: number | null;
  sortTs: number;
  status: MessageStatus;
  errorText: string | null;
  editedAt: number | null;
  deleted: boolean;
  pinned: boolean;
  /** emoji → user ids */
  reactions: Record<string, string[]>;
  readBy: string[];
  deliveredTo: string[];
  call: CallEntry | null;
  rich: RichContent | null;
  forwarded: boolean;
}

/** Per-conversation state that exists only on this device (unread counts, like the phone's). */
export interface ConversationLocal {
  id: string;
  unread: number;
  mentions: number;
  lastMessageId: string | null;
  lastPreview: string | null;
  lastSenderName: string | null;
  lastActivityAt: number;
  /** Newest server time this device has read up to. */
  readUpTo: number;
  draft: string;
  /**
   * Archived on this browser (android CHAT_LIST_ACTIONS.md): out of the lists and badges, still a member, still notified
   * unless muted. Local only, like the phone's. Absent on records from before.
   */
  archivedAt?: number | null;
}

export interface OutboxItem {
  messageId: string;
  conversationId: string;
  cls: "message" | "control";
  payloadJson: string;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  /** False for controls (reactions, receipts…): nothing is shown for them. */
  visible: boolean;
  /** Paused because a member's identity key changed (T1.2). */
  held: boolean;
}

/** Identity key pinned on first contact (trust on first use, docs/SECURITY.md §3). */
export interface PinnedIdentity {
  userId: string;
  identityKey: string;
  /** The server now presents this different key: messaging with this person is paused until it's accepted. */
  changedTo: string | null;
  verified: boolean;
}

/** This browser's device record. The session token is deliberately not here: it lives in memory only. */
export interface DeviceRecord {
  userId: string;
  deviceId: string;
  username: string;
  identityKey: string;
  keys: DeviceKeys;
  history: HistoryKeys | null;
  /**
   * Seals reminders kept on the server (crypto/reminderKeys.ts). Derived when this browser was set up with the identity
   * seed; absent on browsers set up before reminders (they unlock it once with the recovery key).
   */
  reminders?: ReminderKey | null;
  linkedAt: number;
  deviceName: string;
  /**
   * The Orbit 2.0 account this browser signed in to (email and password). Absent for a browser linked before Orbit 2.0,
   * which signs in with its device key alone (v1, while the server still allows it).
   */
  account?: { id: string; email: string };
}
