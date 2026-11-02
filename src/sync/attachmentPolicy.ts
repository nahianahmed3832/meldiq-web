/** Plaintext checks run on devices: the relay receives encrypted bytes and cannot inspect media signatures. */
export function attachmentName(raw: string): string {
  let name = raw
    .split(/[\\/]/)
    .pop()!
    .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim()
    .replace(/^\.+/, "");
  if (!name) return "file";
  if (name.length > 120) {
    const ext = /\.[a-z0-9]{1,10}$/i.exec(name)?.[0] ?? "";
    name = name.slice(0, 120 - ext.length) + ext;
  }
  return name;
}

/** A bounded prefix suffices to identify containers; codec support is established by the actual player. */
export function detectedMime(head: Uint8Array, declared: string): string {
  const at = (i: number, s: string) => head.length >= i + s.length && [...s].every((c, n) => head[i + n] === c.charCodeAt(0));
  const bytes = (...b: number[]) => b.every((v, n) => head[n] === v);
  if (bytes(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (bytes(0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10)) return "image/png";
  if (at(0, "GIF87a") || at(0, "GIF89a")) return "image/gif";
  if (at(0, "RIFF") && at(8, "WEBP")) return "image/webp";
  if (at(0, "RIFF") && at(8, "WAVE")) return "audio/wav";
  if (at(0, "BM") && head.length >= 14) return "image/bmp";
  if (at(4, "ftyp")) {
    const brand = String.fromCharCode(...head.slice(8, 12));
    if (["avif", "avis"].includes(brand)) return "image/avif";
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand)) return "image/heic";
    if (["M4A ", "M4B "].includes(brand) || declared === "audio/mp4") return "audio/mp4";
    return brand === "qt  " ? "video/quicktime" : "video/mp4";
  }
  if (bytes(0x1a, 0x45, 0xdf, 0xa3)) return declared === "audio/webm" ? "audio/webm" : "video/webm";
  if (head[0] === 0xff && (head[1] & 0xf6) === 0xf0) return "audio/aac";
  if (at(0, "ID3") || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  if (at(0, "OggS")) return "audio/ogg";
  if (at(0, "%PDF-")) return "application/pdf";
  if (/^(image|video|audio)\//i.test(declared) || /^(text\/html|image\/svg\+xml)$/i.test(declared)) return "application/octet-stream";
  return declared || "application/octet-stream";
}

export async function inspectFile(file: File): Promise<File> {
  const mime = detectedMime(new Uint8Array(await file.slice(0, 64).arrayBuffer()), file.type.toLowerCase());
  const name = attachmentName(file.name);
  return mime === file.type && name === file.name ? file : new File([file], name, { type: mime, lastModified: file.lastModified });
}

export function riskyAttachment(name: string): boolean {
  return /\.(apk|apks|xapk|exe|msi|bat|cmd|com|scr|ps1|vbs|js|jse|sh|bash|command|app|dmg|pkg|deb|rpm|jar|dll|lnk|reg|docm|xlsm|pptm|html?|svg)$/i.test(name);
}
