import { z } from "zod";
import type { Payload } from "../protocol/payload";
import type { StoredMessage } from "../model/types";
import type { EngineContext } from "./context";
import { restoreHistory } from "./historySync";
import { forgetAllMedia } from "../store/mediaCache";

/**
 * The one-time move of this browser's history to the server (API 0.57.0, server docs/SERVER_MESSAGES.md). Earlier
 * versions kept every message in this browser (IndexedDB), end-to-end encrypted on the way; since the owner's decision
 * of 2026-10-28 the server stores messages. On the first start after updating, this browser uploads what it holds:
 * the messages in its old database, and what it can read of the account's encrypted history on the server. The server
 * keeps the first copy of each message and skips the rest, so several devices uploading the same chat is harmless.
 * The old database is emptied only after every batch was accepted; a failure leaves it for the next start.
 */

/** Recorded on disk (db.ts ON_DISK) once the upload finished, so it runs once per browser. */
export const IMPORTED_KEY = "legacy.imported";
const BATCH = 150;
const zImportRes = z.object({ added: z.number(), skipped: z.number() });

export interface ImportItem {
  id: string;
  conversationId: string;
  senderUserId: string;
  cls: "message" | "control";
  sentAt: number;
  serverTs: number;
  payload: Payload;
}

/** A kept message as the payload it was sent as (the inverse of rules.ts textMessage), with its visible state. */
export function payloadOfStored(m: StoredMessage): Payload {
  const r = m.rich ?? {};
  const p: Payload = { type: "text", text: m.text };
  if (m.replyToId) p.replyTo = m.replyToId;
  if (m.threadRootId) p.threadRoot = m.threadRootId;
  if (m.mentions.length) p.mentions = m.mentions;
  if (m.mentionAll) p.mentionAll = true;
  if (m.attachments.length) p.attachments = m.attachments;
  if (m.forwarded) p.forwarded = true;
  if (r.contact) p.contact = r.contact;
  if (r.location) p.location = r.location;
  if (r.animoji) p.animoji = r.animoji;
  if (r.link) p.link = r.link;
  if (r.poll) p.poll = r.poll;
  if (r.sticker) p.sticker = r.sticker;
  if (r.gif) p.gif = r.gif;
  if (r.title) p.title = r.title;
  if (r.tags?.length) p.tags = r.tags;
  if (r.customEmoji?.length) p.customEmoji = r.customEmoji;
  if (r.customSticker) p.customSticker = r.customSticker;
  if (r.origin) p.origin = { place: r.origin.place, at: r.origin.at ?? undefined, conversationId: r.origin.conversationId ?? undefined, messageId: r.origin.messageId ?? undefined };
  return p;
}

/**
 * What one kept message uploads as: the message, then its reactions, poll votes, closing and pin as the changes that
 * made them. Deleted messages and call lines (the server keeps calls itself) upload nothing.
 */
export function importItemsOf(m: StoredMessage): ImportItem[] {
  if (m.deleted || m.kind !== "text") return [];
  const at = m.serverTs ?? m.sortTs;
  const base = { conversationId: m.conversationId, sentAt: m.sentAt || at, serverTs: at };
  const items: ImportItem[] = [{ ...base, id: m.id, senderUserId: m.senderUserId, cls: "message", payload: payloadOfStored(m) }];
  const change = (suffix: string, senderUserId: string, payload: Payload) =>
    items.push({ ...base, id: `${m.id.slice(0, 40)}-${suffix}`.slice(0, 64), senderUserId, cls: "control", payload: { ...payload, target: m.id } });
  let n = 0;
  for (const [emoji, users] of Object.entries(m.reactions)) for (const u of users) change(`r${n++}`, u, { type: "reaction", emoji, add: true });
  for (const [voter, choices] of Object.entries(m.rich?.votes ?? {})) change(`v${n++}`, voter, { type: "vote", choices });
  if (m.rich?.pollClosed) change("c", m.senderUserId, { type: "poll_close" });
  if (m.pinned) change("p", m.senderUserId, { type: "pin", pinned: true });
  return items.filter((i) => /^[A-Za-z0-9_-]{8,64}$/.test(i.id));
}

/** Uploads this browser's earlier history once (see above). Returns how many messages the server didn't have yet. */
export async function importLegacyHistory(ctx: EngineContext): Promise<number> {
  const { store, api } = ctx;
  if (await store.getValue<boolean>(IMPORTED_KEY)) return 0;
  const legacy = store.legacy;
  const kept = await legacy.getAll("messages");
  // What this account's encrypted history on the server holds and this browser can read (its own keys).
  if (ctx.device.history) await restoreHistory(ctx, () => undefined, true).catch(() => undefined);
  const restored = await store.findMessages(() => true, Number.MAX_SAFE_INTEGER);
  const byId = new Map<string, StoredMessage>();
  for (const m of [...kept, ...restored]) byId.set(m.id, m);
  const items = [...byId.values()].sort((a, b) => a.sortTs - b.sortTs).flatMap(importItemsOf);
  let added = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const r = await api.json("POST", "/v2/messages/import", zImportRes, { body: { items: items.slice(i, i + BATCH) } });
    added += r.added;
  }
  // Everything was accepted: the old copies on this computer go, the sign-in stays.
  const tx = legacy.transaction(["messages", "conversations", "outbox", "pins", "held", "pendingControls"], "readwrite");
  await Promise.all([...(["messages", "conversations", "outbox", "pins", "held", "pendingControls"] as const).map((s) => tx.objectStore(s).clear()), tx.done]);
  const keys = (await legacy.getAllKeys("kv")).map(String).filter((k) => !["device", "accountTokenKey", "accountTokens"].includes(k));
  for (const k of keys) await legacy.delete("kv", k);
  // Files earlier versions kept between visits.
  await forgetAllMedia();
  await store.setValue(IMPORTED_KEY, true);
  return added;
}
