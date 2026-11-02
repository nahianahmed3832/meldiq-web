import { z } from "zod";
import { withinJsonBudget } from "../api/jsonBudget";

/**
 * Message payload shared by server-stored v2 messages and legacy griip-envelope-v1 (Android Models.kt `Payload`).
 * It comes from other people's devices, so
 * it is validated like any untrusted input. Unknown fields are dropped and unknown types ignored, so newer apps' messages
 * never break this one (android/app/src/test/resources/griip-payload-v1-vectors.json › forwardCompatible).
 */

const id = z.string().min(1).max(128);
const opt = <T extends z.ZodTypeAny>(t: T) =>
  t
    .nullish()
    .transform((v) => v ?? undefined)
    .optional();

/** Bounded, non-recursive preview descriptor. Its key travels with the original under the conversation's message security. */
const zAttachmentThumbnail = z.object({
  id,
  name: z.string().max(512),
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z
    .number()
    .int()
    .positive()
    .max(128 * 1024),
  key: z.string().max(64),
  nonce: z.string().max(32),
  sha256: z.string().max(64),
});

export const zAttachmentRef = z.object({
  id,
  name: z.string().max(512),
  mime: z.string().max(255),
  size: z.number().int().nonnegative(),
  key: z.string().max(64),
  nonce: z.string().max(32),
  sha256: z.string().max(64),
  voice: opt(z.boolean()),
  durationMs: opt(z.number().int().nonnegative()),
  chunk: opt(
    z
      .number()
      .int()
      .min(1024)
      .max(16 * 1024 * 1024),
  ),
  w: opt(z.number().int().positive().max(32768)),
  h: opt(z.number().int().positive().max(32768)),
  thumbnail: opt(zAttachmentThumbnail).catch(undefined),
});
export type AttachmentRef = z.infer<typeof zAttachmentRef>;

/**
 * A shared contact. Since Android round 7 a card is a Meldiq profile (name, user id, username) and never carries numbers;
 * phones and emails remain so cards from older apps still show.
 */
const zContact = z.object({
  name: z.string().max(200),
  phones: z.array(z.string().max(64)).max(20).default([]),
  emails: z.array(z.string().max(200)).max(20).default([]),
  userId: opt(z.string().max(64)),
  username: opt(z.string().max(260)),
});
const zLocation = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), accuracyM: opt(z.number()), label: opt(z.string().max(200)) });
/** Only web links: a link preview comes from another person's device, so nothing like javascript: may become a link. */
export const isWebUrl = (u: string): boolean => /^https?:\/\/[^\s]+$/i.test(u);
const zLink = z.object({
  url: z.string().max(2048).refine(isWebUrl, "link previews must be http(s) URLs"),
  title: opt(z.string().max(300)),
  description: opt(z.string().max(1000)),
  siteName: opt(z.string().max(200)),
});

/** A poll (docs/RICH_MESSAGES.md › Polls): bounded here, cleaned by sync/polls.ts like android PollRules.clean. */
const zPoll = z.object({
  question: z.string().max(1000),
  options: z.array(z.object({ id: z.string().max(32), text: z.string().max(500), emoji: opt(z.string().max(32)) })).max(20),
  multi: z.boolean().default(false),
  /** Android batch B8: when voting ends (epoch ms); absent: open until its creator closes it. */
  endsAt: opt(z.number().int()),
});
/** A sticker reference into the shared catalogue (docs/STICKERS.md); the text carries the readable fallback. */
const zSticker = z.object({ pack: z.string().max(64), id: z.string().max(64) });
/**
 * A GIF from the server's GIF search (API 0.45.0, docs/GIFS.md): the provider's media address (shown through the
 * server's /v1/gifs/media, never fetched directly), its size and a title. The message's text is that address too, so
 * apps that don't show GIFs show the link.
 */
const zGif = z.object({
  provider: z.enum(["tenor", "giphy"]),
  id: z.string().max(64),
  url: z.string().max(2048),
  width: z.number().int().min(1).max(4096),
  height: z.number().int().min(1).max(4096),
  title: opt(z.string().max(200)),
});
/**
 * Batch B9: a community's emoji or sticker as a message names it (android CustomEmojiRef): which one ([id] in community
 * [orgId]), its name, and the image's SHA-256, so the image is shown only if the downloaded one is the one meant.
 */
const zCustomEmoji = z.object({ id: z.string().max(64), orgId: z.string().max(64), name: z.string().max(64), sha256: z.string().max(128), animated: z.boolean().default(false) });

/**
 * Where a forwarded message came from (android ForwardOrigin, 2026-10-23): the community's name, when the original was
 * sent, and its ids so members of that channel can open it. Only for messages forwarded out of a community channel.
 */
const zOrigin = z.object({ place: opt(z.string().max(200)), at: opt(z.number()), conversationId: opt(z.string().max(128)), messageId: opt(z.string().max(128)) });

export const zPayload = z.object({
  type: z.string().max(40),
  text: opt(z.string().max(100_000)),
  replyTo: opt(id),
  threadRoot: opt(id),
  mentions: opt(z.array(id).max(500)),
  mentionAll: opt(z.boolean()),
  /** Community parity A1: the community roles this message @mentions (the server checks who may mention them). */
  roleMentions: opt(z.array(id).max(20)),
  attachments: opt(z.array(zAttachmentRef).max(100)),
  target: opt(id),
  emoji: opt(z.string().min(1).max(64)),
  add: opt(z.boolean()),
  pinned: opt(z.boolean()),
  upTo: opt(z.number().int().nonnegative()),
  callId: opt(id),
  video: opt(z.boolean()),
  e2eeKey: opt(z.string().max(128)),
  contact: opt(zContact),
  location: opt(zLocation),
  animoji: opt(z.string().max(64)),
  forwarded: opt(z.boolean()),
  origin: opt(zOrigin),
  link: opt(zLink),
  poll: opt(zPoll),
  sticker: opt(zSticker),
  gif: opt(zGif),
  /** A "vote" control: the chosen option ids of the poll in [target] (empty takes the vote back). */
  choices: opt(z.array(z.string().max(32)).max(20)),
  /** A vote's display privacy: updated clients hide this voter's identity in poll results. */
  anonymous: opt(z.boolean()),
  /** A forum post's title (communities); [text] then starts with the title and a blank line. Omitted elsewhere. */
  title: opt(z.string().max(1000)),
  /** A forum post's tag ids, from the forum's tag list. */
  tags: opt(z.array(z.string().max(64)).max(50)),
  /** Batch B9: community emoji used in [text] as `:name:`, and a community sticker (text: its `:name:`). */
  customEmoji: opt(z.array(zCustomEmoji).max(50)),
  customSticker: opt(zCustomEmoji),
  /**
   * Community parity C (server docs/COMMUNITY_PARITY_API.md › Posting tools): a webhook's or the Tickets sender's boxes,
   * buttons and name. Only the server's own senders may post them, so they're read from server-stored messages only
   * (sync/receiver.ts); each item is cleaned on its own by sync/posting/embeds.ts, a bad one dropped, never the message.
   */
  embeds: opt(z.array(z.unknown()).max(50)),
  buttons: opt(z.array(z.unknown()).max(50)),
  webhook: opt(z.unknown()),
  /** [text] was made from the boxes for older apps: not shown beside them. */
  textFromEmbeds: opt(z.boolean()),
  /**
   * Community parity D: the Giveaways bot's card, `{ id, endsAt, winners, ended, winnerIds? }` (cleaned by sync/rules.ts
   * cleanGiveaway). A server sender's field like the boxes: never read from an end-to-end envelope.
   */
  giveaway: opt(z.unknown()),
});
export type CustomEmojiRef = z.infer<typeof zCustomEmoji>;
export type Payload = z.infer<typeof zPayload>;

/** Fields only the server's own senders may put in a payload: never read from an end-to-end envelope. */
export function withoutServerFields(p: Payload): Payload {
  const { embeds: _e, buttons: _b, webhook: _w, textFromEmbeds: _t, giveaway: _g, ...rest } = p;
  return rest;
}
export type ForwardOrigin = z.infer<typeof zOrigin>;
export type Poll = z.infer<typeof zPoll>;
export type StickerRef = z.infer<typeof zSticker>;
export type GifRef = z.infer<typeof zGif>;

export type ContactCard = z.infer<typeof zContact>;
export type SharedLocation = z.infer<typeof zLocation>;
export type LinkPreview = z.infer<typeof zLink>;

/** Payload types this client acts on; anything else (a newer app's) is acknowledged and ignored. */
export const KNOWN_TYPES = ["text", "edit", "delete", "reaction", "pin", "vote", "poll_close", "read", "call_invite", "call_key_request"] as const;

/** Parses decrypted JSON. Returns null for something that isn't a payload at all. */
export function parsePayload(json: string): Payload | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!withinJsonBudget(raw)) return null;
  const r = zPayload.safeParse(raw);
  return r.success ? r.data : null;
}

/** What this browser sends: only fields that are set, so other apps see the exact wire format they expect. */
export function encodePayload(p: Payload): string {
  return JSON.stringify(Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null)));
}

/** At most this many files of a received message are shown (android MessageRepository.MAX_RECEIVED_ATTACHMENTS). */
export const MAX_RECEIVED_ATTACHMENTS = 20;

/** File names are shown as text only: control and direction-changing characters are removed (android AttachmentPolicy.safeName). */
export function safeFileName(name: string): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = name.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, "").trim();
  return cleaned.slice(0, 200) || "file";
}
