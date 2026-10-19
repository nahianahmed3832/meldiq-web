import { z } from "zod";
import type { StickerRef } from "../protocol/payload";
import catalogueJson from "./meldiq-stickers-v1.json";

/**
 * Meldiq stickers (docs/STICKERS.md): original designs drawn by the app from the shared catalogue
 * (shared/stickers/meldiq-stickers-v1.json in the server repository, copied here unchanged), the emoji in the device's own
 * font over a soft shape in the sticker's tone, a caption, and a motion. A message carries only {pack, id} and a readable
 * fallback text; a sticker this catalogue doesn't know shows that text.
 */
const ID = /^[a-z0-9-]{1,32}$/;
export const TONES = ["indigo", "violet", "rose", "amber", "green", "teal", "sky", "slate"] as const;
export const MOTIONS = ["stamp", "rise", "bounce", "pulse", "wiggle", "pop", "float", "sway", "shake", "spin", "confetti", "burst"] as const;

const zSpec = z.object({
  id: z.string().regex(ID),
  emoji: z.string().min(1).max(16),
  caption: z.string().min(1).max(32),
  tone: z.enum(TONES).catch("slate"),
  motion: z.enum(MOTIONS).catch("pop"),
  keywords: z.array(z.string()).default([]),
});
export type StickerSpec = z.infer<typeof zSpec>;
export interface StickerPack {
  id: string;
  name: string;
  stickers: StickerSpec[];
}

/** Parsed defensively (android StickerCatalog.parse): a malformed sticker is left out, not the whole pack. */
function parse(raw: unknown): StickerPack[] {
  const packs = z.object({ packs: z.array(z.object({ id: z.string().regex(ID), name: z.string(), stickers: z.array(z.unknown()) })) }).safeParse(raw);
  if (!packs.success) return [];
  return packs.data.packs.map((p) => ({ id: p.id, name: p.name, stickers: p.stickers.flatMap((s) => (zSpec.safeParse(s).success ? [zSpec.parse(s)] : [])) }));
}

export const STICKER_PACKS: readonly StickerPack[] = parse(catalogueJson);

/** A received reference, checked (android RichRules.cleanSticker); null when it isn't a well-formed one. */
export function cleanSticker(ref: StickerRef | null | undefined): StickerRef | null {
  return ref && ID.test(ref.pack) && ID.test(ref.id) ? { pack: ref.pack, id: ref.id } : null;
}

export function findSticker(ref: StickerRef | null | undefined): StickerSpec | null {
  if (!ref) return null;
  return STICKER_PACKS.find((p) => p.id === ref.pack)?.stickers.find((s) => s.id === ref.id) ?? null;
}

/** The readable text a sticker message carries for apps, notifications and screen readers that don't draw it. */
export function stickerFallback(s: StickerSpec): string {
  return `${s.emoji} ${s.caption}`;
}

/** Search by caption, keyword or emoji. */
export function searchStickers(query: string): { pack: string; spec: StickerSpec }[] {
  const q = query.trim().toLowerCase();
  const all = STICKER_PACKS.flatMap((p) => p.stickers.map((spec) => ({ pack: p.id, spec })));
  if (!q) return all;
  return all.filter(({ spec }) => spec.caption.toLowerCase().includes(q) || spec.emoji === q || spec.keywords.some((k) => k.toLowerCase().includes(q)));
}
