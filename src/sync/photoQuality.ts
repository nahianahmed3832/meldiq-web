/**
 * Photo quality before sending (android BatchComposer, server docs/ATTACHMENTS.md › Quality): Standard (longest edge
 * ≤ 1600 px, JPEG 82, the default) and HD (≤ 4096 px, JPEG 92) re-encode the photo upright, so camera metadata,
 * including location, isn't carried over; Original sends the file as it is. Transparent images stay PNG; GIFs are
 * never re-encoded (they may be animated).
 */
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
  if (type !== "image/jpeg") return name;
  const base = name.replace(/\.[A-Za-z0-9]{1,5}$/, "");
  return `${base || "photo"}.jpg`;
}

export class PhotoPrepareError extends Error {}

/** Re-encodes [file] at [quality] (browser only: needs createImageBitmap and a canvas). */
export async function preparePhoto(file: File, quality: PhotoQuality): Promise<File> {
  if (quality === "original" || !reencodable(file.type)) return file;
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
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, type === "image/jpeg" ? jpeg : undefined));
    if (!blob) throw new PhotoPrepareError(`"${file.name}" couldn't be prepared in this browser. Choose Original to send it as it is.`);
    return new File([blob], encodedName(file.name, type), { type, lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}
