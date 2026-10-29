import { z } from "zod";
import { apiBase } from "../application/config";
import type { Engine } from "./engine";

/**
 * Profile decorations (API 0.60.0, server docs/PROFILE_DECORATIONS.md): Meldiq's own, ones people make and send in
 * (shown to everyone once Meldiq's staff approve them), and your own submissions. A decoration is a square image whose
 * middle circle is left for the avatar; it's drawn 1.2 times the avatar's size, centred on it.
 */

const zCreator = z.object({ userId: z.string(), username: z.string().nullable(), displayName: z.string() });
export const zDecoration = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["meldiq", "community"]).catch("community"),
  animated: z.boolean(),
  imageUrl: z.string(),
  creator: zCreator.nullable(),
});
export type Decoration = z.infer<typeof zDecoration>;

const zCatalog = z.object({ decorations: z.array(zDecoration), classic: z.array(z.string()), templateUrl: z.string() });
export type DecorationCatalog = z.infer<typeof zCatalog>;

export const zSubmission = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["pending", "approved", "rejected", "removed"]),
  reason: z.string().nullable(),
  animated: z.boolean(),
  imageUrl: z.string(),
  wearers: z.number(),
  createdAt: z.number(),
  reviewedAt: z.number().nullable(),
});
export type DecorationSubmission = z.infer<typeof zSubmission>;
const zMine = z.object({ submissions: z.array(zSubmission), artist: z.boolean(), pendingLimit: z.number(), pending: z.number() });
export type MyDecorations = z.infer<typeof zMine>;

/** What the server takes (server DECORATION_LIMITS): checked here first so a mistake is said before the upload. */
export const DECORATION_LIMITS = { mb: 1.5, minSide: 128, maxSide: 1024, types: ["image/png", "image/webp", "image/gif"] } as const;

/** A decoration's image: anyone may load it, so it's a plain URL (same origin as the API). */
export const decorationImage = (id: string): string => `${apiBase()}/v2/decorations/${encodeURIComponent(id)}/image`;
export const decorationTemplate = (): string => `${apiBase()}/v2/decorations/template`;

export async function decorationCatalog(engine: Engine): Promise<DecorationCatalog> {
  return engine.api.json("GET", "/v2/decorations", zCatalog);
}

export async function myDecorations(engine: Engine): Promise<MyDecorations> {
  return engine.api.json("GET", "/v2/decorations/mine", zMine);
}

/** Sends [image] in for review, with your word that you made it. */
export async function submitDecoration(engine: Engine, name: string, image: Uint8Array): Promise<DecorationSubmission> {
  return (await engine.api.json("POST", `/v2/decorations?name=${encodeURIComponent(name.trim())}&original=true`, z.object({ submission: zSubmission }), { raw: image })).submission;
}

/** Withdraws one of yours; an approved one leaves the catalog and comes off everyone wearing it. */
export async function withdrawDecoration(engine: Engine, id: string): Promise<void> {
  await engine.api.call("DELETE", `/v2/decorations/mine/${encodeURIComponent(id)}`);
}

/** A person's approved decorations, to try on and wear. */
export async function userDecorations(engine: Engine, userId: string): Promise<Decoration[]> {
  return (await engine.api.json("GET", `/v2/users/${encodeURIComponent(userId)}/decorations`, z.object({ decorations: z.array(zDecoration) }))).decorations;
}

/** Checks a picked file before it's sent: its type, size and that it's a square of 128 to 1024 px. Null when fine. */
export async function decorationFileProblem(file: File): Promise<string | null> {
  const L = DECORATION_LIMITS;
  if (!(L.types as readonly string[]).includes(file.type)) return "Decorations are PNG, WebP or GIF images.";
  if (file.size > L.mb * 1024 * 1024) return `Decorations can be up to ${L.mb} MB.`;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (img.naturalWidth !== img.naturalHeight) return `Decorations are square; that image is ${img.naturalWidth} × ${img.naturalHeight}.`;
    if (img.naturalWidth < L.minSide || img.naturalWidth > L.maxSide) return `Decorations are ${L.minSide} to ${L.maxSide} pixels square (512 × 512 works best).`;
    return null;
  } catch {
    return "That image couldn't be read.";
  } finally {
    URL.revokeObjectURL(url);
  }
}
