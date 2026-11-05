import { text as uiText } from "../i18n";
import { fitWithin } from "./photoQuality";
export const PREVIEW_MAX_BYTES = 128 * 1024;
export interface LocalMediaPreview {
  file: File;
  w: number;
  h: number;
  durationMs?: number;
}
/** A small, separate derivative. Originals are never changed, and no plaintext is sent to a processing service. */
export async function mediaPreview(source: Blob, name: string, signal?: AbortSignal): Promise<LocalMediaPreview | null> {
  if (!/^(image\/(jpeg|png|webp|avif|heic|heif|bmp)|video\/(mp4|webm|quicktime))$/.test(source.type)) return null;
  if (source.type.startsWith("image/") && source.size > 32 * 1024 * 1024) return null;
  signal?.throwIfAborted();
  let bitmap: ImageBitmap | null = null;
  let video: HTMLVideoElement | null = null;
  let url: string | null = null;
  try {
    let w: number, h: number, durationMs: number | undefined;
    if (source.type.startsWith("image/")) {
      bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
      w = bitmap.width;
      h = bitmap.height;
    } else {
      video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      url = URL.createObjectURL(source);
      await new Promise<void>((resolve, reject) => {
        const finish = (error?: Error) => {
          clearTimeout(timer);
          signal?.removeEventListener("abort", abort);
          video!.onloadeddata = null;
          video!.onerror = null;
          if (error) reject(error);
          else resolve();
        };
        const abort = () => finish(new DOMException("Cancelled", "AbortError"));
        const timer = setTimeout(() => finish(new Error(uiText("files.interface.preview_unavailable_b99fa6c"))), 8000);
        signal?.addEventListener("abort", abort, { once: true });
        video!.onloadeddata = () => finish();
        video!.onerror = () => finish(new Error(uiText("files.interface.this_browser_cannot_decode_the_video_c5eff00")));
        video!.src = url!;
      });
      w = video.videoWidth;
      h = video.videoHeight;
      if (Number.isFinite(video.duration)) durationMs = Math.round(video.duration * 1000);
    }
    signal?.throwIfAborted();
    if (!w || !h || w > 32768 || h > 32768 || w * h > 64000000) return null;
    const size = fitWithin(w, h, 480);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap ?? video!, 0, 0, size.width, size.height);
    const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.75));
    const usable = (blob: Blob | null): blob is Blob => !!blob && blob.size > 0 && blob.size <= PREVIEW_MAX_BYTES && ["image/webp", "image/png", "image/jpeg"].includes(blob.type);
    let blob = await encode("image/webp");
    signal?.throwIfAborted();
    // Video frames are opaque. JPEG can produce a small poster on browsers that cannot encode WebP.
    if (!usable(blob) && video) blob = await encode("image/jpeg");
    signal?.throwIfAborted();
    if (!usable(blob) || (bitmap && blob.size >= source.size)) return null;
    const ext = blob.type === "image/jpeg" ? "jpg" : blob.type.slice("image/".length);
    return { file: new File([blob], `${name.replace(/\.[^.]*$/, "")}-preview.${ext}`, { type: blob.type }), w, h, durationMs };
  } catch (e) {
    if (signal?.aborted) throw e;
    return null; // An unavailable decoder never prevents sharing the original.
  } finally {
    bitmap?.close();
    if (video) {
      video.removeAttribute("src");
      video.load();
    }
    if (url) URL.revokeObjectURL(url);
  }
}
