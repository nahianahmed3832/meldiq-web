import { RotateCw, X } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useEngine } from "../../application/orbit";
import { useT } from "../../i18n";
import { type Transfer, transfersOf } from "../../sync/transfers";
import { Icon } from "../icons/Icon";
import { bytes } from "../format";

export function TransferList({ conversationId, threadRoot }: { conversationId: string; threadRoot?: string }) {
  const t = useT();
  const transfers = transfersOf(useEngine());
  const version = useRef(0);
  useSyncExternalStore(
    (fn) =>
      transfers.subscribe(() => {
        version.current++;
        fn();
      }),
    () => version.current,
  );

  const jobs = transfers.list(conversationId).filter((job) => job.threadRoot === threadRoot && job.status !== "sent" && job.status !== "cancelled");
  return (
    <ul className="transfer-list" aria-label={t("messaging.interface.files_being_sent_51e74ad")} aria-live="off">
      {jobs.map((job) => (
        <TransferRow key={job.id} job={job} />
      ))}
    </ul>
  );
}

function TransferRow({ job }: { job: Transfer }) {
  const t = useT();
  const transfers = transfersOf(useEngine());
  const pick = useRef<HTMLInputElement>(null);
  const preview = transfers.preview(job.id);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!preview) return;
    const objectUrl = URL.createObjectURL(preview);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [preview]);

  const running = job.status === "running";
  const hasUploads = job.files.some((file) => file.phase === "uploading" && !file.originalUploaded);
  const total = job.files.reduce((sum, file) => sum + file.size, 0);
  const uploaded = job.files.reduce((sum, file) => {
    if (file.originalUploaded || file.phase === "done" || file.phase === "verifying") return sum + file.size;
    if (file.phase === "uploading" && file.total) return sum + file.size * Math.min(1, file.done / file.total);
    return sum;
  }, 0);
  const percent = Math.floor((100 * uploaded) / Math.max(1, total));
  const names = job.files.length === 1 ? job.files[0].name : t("files.counts.files", { count: job.files.length });
  const needsFile = job.files.some((file) => file.needsFile);
  const busyLabel = job.publishing
    ? t("messaging.interface.sending_e595f17")
    : hasUploads
      ? t("messaging.uploads.progress", { sent: bytes(uploaded), total: bytes(total), percent })
      : percent === 100
        ? t("messaging.interface.sending_e595f17")
        : t("messaging.uploads.preparing");
  const status = running ? busyLabel : (job.error ?? t(job.status === "failed" ? "messaging.interface.couldn_t_send_2dbe38e" : "messaging.interface.interrupted_continue_where_it_stopped_5553d3a"));
  const cancelLabel = t("messaging.interface.cancel_sending_value0_dd956bf", { value0: names });

  return (
    <li className={`transfer-row ${job.status}`}>
      <div className="transfer-art">
        {preview && url ? <img src={url} alt="" /> : <Icon name="files.upload" size={20} />}
        {running && (
          <div className={`transfer-ring${hasUploads || job.publishing ? "" : " preparing"}`} style={{ "--uploaded": `${percent}%` } as CSSProperties}>
            {job.publishing ? (
              <span aria-hidden="true" />
            ) : (
              <button className="transfer-cancel" type="button" aria-label={cancelLabel} title={cancelLabel} onClick={() => transfers.cancel(job.id)}>
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="transfer-text">
        <strong className="ellipsis" dir="auto" title={names}>
          {names}
        </strong>
        {job.caption && (
          <span className="transfer-caption" dir="auto">
            {job.caption}
          </span>
        )}
        <small role={running ? undefined : "status"}>{status}</small>
        {hasUploads && running && (
          <progress className="sr-only" value={percent} max={100} aria-label={t("messaging.interface.overall_upload_value0_value1_aa37e0c", { value0: names, value1: percent })} />
        )}
        {job.files.length > 1 && (
          <ul className="transfer-files">
            {job.files.map((file, i) => (
              <li key={i} className="ellipsis" dir="auto">
                {file.name}
              </li>
            ))}
          </ul>
        )}
        {!running && (
          <div className="transfer-actions">
            <input
              ref={pick}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                const files = [...(e.target.files ?? [])].map((f) => ({ name: f.name, type: f.type, size: f.size, lastModified: f.lastModified, source: f }));
                if (files.length) transfers.resume(job.id, files);
                e.target.value = "";
              }}
            />
            <button className="btn btn-secondary btn-sm" onClick={() => (needsFile ? pick.current?.click() : transfers.resume(job.id))}>
              <RotateCw size={16} aria-hidden="true" />{" "}
              {t(needsFile ? "messaging.interface.choose_file_5c66238" : job.status === "failed" ? "messaging.interface.retry_942087c" : "messaging.interface.resume_d640c74")}
            </button>
            <button className="icon-btn" onClick={() => transfers.cancel(job.id)} aria-label={t("messaging.interface.discard_value0_407de9d", { value0: names })}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
