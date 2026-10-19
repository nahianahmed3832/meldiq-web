/** Largest photo the server accepts (server/src/photos.ts MAX_PHOTO_BYTES). */
const MAX_BYTES = 512 * 1024;
const SIDE = 512;
const QUALITIES = [0.86, 0.76, 0.66, 0.56];

/**
 * A picked image as the square 512 px JPEG the server stores (as the phone sends it): centre-cropped and re-encoded on a
 * canvas, which also drops camera metadata such as location.
 */
export async function squareJpeg(file: File): Promise<Uint8Array> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That image couldn't be read.");
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIDE;
  canvas.height = SIDE;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("This browser can't resize images.");
  g.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIDE, SIDE);
  bitmap.close();
  for (const q of QUALITIES) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= MAX_BYTES) return new Uint8Array(await blob.arrayBuffer());
  }
  throw new Error("That image is too detailed to fit 512 KB. Try another one.");
}
