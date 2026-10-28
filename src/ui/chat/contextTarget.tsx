import { Copy, Download, ExternalLink, ImageDown, Link2 } from "lucide-react";
import type { MenuEntry } from "../components/Overlay";

/**
 * What a right-click (or long press) inside a message landed on, so Meldiq's own menu offers what the browser's used
 * to (2026-10-28: the owner wants no browser menu in the app): the photo, video or sound under the pointer (open,
 * download, copy the image), a link (open, copy), or the text selected (copy).
 */
export type ContextTarget =
  { kind: "media"; media: "image" | "video" | "audio"; url: string; name: string; element: HTMLElement } | { kind: "link"; href: string } | { kind: "selection"; text: string };

export function contextTarget(target: EventTarget | null): ContextTarget | null {
  const el = target as HTMLElement | null;
  if (!el?.closest) return null;
  const selection = typeof window !== "undefined" ? window.getSelection() : null;
  const selected = selection?.toString().trim();
  if (selected && selection?.containsNode(el, true)) return { kind: "selection", text: selected };
  const media = el.closest<HTMLImageElement | HTMLVideoElement | HTMLAudioElement>("img, video, audio") ?? el.querySelector<HTMLImageElement>(":scope > img");
  const url = media ? media.currentSrc || (media as HTMLImageElement).src : "";
  if (media && url) {
    const kind = media.tagName === "VIDEO" ? "video" : media.tagName === "AUDIO" ? "audio" : "image";
    const name = media.getAttribute("alt") || media.getAttribute("aria-label") || (kind === "image" ? "photo" : kind);
    // The element that opens it (a photo's button opens the viewer; a video or sound plays where it is).
    const opener = media.closest<HTMLElement>("button") ?? media;
    return { kind: "media", media: kind, url, name, element: opener };
  }
  const link = el.closest<HTMLAnchorElement>("a[href]");
  if (link && /^(https?:|mailto:)/.test(link.href)) return { kind: "link", href: link.href };
  return null;
}

/** Downloads [url] (a decrypted blob: URL or a same-origin file) as [name]. */
export function downloadUrl(url: string, name: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = name || "download";
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
}

/** Copies a picture to the clipboard as PNG (what clipboards accept everywhere); false where the browser can't. */
export async function copyImage(url: string): Promise<boolean> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false;
  try {
    const png = async () => {
      const blob = await (await fetch(url)).blob();
      if (blob.type === "image/png") return blob;
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
      return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no image"))), "image/png"));
    };
    // Safari wants the promise handed over straight away, inside the click.
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png() })]);
    return true;
  } catch {
    return false;
  }
}

/** The menu entries for [t], shown first in the menu; [notice] reports what happened. */
export function contextEntries(t: ContextTarget | null, notice: (text: string) => void): MenuEntry[] {
  if (!t) return [];
  if (t.kind === "selection") return [{ label: "Copy", icon: <Copy size={16} />, onSelect: () => void navigator.clipboard?.writeText(t.text).then(() => notice("Copied.")) }, "separator"];
  if (t.kind === "link")
    return [
      { label: "Open link", icon: <ExternalLink size={16} />, onSelect: () => void window.open(t.href, "_blank", "noopener,noreferrer") },
      { label: "Copy link", icon: <Link2 size={16} />, onSelect: () => void navigator.clipboard?.writeText(t.href).then(() => notice("Link copied.")) },
      "separator",
    ];
  const what = t.media === "image" ? "photo" : t.media;
  return [
    ...(t.media === "image" ? [{ label: "Open photo", icon: <ExternalLink size={16} />, onSelect: () => t.element.click() }] : []),
    { label: `Download ${what}`, icon: <Download size={16} />, onSelect: () => downloadUrl(t.url, t.name) },
    ...(t.media === "image"
      ? [
          {
            label: "Copy image",
            icon: <ImageDown size={16} />,
            onSelect: () => void copyImage(t.url).then((ok) => notice(ok ? "Image copied." : "This browser can't copy images. Download it instead.")),
          },
        ]
      : []),
    "separator",
  ];
}
