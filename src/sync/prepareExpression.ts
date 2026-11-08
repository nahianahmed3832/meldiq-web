import { text as uiText } from "../i18n";
import { expressionByteLimit, SHRINK_TO } from "./expressions";
const ascii = (bytes: Uint8Array, offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));
/** Detect animation before using canvas, which would discard every frame except the first. */
export function expressionFormat(bytes: Uint8Array): {
  mime: string;
  animated: boolean;
} | null {
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
export async function prepareExpression(file: File, kind: "emoji" | "sticker", largeStickers = false): Promise<PreparedExpression> {
  const limit = expressionByteLimit(kind, largeStickers);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = expressionFormat(bytes);
  const checkDimensions = largeStickers && kind === "sticker";
  if (format && bytes.length <= limit && !checkDimensions) return { bytes, mime: format.mime, converted: false };
  if (format?.animated && bytes.length > limit)
    throw new Error(uiText(checkDimensions ? "workspace.reference.stickerAnimationSize" : "workspace.interface.this_animated_image_is_over_256_kb_optimize_it_to_256_kb_or_less_6677b4e"));
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(uiText("workspace.interface.that_picture_couldn_t_be_read_choose_a_png_gif_webp_or_jpeg_image_3883d7d"));
  });
  try {
    const scale = Math.min(1, SHRINK_TO[kind] / Math.max(bitmap.width, bitmap.height));
    if (format && bytes.length <= limit && scale === 1) return { bytes, mime: format.mime, converted: false };
    if (format?.animated) throw new Error(uiText("workspace.reference.stickerAnimationSize"));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error(uiText("workspace.interface.this_browser_can_t_resize_pictures_b2b8cd3"));
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error(uiText("workspace.interface.this_browser_can_t_resize_pictures_b2b8cd3"));
    if (blob.size > limit)
      throw new Error(uiText(checkDimensions ? "workspace.reference.stickerAnimationSize" : "workspace.interface.that_picture_is_still_over_256_kb_after_resizing_choose_a_smaller_4ee981e"));
    return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: "image/png", converted: true };
  } finally {
    bitmap.close();
  }
}
