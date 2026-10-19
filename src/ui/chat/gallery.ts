import type { StoredMessage } from "../../model/types";
import type { AttachmentRef } from "../../protocol/payload";
import { isInlineImage, safeMime } from "../../sync/attachments";
import { isVoice } from "../../sync/voice";

export interface GalleryItem {
  ref: AttachmentRef;
  messageId: string;
  senderUserId: string;
  outgoing: boolean;
  at: number;
}

export interface Gallery {
  /** Photos and videos, shown as a grid. */
  media: GalleryItem[];
  /** Everything else that can be downloaded: documents, audio files, archives. Voice messages stay in the chat. */
  files: GalleryItem[];
}

/**
 * A conversation's attachments on this browser (android MediaGallery), newest first. Deleted messages and voice
 * messages are left out; each attachment appears once even if a message was edited.
 */
export function galleryOf(messages: readonly StoredMessage[]): Gallery {
  const seen = new Set<string>();
  const media: GalleryItem[] = [];
  const files: GalleryItem[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.deleted) continue;
    for (const ref of m.attachments) {
      if (seen.has(ref.id) || isVoice(ref)) continue;
      seen.add(ref.id);
      const item = { ref, messageId: m.id, senderUserId: m.senderUserId, outgoing: m.outgoing, at: m.sortTs };
      (isInlineImage(ref) || safeMime(ref.mime).startsWith("video/") ? media : files).push(item);
    }
  }
  return { media, files };
}
