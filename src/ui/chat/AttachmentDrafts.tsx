import { FileText, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { riskyAttachment } from "../../sync/attachmentPolicy";
import { bytes } from "../format";

/** Object URLs preview selected files without copying their contents into JavaScript memory. */
export function AttachmentDrafts({ files, onRemove, disabled }: { files: File[]; onRemove: (index: number) => void; disabled: boolean }) {
  return (
    <div className="composer-files attachment-drafts" aria-label="Files to send">
      {files.map((file, index) => (
        <Draft key={`${file.name}:${file.size}:${file.lastModified}:${index}`} file={file} disabled={disabled} onRemove={() => onRemove(index)} />
      ))}
    </div>
  );
}

function Draft({ file, onRemove, disabled }: { file: File; onRemove: () => void; disabled: boolean }) {
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
              aria-label={`Preview ${file.name}`}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onError={() => setFailed(true)}
            />
          )
        ) : (
          <FileText size={28} aria-hidden="true" />
        )}
        <button className="icon-btn" disabled={disabled} onClick={onRemove} aria-label={`Remove ${file.name}`}>
          <X size={15} />
        </button>
      </div>
      <figcaption>
        <strong className="ellipsis" title={file.name}>
          {file.name}
        </strong>
        <small>
          {bytes(file.size)}
          {duration !== null && Number.isFinite(duration) ? ` · ${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")}` : ""}
        </small>
        {failed && <small>Preview unavailable. The original can still be sent.</small>}
        {riskyAttachment(file.name) && (
          <small className="attachment-risk">
            <TriangleAlert size={12} /> Open only if you trust its sender.
          </small>
        )}
      </figcaption>
    </figure>
  );
}
