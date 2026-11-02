import { z } from "zod";
import { apiBase } from "../application/config";
import type { Engine } from "./engine";

/**
 * Profile pins (API 0.64.0, server docs/PROFILE_PINS.md): Meldiq's own, earned for milestones, and the ones a
 * community's owners and admins make and give to members. Every pin is a small square image anyone may load.
 */

const enc = encodeURIComponent;

export const zCommunityPin = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string(),
  animated: z.boolean(),
  holders: z.number(),
  createdAt: z.number(),
});
export type CommunityPin = z.infer<typeof zCommunityPin>;

const zCommunityPins = z.object({ pins: z.array(zCommunityPin), canManage: z.boolean(), limit: z.number() });
export type CommunityPins = z.infer<typeof zCommunityPins>;

const zHolder = z.object({ userId: z.string(), username: z.string().nullable(), displayName: z.string(), awardedAt: z.number() });
export type PinHolder = z.infer<typeof zHolder>;

/** What the server takes (server PIN_LIMITS): checked here first so a mistake is said before the upload. */
export const PIN_LIMITS = { kb: 512, minSide: 64, maxSide: 512, types: ["image/png", "image/webp", "image/gif"] } as const;

/** A pin's image: anyone may load it, so it's a plain URL (same origin as the API). */
export const pinImage = (id: string): string => `${apiBase()}/v2/pins/${enc(id)}/image`;

export async function communityPins(engine: Engine, orgId: string): Promise<CommunityPins> {
  return engine.api.json("GET", `/v2/orgs/${enc(orgId)}/pins`, zCommunityPins);
}

export async function createPin(engine: Engine, orgId: string, name: string, description: string, image: Uint8Array): Promise<CommunityPin> {
  const desc = description.trim() ? `&description=${enc(description.trim())}` : "";
  return (await engine.api.json("POST", `/v2/orgs/${enc(orgId)}/pins?name=${enc(name.trim())}${desc}`, z.object({ pin: zCommunityPin }), { raw: image })).pin;
}

export async function deletePin(engine: Engine, orgId: string, pinId: string): Promise<void> {
  await engine.api.call("DELETE", `/v2/orgs/${enc(orgId)}/pins/${enc(pinId)}`);
}

export async function pinHolders(engine: Engine, orgId: string, pinId: string): Promise<PinHolder[]> {
  return (await engine.api.json("GET", `/v2/orgs/${enc(orgId)}/pins/${enc(pinId)}/holders`, z.object({ holders: z.array(zHolder) }))).holders;
}

export async function givePin(engine: Engine, orgId: string, pinId: string, userId: string): Promise<void> {
  await engine.api.call("PUT", `/v2/orgs/${enc(orgId)}/pins/${enc(pinId)}/holders/${enc(userId)}`);
}

export async function takePinBack(engine: Engine, orgId: string, pinId: string, userId: string): Promise<void> {
  await engine.api.call("DELETE", `/v2/orgs/${enc(orgId)}/pins/${enc(pinId)}/holders/${enc(userId)}`);
}

/** Checks a picked file before it's sent: its type, size and that it's a square of 64 to 512 px. Null when fine. */
export async function pinFileProblem(file: File): Promise<string | null> {
  const L = PIN_LIMITS;
  if (!(L.types as readonly string[]).includes(file.type)) return "Pins are PNG, WebP or GIF images.";
  if (file.size > L.kb * 1024) return `Pins can be up to ${L.kb} KB.`;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (img.naturalWidth !== img.naturalHeight) return `Pins are square; that image is ${img.naturalWidth} × ${img.naturalHeight}.`;
    if (img.naturalWidth < L.minSide || img.naturalWidth > L.maxSide) return `Pins are ${L.minSide} to ${L.maxSide} pixels square (128 × 128 works well).`;
    return null;
  } catch {
    return "That image couldn't be read.";
  } finally {
    URL.revokeObjectURL(url);
  }
}
