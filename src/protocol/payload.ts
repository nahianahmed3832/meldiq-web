import { z } from "zod";

/**
 * The plaintext inside griip-envelope-v1 (android data/model/Models.kt `Payload`). It comes from other people's devices, so
 * it is validated like any untrusted input. Unknown fields are dropped and unknown types ignored, so newer apps' messages
 * never break this one (android/app/src/test/resources/griip-payload-v1-vectors.json › forwardCompatible).
 */

const id = z.string().min(1).max(128);
const opt = <T extends z.ZodTypeAny>(t: T) => t.nullish().transform((v) => v ?? undefined);

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
  chunk: opt(z.number().int().positive()),
});
export type AttachmentRef = z.infer<typeof zAttachmentRef>;

const zContact = z.object({ name: z.string().max(200), phones: z.array(z.string().max(64)).max(20).default([]), emails: z.array(z.string().max(200)).max(20).default([]) });
const zLocation = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), accuracyM: opt(z.number()), label: opt(z.string().max(200)) });
/** Only web links: a link preview comes from another person's device, so nothing like javascript: may become a link. */
export const isWebUrl = (u: string): boolean => /^https?:\/\/[^\s]+$/i.test(u);
const zLink = z.object({
  url: z.string().max(2048).refine(isWebUrl, "link previews must be http(s) URLs"),
  title: opt(z.string().max(300)),
  description: opt(z.string().max(1000)),
  siteName: opt(z.string().max(200)),
});

export const zPayload = z.object({
  type: z.string().max(40),
  text: opt(z.string().max(100_000)),
  replyTo: opt(id),
  threadRoot: opt(id),
  mentions: opt(z.array(id).max(500)),
  mentionAll: opt(z.boolean()),
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
  link: opt(zLink),
});
export type Payload = z.infer<typeof zPayload>;

export type ContactCard = z.infer<typeof zContact>;
export type SharedLocation = z.infer<typeof zLocation>;
export type LinkPreview = z.infer<typeof zLink>;

/** Payload types this client acts on; anything else (a newer app's) is acknowledged and ignored. */
export const KNOWN_TYPES = ["text", "edit", "delete", "reaction", "pin", "read", "call_invite", "call_key_request"] as const;

/** Parses decrypted JSON. Returns null for something that isn't a payload at all. */
export function parsePayload(json: string): Payload | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
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
