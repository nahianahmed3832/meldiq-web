import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { useState } from "react";
import { Dialog } from "../components/Overlay";
import { dayLabel } from "../format";
import { FileAttachment, ImageAttachment, MediaAttachment } from "./Attachments";
import type { Gallery, GalleryItem } from "./gallery";
import { isInlineImage } from "../../sync/attachments";
import { GalleryMediaViewer } from "./GalleryMediaViewer";
import { BulkSaveBar, itemKey, useBulkSave } from "./BulkSaveBar";
/** Photos are decrypted as they're shown: a page at a time keeps a long history from downloading everything at once. */
const PAGE = 24;
type Tab = "media" | "files";
/**
 * A conversation's photos, videos and files on this browser (android MediaGallery). Everything is decrypted here, on
 * demand, through the same paths as the chat: nothing new is fetched or stored.
 */
export function MediaGalleryDialog({ gallery, nameOf, onClose }: { gallery: Gallery; nameOf: (item: GalleryItem) => string; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const [tab, setTab] = useState<Tab>(gallery.media.length || !gallery.files.length ? "media" : "files");
  const [shown, setShown] = useState(PAGE);
  const items = tab === "media" ? gallery.media : gallery.files;
  const bulk = useBulkSave();
  const all = [...gallery.media, ...gallery.files];
  /** In selection mode a file is ticked instead of opened (android round 7 bulk select). */
  const pick = (i: GalleryItem) =>
    bulk.selecting && (
      <label className="bulk-pick">
        <input
          type="checkbox"
          checked={bulk.selected.has(itemKey(i))}
          onChange={() => bulk.toggle(itemKey(i))}
          aria-label={uiText("messaging.interface.select_value0_b4b262a", { value0: i.ref.name })}
        />
      </label>
    );
  return (
    <GalleryMediaViewer items={gallery.media} nameOf={nameOf} selecting={bulk.selecting}>
      <Dialog title={uiText("messaging.interface.media_and_files_a36c682")} onClose={onClose} wide>
        <div className="dialog-body">
          {bulk.selecting ? (
            <BulkSaveBar all={all} bulk={bulk} />
          ) : (
            all.length > 1 && (
              <button className="btn btn-secondary btn-sm" style={{ justifySelf: "start" }} onClick={bulk.start}>
                <Localized k="messaging.interface.select_files_to_save_eb50da0" />
              </button>
            )
          )}
          <div className="segmented" role="tablist" aria-label={uiText("messaging.interface.show_0df6f1c")}>
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
                {t === "media"
                  ? uiText("messaging.interface.photos_and_videos_value0_3b48b2d", { value0: gallery.media.length })
                  : uiText("messaging.interface.files_value0_29b1e40", { value0: gallery.files.length })}
              </button>
            ))}
          </div>
          {items.length === 0 ? (
            <p className="faint" style={{ margin: 0 }}>
              {tab === "media" ? uiText("messaging.interface.no_photos_or_videos_in_this_conversation_yet_23579a2") : uiText("messaging.interface.no_files_in_this_conversation_yet_b209afa")}
            </p>
          ) : tab === "media" ? (
            <div className="gallery-grid" role="tabpanel" aria-label={uiText("messaging.interface.photos_and_videos_85f401e")}>
              {items.slice(0, shown).map((i) => (
                <figure
                  key={i.ref.id}
                  className={`gallery-cell${bulk.selecting ? " selecting" : ""}${bulk.selected.has(itemKey(i)) ? " picked" : ""}`}
                  onClick={bulk.selecting ? (e) => e.target === e.currentTarget.querySelector(".bulk-pick input") || bulk.toggle(itemKey(i)) : undefined}
                >
                  {pick(i)}
                  {isInlineImage(i.ref) ? <ImageAttachment r={i.ref} /> : <MediaAttachment r={i.ref} />}
                  <figcaption className="ellipsis">
                    {nameOf(i)} · {dayLabel(i.at)}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="gallery-files" role="tabpanel" aria-label={l10n("files.files")}>
              {items.slice(0, shown).map((i) => (
                <div
                  key={i.ref.id}
                  className={`gallery-file${bulk.selecting ? " selecting" : ""}${bulk.selected.has(itemKey(i)) ? " picked" : ""}`}
                  onClick={bulk.selecting ? (e) => e.target === e.currentTarget.querySelector(".bulk-pick input") || bulk.toggle(itemKey(i)) : undefined}
                >
                  {pick(i)}
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
              <Localized k="messaging.interface.show_more_2ff0ae2" slots={[items.length - shown]} />
            </button>
          )}
          <p className="faint" style={{ margin: 0, fontSize: 12 }}>
            <Localized k="messaging.interface.what_s_loaded_so_far_older_ones_appear_as_you_scroll_back_in_the_a31c38b" />
          </p>
        </div>
      </Dialog>
    </GalleryMediaViewer>
  );
}
