import { text as uiText } from "../../i18n";
/** Largest photo the server accepts (server/src/photos.ts MAX_PHOTO_BYTES). */
const MAX_BYTES = 512 * 1024;
const SIDE = 512;
/** A community banner (API 0.44.0): 5:2, at most 1 MB (server MAX_BANNER_BYTES). */
const BANNER = { width: 1200, height: 480, maxBytes: 1024 * 1024 } as const;
const QUALITIES = [0.86, 0.76, 0.66, 0.56];
/**
 * A picked image as the square 512 px JPEG the server stores (as the phone sends it): centre-cropped and re-encoded on a
 * canvas, which also drops camera metadata such as location.
 */
export async function squareJpeg(file: File): Promise<Uint8Array> {
  return croppedJpeg(file, SIDE, SIDE, MAX_BYTES, uiText("workspace.interface.that_image_is_too_detailed_to_fit_512_kb_try_another_one_559b788"));
}
/** A picked image as a community banner: centre-cropped to 1200 × 480 and re-encoded (no camera metadata). */
export async function bannerJpeg(file: File): Promise<Uint8Array> {
  return croppedJpeg(file, BANNER.width, BANNER.height, BANNER.maxBytes, uiText("workspace.interface.that_image_is_too_detailed_to_fit_1_mb_try_another_one_c08d223"));
}
/** Animated community icons and banners (API 0.64.0, server COMMUNITY_IMAGE_LIMITS), in MB. */
const ANIMATED_MB = { icon: 4, banner: 6 } as const;
/**
 * A picked animated GIF or WebP, sent as it is (API 0.64.0) when the server takes animated community images; null for
 * anything else, which is cropped and re-encoded as before.
 */
export async function animatedUpload(file: File, which: keyof typeof ANIMATED_MB, supported: boolean): Promise<Uint8Array | null> {
  if (!supported || (file.type !== "image/gif" && file.type !== "image/webp")) return null;
  const mb = ANIMATED_MB[which];
  if (file.size > mb * 1024 * 1024)
    throw new Error(
      uiText("workspace.interface.animated_value0_can_be_up_to_value1_mb_94f21ed", {
        value0: which === "icon" ? uiText("workspace.interface.icons_ae7368c") : uiText("workspace.interface.banners_e75146c"),
        value1: mb,
      }),
    );
  return new Uint8Array(await file.arrayBuffer());
}
async function croppedJpeg(file: File, width: number, height: number, maxBytes: number, tooBig: string): Promise<Uint8Array> {
  if (!file.type.startsWith("image/")) throw new Error(uiText("workspace.interface.choose_an_image_file_e55fd5b"));
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(uiText("workspace.interface.that_image_couldn_t_be_read_ce3f1dc"));
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  try {
    // The largest centred part of the picture with the target's shape.
    const scale = Math.min(bitmap.width / width, bitmap.height / height);
    const [sw, sh] = [width * scale, height * scale];
    const g = canvas.getContext("2d");
    if (!g) throw new Error(uiText("workspace.interface.this_browser_can_t_resize_images_849d3cd"));
    g.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, width, height);
  } finally {
    bitmap.close();
  }
  for (const q of QUALITIES) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= maxBytes) return new Uint8Array(await blob.arrayBuffer());
  }
  throw new Error(tooBig);
}
