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
  return croppedJpeg(file, SIDE, SIDE, MAX_BYTES, "That image is too detailed to fit 512 KB. Try another one.");
}

/** A picked image as a community banner: centre-cropped to 1200 × 480 and re-encoded (no camera metadata). */
export async function bannerJpeg(file: File): Promise<Uint8Array> {
  return croppedJpeg(file, BANNER.width, BANNER.height, BANNER.maxBytes, "That image is too detailed to fit 1 MB. Try another one.");
}

async function croppedJpeg(file: File, width: number, height: number, maxBytes: number, tooBig: string): Promise<Uint8Array> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That image couldn't be read.");
  });
  // The largest centred part of the image with the target's shape.
  const scale = Math.min(bitmap.width / width, bitmap.height / height);
  const [sw, sh] = [width * scale, height * scale];
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("This browser can't resize images.");
  g.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, width, height);
  bitmap.close();
  for (const q of QUALITIES) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= maxBytes) return new Uint8Array(await blob.arrayBuffer());
  }
  throw new Error(tooBig);
}
