import { expressionFormat } from "./prepareExpression";

/** Automatic uploads use efficient, upright static photos. Explicit quality modes remain for stored legacy preferences. */
export type PhotoQuality = "standard" | "hd" | "original";

export const QUALITY_LABEL: Record<PhotoQuality, string> = { standard: "Standard", hd: "HD", original: "Original" };

const SETTINGS: Record<Exclude<PhotoQuality, "original">, { edge: number; jpeg: number }> = {
  standard: { edge: 1600, jpeg: 0.82 },
  hd: { edge: 4096, jpeg: 0.92 },
};

/** Photos this browser can decode and re-encode; anything else goes as it is. */
export function reencodable(type: string): boolean {
  return type === "image/jpeg" || type === "image/png" || type === "image/webp";
}

/** The size a photo is drawn at: scaled down to fit [edge] on its longest side, never up. */
export function fitWithin(width: number, height: number, edge: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= edge) return { width, height };
  const k = edge / longest;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

/** The sent file's name: a re-encoded JPEG ends in .jpg. */
export function encodedName(name: string, type: string): string {
  const extension = ({ "image/jpeg": "jpg", "image/webp": "webp", "image/png": "png" } as Record<string, string>)[type];
  if (!extension) return name;
  const base = name.replace(/\.[A-Za-z0-9]{1,5}$/, "");
  return `${base || "photo"}.${extension}`;
}

export class PhotoPrepareError extends Error {}

/** Re-encodes [file] at [quality] (browser only: needs createImageBitmap and a canvas). */
export async function preparePhoto(file: File, quality: PhotoQuality | "auto" = "auto"): Promise<File> {
  if (quality === "auto") return optimizePhoto(file);
  if (quality === "original" || !reencodable(file.type)) return file;
  if (file.size > 32 * 1024 * 1024) return file;
  if (expressionFormat(new Uint8Array(await file.arrayBuffer()))?.animated) return file;
  const { edge, jpeg } = SETTINGS[quality];
  let bitmap: ImageBitmap;
  try {
    // Upright, from its EXIF orientation; the metadata itself isn't drawn, so it isn't sent.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoPrepareError(`"${file.name}" couldn't be prepared in this browser. Choose Original to send it as it is.`);
  }
  try {
    const size = fitWithin(bitmap.width, bitmap.height, edge);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new PhotoPrepareError(`"${file.name}" couldn't be prepared in this browser. Choose Original to send it as it is.`);
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    const type = file.type;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, jpeg));
    if (!blob) throw new PhotoPrepareError(`"${file.name}" couldn't be prepared in this browser. Choose Original to send it as it is.`);
    return new File([blob], encodedName(file.name, type), { type, lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}

/** Automatic sending is best effort: preserve animations, and keep files the browser cannot decode. */
export async function optimizePhoto(file: File): Promise<File> {
  if (!reencodable(file.type) || file.size > 32 * 1024 * 1024) return file;
  try {
    if (expressionFormat(new Uint8Array(await file.arrayBuffer()))?.animated) return file;
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      // A longest-edge resize turns a long screenshot into unreadable, narrow text. Preserve these originals.
      if (Math.max(bitmap.width, bitmap.height) / Math.max(1, Math.min(bitmap.width, bitmap.height)) >= 3) return file;
      const size = fitWithin(bitmap.width, bitmap.height, 2560);
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext("2d");
      if (!context) return file;
      context.drawImage(bitmap, 0, 0, size.width, size.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
      // Some browsers fall back to PNG. Keep valid fallback files correctly named and never inflate a small photo.
      if (!blob || (blob.size >= file.size && size.width === bitmap.width && size.height === bitmap.height)) return file;
      return new File([blob], encodedName(file.name, blob.type), { type: blob.type, lastModified: file.lastModified });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}

/** Downloads return the exact verified file. Format conversion is an explicit export operation, never a download side effect. */
export async function photoDownload(blob: Blob, name: string): Promise<{ blob: Blob; name: string }> {
  return { blob, name };
}
