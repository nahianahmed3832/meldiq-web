/**
 * An image's type from its first bytes: community icons and banners can be animated GIFs or WebPs since API 0.64.0, and
 * the same route answers either. JPEG when it's none of these.
 */
export function imageMime(b: Uint8Array): string {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b.length >= 6 && ascii(0, 4) === "GIF8") return "image/gif";
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (b.length >= 8 && b[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  return "image/jpeg";
}
