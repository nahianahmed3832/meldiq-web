import { z } from "zod";
import type { MessageStatus, RichContent, StoredMessage } from "../model/types";
import { isWebUrl, safeFileName, zAttachmentRef } from "./payload";

/**
 * One item of the account's encrypted history: a phone's own Room row for a message or a chat (android data/repo/
 * HistorySync.kt `HistoryRecord`, data/db/Entities.kt). kotlinx.serialization writes defaults and omits nulls, and keeps
 * lists and maps as JSON strings inside the row. Decoded tolerantly: a field this client doesn't know is dropped, and a
 * malformed inner string becomes its empty value rather than losing the message.
 */

const str = z
  .string()
  .nullish()
  .transform((v) => v ?? null);
const zMessageEntity = z.object({
  id: z.string().min(1).max(128),
  conversationId: z.string().min(1).max(128),
  senderUserId: z.string().max(128),
  senderDeviceId: z.string().max(128).default(""),
  outgoing: z.boolean(),
  kind: z.string(),
  text: z.string().max(100_000).default(""),
  replyToId: str,
  threadRootId: str,
  mentionsJson: z.string().default("[]"),
  attachmentsJson: z.string().default("[]"),
  sentAt: z.number(),
  serverTs: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  sortTs: z.number(),
  status: z.string().default("RECEIVED"),
  editedAt: z
    .number()
    .nullish()
    .transform((v) => v ?? null),
  deleted: z.boolean().default(false),
  pinned: z.boolean().default(false),
  reactionsJson: z.string().default("{}"),
  readByJson: z.string().default("[]"),
  deliveredToJson: z.string().default("[]"),
  callJson: str,
  richJson: str,
  forwarded: z.boolean().default(false),
});

const zConversationEntity = z.object({ id: z.string().min(1).max(128), muted: z.boolean().default(false) });

export const zHistoryRecord = z.object({
  v: z.number().default(1),
  message: zMessageEntity.nullish(),
  conversation: zConversationEntity.nullish(),
});

const STATUSES: readonly MessageStatus[] = ["SENDING", "SENT", "DELIVERED", "READ", "FAILED", "RECEIVED", "HELD"];
const EVERYONE_MARK = "@everyone";

function inner<S extends z.ZodTypeAny>(json: string, schema: S, fallback: z.infer<S>): z.infer<S> {
  try {
    const r = schema.safeParse(JSON.parse(json));
    return r.success ? r.data : fallback;
  } catch {
    return fallback;
  }
}

const zStrings = z.array(z.string().max(128)).max(1000);
const zReactions = z.record(z.string().max(64), zStrings);
const zCall = z.object({ callId: z.string(), video: z.boolean() });
const zRich = z.object({
  contact: z.object({ name: z.string(), phones: z.array(z.string()).default([]), emails: z.array(z.string()).default([]) }).optional(),
  location: z.object({ lat: z.number(), lon: z.number(), accuracyM: z.number().optional(), label: z.string().optional() }).optional(),
  animoji: z.string().optional(),
  link: z.object({ url: z.string().max(2048).refine(isWebUrl), title: z.string().optional(), description: z.string().optional(), siteName: z.string().optional() }).optional(),
});

export interface DecodedRecord {
  message: StoredMessage | null;
  conversationId: string | null;
}

/** Decodes a decrypted history item. Null when it isn't a record at all. */
export function decodeHistoryRecord(json: string): DecodedRecord | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const r = zHistoryRecord.safeParse(raw);
  if (!r.success) return null;
  const m = r.data.message;
  return { message: m ? toStored(m) : null, conversationId: r.data.conversation?.id ?? null };
}

function toStored(m: z.infer<typeof zMessageEntity>): StoredMessage | null {
  // Only messages and calls are shown; local placeholders ("undecryptable", "system") stay on the phone that made them.
  if (m.kind !== "text" && m.kind !== "call") return null;
  const mentions = inner(m.mentionsJson, zStrings, []);
  const rich: RichContent | null = m.richJson ? inner(m.richJson, zRich.nullable(), null) : null;
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderUserId: m.senderUserId,
    senderDeviceId: m.senderDeviceId,
    outgoing: m.outgoing,
    kind: m.kind,
    text: m.text,
    replyToId: m.replyToId,
    threadRootId: m.threadRootId,
    mentions: mentions.filter((x) => x !== EVERYONE_MARK),
    mentionAll: mentions.includes(EVERYONE_MARK),
    attachments: inner(m.attachmentsJson, z.array(zAttachmentRef).max(100), []).map((a) => ({ ...a, name: safeFileName(a.name) })),
    sentAt: m.sentAt,
    serverTs: m.serverTs,
    sortTs: m.sortTs,
    status: (STATUSES as readonly string[]).includes(m.status) ? (m.status as MessageStatus) : "RECEIVED",
    errorText: null,
    editedAt: m.editedAt,
    deleted: m.deleted,
    pinned: m.pinned,
    reactions: inner(m.reactionsJson, zReactions, {}),
    readBy: inner(m.readByJson, zStrings, []),
    deliveredTo: inner(m.deliveredToJson, zStrings, []),
    call: m.callJson ? inner(m.callJson, zCall.nullable(), null) : null,
    rich,
    forwarded: m.forwarded,
  };
}

/** How a downloaded message meets this browser's copy (android HistoryCodec.merge): only later edits and deletions change it. */
export function mergeHistory(local: StoredMessage | null, remote: StoredMessage): StoredMessage | null {
  if (!local) return remote;
  if (remote.deleted && !local.deleted) return { ...local, deleted: true, text: "", attachments: [], rich: null };
  if ((remote.editedAt ?? 0) > (local.editedAt ?? 0) && !local.deleted) return { ...local, text: remote.text, editedAt: remote.editedAt, rich: remote.rich };
  return null;
}
