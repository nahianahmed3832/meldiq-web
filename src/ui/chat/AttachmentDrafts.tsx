import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { FileText, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { riskyAttachment } from "../../sync/attachmentPolicy";
import { bytes } from "../format";
/** Object URLs preview selected files without copying their contents into JavaScript memory. */
export function AttachmentDrafts({ files, onRemove, disabled }: { files: File[]; onRemove: (index: number) => void; disabled: boolean }) {
  useLocaleRender();
  return (
    <div className="composer-files attachment-drafts" aria-label={uiText("messaging.interface.files_to_send_d302111")}>
      {files.map((file, index) => (
        <Draft key={`${file.name}:${file.size}:${file.lastModified}:${index}`} file={file} disabled={disabled} onRemove={() => onRemove(index)} />
      ))}
    </div>
  );
}
function Draft({ file, onRemove, disabled }: { file: File; onRemove: () => void; disabled: boolean }) {
  useLocaleRender();
  const image = /^image\/(jpeg|png|gif|webp|avif|heic|heif|bmp)$/.test(file.type);
  const video = /^video\/(mp4|webm|quicktime)$/.test(file.type);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  useEffect(() => {
    if (!image && !video) return;
    const object = URL.createObjectURL(file);
    setUrl(object);
    return () => URL.revokeObjectURL(object);
  }, [file, image, video]);
  return (
    <figure className="attachment-draft">
      <div className="attachment-draft-preview">
        {url && !failed ? (
          image ? (
            <img src={url} alt={file.name} onError={() => setFailed(true)} />
          ) : (
            <video
              src={url}
              controls
              playsInline
              preload="metadata"
              aria-label={uiText("messaging.interface.preview_value0_fd65470", { value0: file.name })}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onError={() => setFailed(true)}
            />
          )
        ) : (
          <FileText size={28} aria-hidden="true" />
        )}
        <button className="icon-btn" disabled={disabled} onClick={onRemove} aria-label={uiText("messaging.interface.remove_value0_3028bf7", { value0: file.name })}>
          <X size={15} />
        </button>
      </div>
      <figcaption>
        <strong className="ellipsis" title={file.name}>
          {file.name}
        </strong>
        <small>
          {bytes(file.size)}
          {duration !== null && Number.isFinite(duration)
            ? uiText("messaging.interface.value0_value1_72cd66c", { value0: Math.floor(duration / 60), value1: String(Math.floor(duration % 60)).padStart(2, "0") })
            : ""}
        </small>
        {failed && (
          <small>
            <Localized k="messaging.interface.preview_unavailable_the_original_can_still_be_sent_b6bdbd0" />
          </small>
        )}
        {riskyAttachment(file.name) && (
          <small className="attachment-risk">
            <Localized k="messaging.interface.open_only_if_you_trust_its_sender_b205d5c" slots={[<TriangleAlert size={12} />]} />
          </small>
        )}
      </figcaption>
    </figure>
  );
}
