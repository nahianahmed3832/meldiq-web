import { useState } from "react";
import { Dialog } from "../components/Overlay";
import { dayLabel } from "../format";
import { FileAttachment, ImageAttachment, MediaAttachment } from "./Attachments";
import type { Gallery, GalleryItem } from "./gallery";
import { isInlineImage } from "../../sync/attachments";

/** Photos are decrypted as they're shown: a page at a time keeps a long history from downloading everything at once. */
const PAGE = 24;

type Tab = "media" | "files";

/**
 * A conversation's photos, videos and files on this browser (android MediaGallery). Everything is decrypted here, on
 * demand, through the same paths as the chat: nothing new is fetched or stored.
 */
export function MediaGalleryDialog({ gallery, nameOf, onClose }: { gallery: Gallery; nameOf: (item: GalleryItem) => string; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>(gallery.media.length || !gallery.files.length ? "media" : "files");
  const [shown, setShown] = useState(PAGE);
  const items = tab === "media" ? gallery.media : gallery.files;
  return (
    <Dialog title="Media and files" onClose={onClose} wide>
      <div className="dialog-body">
        <div className="segmented" role="tablist" aria-label="Show">
          {(["media", "files"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setShown(PAGE);
              }}
            >
              {t === "media" ? `Photos and videos (${gallery.media.length})` : `Files (${gallery.files.length})`}
            </button>
          ))}
        </div>
        {items.length === 0 ? (
          <p className="faint" style={{ margin: 0 }}>
            {tab === "media" ? "No photos or videos in this conversation on this browser yet." : "No files in this conversation on this browser yet."}
          </p>
        ) : tab === "media" ? (
          <div className="gallery-grid" role="tabpanel" aria-label="Photos and videos">
            {items.slice(0, shown).map((i) => (
              <figure key={i.ref.id} className="gallery-cell">
                {isInlineImage(i.ref) ? <ImageAttachment r={i.ref} /> : <MediaAttachment r={i.ref} />}
                <figcaption className="ellipsis">
                  {nameOf(i)} · {dayLabel(i.at)}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="gallery-files" role="tabpanel" aria-label="Files">
            {items.slice(0, shown).map((i) => (
              <div key={i.ref.id} className="gallery-file">
                <FileAttachment r={i.ref} />
                <small className="faint">
                  {nameOf(i)} · {dayLabel(i.at)}
                </small>
              </div>
            ))}
          </div>
        )}
        {items.length > shown && (
          <button className="btn btn-secondary btn-sm" style={{ justifySelf: "center" }} onClick={() => setShown((n) => n + PAGE)}>
            Show more ({items.length - shown})
          </button>
        )}
        <p className="faint" style={{ margin: 0, fontSize: 12 }}>
          What this browser has received or restored. Older history appears as you scroll back in the conversation.
        </p>
      </div>
    </Dialog>
  );
}
