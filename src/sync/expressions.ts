import { z } from "zod";
import { isReaction } from "../emoji/rules";
import type { CustomEmojiRef } from "../protocol/payload";
import type { Engine } from "./engine";

/**
 * A community's own emoji and stickers (batches B9, B12; server routes/expressions.ts; android ExpressionRules). The
 * text keeps `:name:`; inside the encrypted message go the emoji's id, community and SHA-256. An image is shown only when
 * the downloaded bytes have that hash; people outside the community, older apps and notifications see `:name:`.
 */
export const EXPRESSION_NAME = /^[a-z0-9_]{2,32}$/;
const ID = /^(emj|stk)_[A-Za-z0-9_-]{1,40}$/;
const ORG = /^[A-Za-z0-9_-]{1,64}$/;
const SHA = /^[0-9a-f]{64}$/;
const TOKEN = /:([a-z0-9_]{2,32}):/g;
const REACTION = /^:[a-z0-9_]{2,32}:$/;
export const MAX_REFS = 20;
export const EXPRESSION_MAX_BYTES = 256 * 1024;
/** Pictures that aren't PNG, GIF or WebP, or are too big, are shrunk to a PNG this wide (android ExpressionsScreen). */
export const SHRINK_TO = { emoji: 128, sticker: 320 } as const;

export function cleanRef(r: CustomEmojiRef | null | undefined): CustomEmojiRef | null {
  return r && ID.test(r.id) && ORG.test(r.orgId) && EXPRESSION_NAME.test(r.name) && SHA.test(r.sha256) ? r : null;
}

/** Well-formed references whose `:name:` really is in [text], one per name, at most [MAX_REFS]. */
export function cleanRefs(refs: readonly CustomEmojiRef[] | null | undefined, text: string): CustomEmojiRef[] {
  const names = new Set([...text.matchAll(TOKEN)].map((m) => m[1]));
  const seen = new Set<string>();
  const out: CustomEmojiRef[] = [];
  for (const r of refs ?? []) {
    const c = cleanRef(r);
    if (!c || !names.has(c.name) || seen.has(c.name)) continue;
    seen.add(c.name);
    out.push(c);
  }
  return out.slice(0, MAX_REFS);
}

export interface EmojiToken {
  start: number;
  end: number;
  ref: CustomEmojiRef;
}

/** Where each referenced `:name:` sits in [text] (every occurrence). */
export function emojiTokens(text: string, refs: readonly CustomEmojiRef[]): EmojiToken[] {
  if (!refs.length) return [];
  const byName = new Map(refs.map((r) => [r.name, r]));
  return [...text.matchAll(TOKEN)].flatMap((m) => {
    const ref = byName.get(m[1]);
    return ref ? [{ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, ref }] : [];
  });
}

/** The references a message being sent needs: the picked emoji whose `:name:` is still in the text. */
export const forSending = (text: string, picked: Iterable<CustomEmojiRef>): CustomEmojiRef[] => cleanRefs([...picked], text);

/** Batch B12: a reaction with a community emoji is its `:name:` (inside that community's channels only). */
export const isCustomReaction = (v: string | null | undefined): v is string => !!v && REACTION.test(v);
export const reactionName = (v: string): string | null => (isCustomReaction(v) ? v.slice(1, -1) : null);

/** A reaction allowed in a conversation: any single emoji, or a community emoji's `:name:` in a community. */
export function reactionAllowed(v: string | null | undefined, inCommunity: boolean): v is string {
  return isReaction(v) || (inCommunity && isCustomReaction(v));
}

/** A name as typed for an upload: lowercase, spaces and dashes to `_`, other characters dropped. */
export function suggestName(raw: string): string {
  const base = raw.includes(".") ? raw.slice(0, raw.lastIndexOf(".")) : raw;
  return base
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 32);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ───────────── the server ─────────────

export const zExpression = z.object({
  id: z.string(),
  orgId: z.string(),
  kind: z.enum(["emoji", "sticker"]),
  name: z.string(),
  animated: z.boolean().default(false),
  sha256: z.string(),
  size: z.number().int().default(0),
  createdBy: z.string().nullish(),
  createdAt: z.number(),
  /**
   * API 0.54.0 (Meldiq Mojo): over a limit, kept but not offered for new messages: "slots" beyond the community's Spark
   * level, "plan" beyond its adder's plan. Sent messages still show it.
   */
  locked: z.enum(["slots", "plan"]).nullish(),
});
export type Expression = z.infer<typeof zExpression>;
const zList = z.object({ expressions: z.array(zExpression), limits: z.object({ emoji: z.number(), sticker: z.number() }).default({ emoji: 50, sticker: 20 }) });
export type ExpressionList = z.infer<typeof zList>;
const enc = encodeURIComponent;

export const refOf = (e: Expression): CustomEmojiRef => ({ id: e.id, orgId: e.orgId, name: e.name, sha256: e.sha256, animated: e.animated });

const lists = new Map<string, Promise<ExpressionList>>();

/** A community's emoji and stickers (members only), kept for the page's life and loaded again when [fresh]. */
export function expressions(engine: Engine, orgId: string, fresh = false): Promise<ExpressionList> {
  let p = lists.get(orgId);
  if (!p || fresh) {
    p = engine.api.json("GET", `/v1/orgs/${enc(orgId)}/expressions`, zList);
    p.catch(() => lists.delete(orgId));
    lists.set(orgId, p);
  }
  return p;
}

export async function uploadExpression(engine: Engine, orgId: string, kind: "emoji" | "sticker", name: string, bytes: Uint8Array): Promise<Expression> {
  const q = new URLSearchParams({ kind, name });
  const r = await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/expressions?${q}`, z.object({ expression: zExpression }), { raw: bytes });
  await expressions(engine, orgId, true);
  return r.expression;
}

export async function renameExpression(engine: Engine, orgId: string, id: string, name: string): Promise<void> {
  await engine.api.call("PATCH", `/v1/expressions/${enc(id)}`, { body: { name } });
  await expressions(engine, orgId, true);
}

export async function removeExpression(engine: Engine, orgId: string, id: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/expressions/${enc(id)}`);
  await expressions(engine, orgId, true);
}

const images = new Map<string, Promise<string | null>>();

/**
 * The image of [ref] as an object URL, or null: not a member, gone, or (when [sha256] is given) not the image the
 * message meant. Kept for the page's life; a failed download isn't kept.
 */
export function expressionImage(engine: Engine, id: string, sha256: string | null): Promise<string | null> {
  const key = `${id}:${sha256 ?? ""}`;
  let p = images.get(key);
  if (!p) {
    p = engine.api
      .bytes(`/v1/expressions/${enc(id)}/image`)
      .then(async (b) => {
        const bytes = new Uint8Array(b);
        if (sha256 && (await sha256Hex(bytes)) !== sha256) return null;
        return URL.createObjectURL(new Blob([bytes]));
      })
      .catch(() => {
        // Offline or a server error: the next render tries again (a wrong hash above stays refused).
        images.delete(key);
        return null;
      });
    images.set(key, p);
  }
  return p;
}
