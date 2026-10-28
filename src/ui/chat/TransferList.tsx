import { FileUp, RotateCw, X } from "lucide-react";
import { useRef, useSyncExternalStore } from "react";
import { useEngine } from "../../application/orbit";
import { type Transfer, transfersOf } from "../../sync/transfers";

/**
 * The files on their way in this conversation (continuation brief v3 §2), above the message box: each file's phase
 * (encrypting, uploading) with bytes and a percentage, and Cancel, Resume (after a reload, with the file chosen again
 * if its encryption hadn't finished), Retry and Dismiss. The transfers belong to the app, not to this view, so leaving
 * and coming back shows them where they are.
 */
export function TransferList({ conversationId }: { conversationId: string }) {
  const engine = useEngine();
  const transfers = transfersOf(engine);
  const version = useRef(0);
  const list = useSyncExternalStore(
    (fn) =>
      transfers.subscribe(() => {
        version.current++;
        fn();
      }),
    () => version.current,
  );
  void list;
  const jobs = transfers.list(conversationId);
  if (jobs.length === 0) return null;
  return (
    <ul className="transfer-list" aria-label="Files being sent">
      {jobs.map((j) => (
        <TransferRow key={j.id} job={j} />
      ))}
    </ul>
  );
}

function TransferRow({ job }: { job: Transfer }) {
  const engine = useEngine();
  const transfers = transfersOf(engine);
  const pick = useRef<HTMLInputElement>(null);
  const current = job.files.find((f) => f.phase !== "done") ?? job.files[job.files.length - 1];
  const pct = current && current.total ? Math.floor((100 * current.done) / current.total) : 0;
  const what =
    job.status === "sent"
      ? "Sent"
      : job.status === "cancelled"
        ? "Cancelled"
        : job.status === "failed"
          ? (job.error ?? "Couldn't send")
          : job.status === "interrupted"
            ? (job.error ?? "Interrupted: continue where it stopped")
            : current?.phase === "encrypting"
              ? `Encrypting… ${pct}%`
              : current?.phase === "uploading"
                ? `Uploading… ${pct}% · ${mb(current.done)} of ${mb(current.total)}`
                : "Waiting…";
  const names = job.files.length === 1 ? job.files[0].name : `${job.files.length} files`;
  const needsFiles = job.files.some((f) => f.needsFile);
  return (
    <li className={`transfer-row ${job.status}`}>
      <FileUp size={16} aria-hidden="true" className="faint" />
      <span className="transfer-text">
        <strong className="ellipsis">{names}</strong>
        <small aria-live="polite">{what}</small>
        {job.status === "running" && <progress className="transfer-bar" max={100} value={pct} aria-label={`${names}: ${pct}%`} />}
      </span>
      {job.status === "running" && (
        <button className="icon-btn" onClick={() => transfers.cancel(job.id)} aria-label={`Cancel sending ${names}`} title="Cancel">
          <X size={16} />
        </button>
      )}
      {(job.status === "interrupted" || job.status === "failed") && (
        <>
          <input
            ref={pick}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              const chosen = [...(e.target.files ?? [])].map((f) => ({ name: f.name, type: f.type, size: f.size, lastModified: f.lastModified, source: f }));
              transfers.resume(job.id, chosen);
              e.target.value = "";
            }}
          />
          <button className="btn btn-secondary btn-sm" onClick={() => (needsFiles ? pick.current?.click() : transfers.resume(job.id))}>
            <RotateCw size={14} /> {needsFiles ? "Choose file…" : job.status === "failed" ? "Retry" : "Resume"}
          </button>
          <button className="icon-btn" onClick={() => transfers.cancel(job.id)} aria-label={`Discard ${names}`} title="Discard">
            <X size={16} />
          </button>
        </>
      )}
      {job.status === "cancelled" && (
        <button className="icon-btn" onClick={() => transfers.dismiss(job.id)} aria-label="Dismiss" title="Dismiss">
          <X size={16} />
        </button>
      )}
    </li>
  );
}

const mb = (n: number) => (n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);
