import { formatNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
  useLocaleRender();
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
    <ul className="transfer-list" aria-label={uiText("messaging.interface.files_being_sent_51e74ad")}>
      {jobs.map((j) => (
        <TransferRow key={j.id} job={j} />
      ))}
    </ul>
  );
}
function TransferRow({ job }: { job: Transfer }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const transfers = transfersOf(engine);
  const pick = useRef<HTMLInputElement>(null);
  const current = job.files.find((f) => f.phase !== "done") ?? job.files[job.files.length - 1];
  const pct = current && current.total ? Math.floor((100 * current.done) / current.total) : 0;
  const total = job.files.reduce((sum, f) => sum + f.size, 0);
  const uploaded = job.files.reduce((sum, f) => sum + (f.phase === "done" || f.originalUploaded ? f.size : f.phase === "uploading" && f.total ? f.size * Math.min(1, f.done / f.total) : 0), 0);
  const overall = total ? Math.floor((100 * uploaded) / total) : 0;
  const what =
    job.status === "sent"
      ? uiText("messaging.interface.ready_message_queued_b980b8c")
      : job.status === "cancelled"
        ? uiText("messaging.interface.cancelled_d353a99")
        : job.status === "failed"
          ? (job.error ?? uiText("messaging.interface.couldn_t_send_2dbe38e"))
          : job.status === "interrupted"
            ? (job.error ?? uiText("messaging.interface.interrupted_continue_where_it_stopped_5553d3a"))
            : current?.phase === "previewing"
              ? uiText("workspace.interface.preparing_preview_11e66e1")
              : current?.phase === "encrypting"
                ? uiText("messaging.interface.encrypting_value0_f49356e", { value0: pct })
                : current?.phase === "uploading"
                  ? uiText("messaging.interface.uploading_value0_value1_of_value2_19c4172", { value0: pct, value1: mb(current.done), value2: mb(current.total) })
                  : uiText("messaging.interface.waiting_612ffc5");
  const names = job.files.length === 1 ? job.files[0].name : uiText("files.counts.files", { count: job.files.length });
  const needsFiles = job.files.some((f) => f.needsFile);
  return (
    <li className={`transfer-row ${job.status}`}>
      <FileUp size={16} aria-hidden="true" className="faint" />
      <span className="transfer-text">
        <strong className="ellipsis">{names}</strong>
        <small aria-live="polite">
          {what}
          {job.status === "running" && current?.phase === "uploading" && current.speedBps
            ? uiText("messaging.interface.value0_s_value1_ebab8d8", {
                value0: mb(current.speedBps),
                value1: current.remainingSeconds ? uiText("messaging.interface.about_s_left_ce60384", { value0: current.remainingSeconds }) : "",
              })
            : ""}
        </small>
        {job.status === "running" && (
          <progress className="transfer-bar" max={100} value={overall} aria-label={uiText("messaging.interface.overall_upload_value0_value1_aa37e0c", { value0: names, value1: overall })} />
        )}
        {job.files.length > 1 && (
          <details className="transfer-files">
            <summary>
              <Localized k="messaging.interface.of_uploaded_overall_f1670df" slots={[job.files.filter((f) => f.phase === "done").length, job.files.length, overall]} />
            </summary>
            <ul>
              {job.files.map((f, i) => (
                <li key={i}>
                  <span className="ellipsis">{f.name}</span>
                  <small>
                    {f.phase === "done"
                      ? uiText("messaging.interface.ready_5fa7aac")
                      : f.phase === "failed"
                        ? uiText("messaging.interface.failed_031a8f0")
                        : f.phase === "cancelled"
                          ? uiText("messaging.interface.cancelled_d353a99")
                          : f.phase === "previewing"
                            ? uiText("messaging.interface.preparing_preview_2158038")
                            : f.phase === "waiting"
                              ? uiText("messaging.interface.queued_661ff40")
                              : uiText("messaging.interface.value0_value1_0c6a80e", {
                                  value0: f.phase === "encrypting" ? uiText("messaging.interface.encrypting_3ecd5a5") : uiText("messaging.interface.uploading_de27240"),
                                  value1: f.total ? Math.floor((100 * f.done) / f.total) : 0,
                                })}{" "}
                    · {mb(f.size)}
                  </small>
                </li>
              ))}
            </ul>
          </details>
        )}
      </span>
      {job.status === "running" && (
        <button
          className="icon-btn"
          onClick={() => transfers.cancel(job.id)}
          aria-label={uiText("messaging.interface.cancel_sending_value0_dd956bf", { value0: names })}
          title={l10n("common.actions.cancel")}
        >
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
            <RotateCw size={14} />{" "}
            {needsFiles ? uiText("messaging.interface.choose_file_5c66238") : job.status === "failed" ? uiText("messaging.interface.retry_942087c") : uiText("messaging.interface.resume_d640c74")}
          </button>
          <button
            className="icon-btn"
            onClick={() => transfers.cancel(job.id)}
            aria-label={uiText("messaging.interface.discard_value0_407de9d", { value0: names })}
            title={uiText("messaging.interface.discard_eb1a70e")}
          >
            <X size={16} />
          </button>
        </>
      )}
      {job.status === "cancelled" && (
        <button className="icon-btn" onClick={() => transfers.dismiss(job.id)} aria-label={uiText("calls.interface.dismiss_48845bf")} title={uiText("calls.interface.dismiss_48845bf")}>
          <X size={16} />
        </button>
      )}
    </li>
  );
}
const mb = (n: number) =>
  n >= 1024 * 1024
    ? uiText("files.interface.value0_mb_36c07a7", { value0: formatNumber(n / (1024 * 1024), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })
    : uiText("messaging.interface.value0_kb_b753642", { value0: Math.ceil(n / 1024) });
