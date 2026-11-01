import { EXPRESSION_MAX_BYTES, SHRINK_TO } from "./expressions";

const ascii = (bytes: Uint8Array, offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));
/** Detect animation before using canvas, which would discard every frame except the first. */
export function expressionFormat(bytes: Uint8Array): { mime: string; animated: boolean } | null {
  if (["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6))) return { mime: "image/gif", animated: true };
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let animated = false;
    for (let i = 12; i + 8 <= bytes.length;) {
      const type = ascii(bytes, i, 4);
      if (type === "ANIM" || type === "ANMF" || (type === "VP8X" && i + 8 < bytes.length && (bytes[i + 8]! & 2) !== 0)) animated = true;
      const size = view.getUint32(i + 4, true);
      i += 8 + size + (size % 2);
    }
    return { mime: "image/webp", animated };
  }
  if (bytes[0] === 137 && ascii(bytes, 1, 3) === "PNG") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 8; i + 8 <= bytes.length;) {
      if (ascii(bytes, i + 4, 4) === "acTL") return { mime: "image/png", animated: true };
      i += 12 + view.getUint32(i);
    }
    return { mime: "image/png", animated: false };
  }
  return null;
}

export interface PreparedExpression {
  bytes: Uint8Array<ArrayBuffer>;
  mime: string;
  converted: boolean;
}

/** Keep supported animation byte-for-byte; oversized animated files need optimization, never silent flattening. */
export async function prepareExpression(file: File, kind: "emoji" | "sticker"): Promise<PreparedExpression> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = expressionFormat(bytes);
  if (format && bytes.length <= EXPRESSION_MAX_BYTES) return { bytes, mime: format.mime, converted: false };
  if (format?.animated) throw new Error("This animated image is over 256 KB. Optimize it to 256 KB or less to keep its animation, then choose it again.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That picture couldn't be read. Choose a PNG, GIF, WebP or JPEG image.");
  });
  try {
    const scale = Math.min(1, SHRINK_TO[kind] / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser can't resize pictures.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("This browser can't resize pictures.");
    if (blob.size > EXPRESSION_MAX_BYTES) throw new Error("That picture is still over 256 KB after resizing. Choose a smaller image.");
    return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: "image/png", converted: true };
  } finally {
    bitmap.close();
  }
}
