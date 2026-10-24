import { Check, MessageSquareReply, RotateCcw, Square, X } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { ACTIVE_STATES, answerJob, cancelJob, decide, JOB_STATE_LABEL, type JobDetail, jobDetail, retryJob, reviseJob } from "../../sync/aiWorkforce";
import { relative } from "../format";
import { useAction, useLoad } from "../workspace/useLoad";
import { AgentFileView } from "./AgentBits";

const TONE: Record<string, string> = { completed: "ok", failed: "danger", cancelled: "muted", awaiting_approval: "warn", awaiting_input: "warn" };

/**
 * One request to an agent: where it is, its delegated steps, its files, and what it waits for. Who asked can cancel,
 * retry, answer and ask for changes; approvals go to people with "Approve AI agent actions" (and to who asked, for a
 * final export of their own request). Updates live (frame ai.job).
 */
export function JobView({ orgId, jobId, canApprove, canManage = false }: { orgId: string; jobId: string; canApprove: boolean; canManage?: boolean }) {
  const engine = useEngine();
  const me = useOrbit((s) => s.me?.userId ?? null);
  const rev = useOrbit((s) => s.aiJobsRev);
  const loaded = useLoad(() => jobDetail(engine, orgId, jobId), [engine, orgId, jobId, rev]);
  const act = useAction();
  const [note, setNote] = useState("");
  const [answer, setAnswer] = useState("");
  const j: JobDetail | null = loaded.data;
  if (!j) return loaded.error ? <div className="banner danger">{loaded.error}</div> : <div className="skeleton" style={{ height: 160 }} aria-busy="true" />;
  const mine = j.requestedBy === me;
  const pending = j.approvals.find((a) => a.state === "pending");
  const maySteer = mine || canManage;
  const mayApprove = canApprove || mine;
  const run = (fn: () => Promise<unknown>) =>
    void act.act(async () => {
      await fn();
      loaded.reload();
    });
  const visible = j.files.filter((f) => f.role === "artifact" && f.approvalState !== "superseded");
  const older = j.files.filter((f) => f.role === "artifact" && f.approvalState === "superseded");
  return (
    <div className="agent-job">
      <div className="row" style={{ gap: 8 }}>
        <strong className="grow">{j.agent.displayName}</strong>
        <span className={`status-pill ${TONE[j.state] ?? ""}`}>{JOB_STATE_LABEL[j.state]}</span>
        <span className="faint">{relative(j.createdAt)}</span>
      </div>
      {ACTIVE_STATES.has(j.state) && j.state !== "awaiting_approval" && j.state !== "awaiting_input" && (
        <div className="agent-progress" role="progressbar" aria-valuenow={j.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
          <span style={{ width: `${Math.max(4, j.progress)}%` }} />
        </div>
      )}
      {j.note && (
        <p className="muted" style={{ margin: 0 }}>
          {j.note}
        </p>
      )}
      {j.sharedMessages > 0 && (
        <p className="faint" style={{ margin: 0 }}>
          {j.sharedMessages === 1 ? "1 channel message was" : `${j.sharedMessages} channel messages were`} shared with this request (not end-to-end encrypted, kept for 7 days).
        </p>
      )}
      {j.error && j.state !== "completed" && <div className="banner danger">{j.error.message}</div>}
      {j.steps.length > 0 && (
        <ul className="ws-list">
          {j.steps.map((s) => (
            <li key={s.id} className="ws-row">
              <span className="grow">{s.agent.displayName}</span>
              <span className={`status-pill ${TONE[s.state] ?? ""}`}>{JOB_STATE_LABEL[s.state]}</span>
            </li>
          ))}
        </ul>
      )}
      {visible.map((f) => (
        <AgentFileView key={f.id} orgId={orgId} file={f} autoPreview={f.kind === "preview" || f.kind === "final" || f.kind === "image"} />
      ))}
      {older.length > 0 && (
        <details>
          <summary className="faint">
            {older.length} earlier version{older.length === 1 ? "" : "s"}
          </summary>
          {older.map((f) => (
            <AgentFileView key={f.id} orgId={orgId} file={f} />
          ))}
        </details>
      )}
      {j.state === "awaiting_approval" && pending && (
        <div className="card agent-approval">
          <p style={{ margin: 0 }}>
            <strong>Approval needed:</strong> {pending.summary}
          </p>
          {mayApprove ? (
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-primary" disabled={act.busy} onClick={() => run(() => decide(engine, orgId, pending.id, "approved"))}>
                <Check size={15} /> Approve this version
              </button>
              <button className="btn btn-secondary" disabled={act.busy} onClick={() => run(() => decide(engine, orgId, pending.id, "rejected"))}>
                <X size={15} /> Reject
              </button>
            </div>
          ) : (
            <p className="faint">Someone with "Approve AI agent actions" decides.</p>
          )}
          {maySteer && (
            <div className="row" style={{ gap: 8 }}>
              <input className="grow" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Or ask for changes…" maxLength={2000} />
              <button
                className="btn btn-secondary"
                disabled={act.busy || !note.trim()}
                onClick={() =>
                  run(async () => {
                    await reviseJob(engine, orgId, j.id, note.trim());
                    setNote("");
                  })
                }
              >
                <MessageSquareReply size={15} /> Request changes
              </button>
            </div>
          )}
        </div>
      )}
      {j.state === "awaiting_input" && maySteer && (
        <div className="card agent-approval">
          <p style={{ margin: 0 }}>{j.note}</p>
          <div className="row" style={{ gap: 8 }}>
            <input className="grow" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer" maxLength={4000} />
            <button className="btn btn-primary" disabled={act.busy || !answer.trim()} onClick={() => run(() => answerJob(engine, orgId, j.id, answer.trim()))}>
              Answer
            </button>
          </div>
        </div>
      )}
      {maySteer && (
        <div className="row" style={{ gap: 8 }}>
          {ACTIVE_STATES.has(j.state) && (
            <button className="btn btn-sm btn-secondary" disabled={act.busy} onClick={() => run(() => cancelJob(engine, orgId, j.id))}>
              <Square size={13} /> Cancel
            </button>
          )}
          {(j.state === "failed" || j.state === "cancelled") && !j.parentJobId && (
            <button className="btn btn-sm btn-secondary" disabled={act.busy} onClick={() => run(() => retryJob(engine, orgId, j.id))}>
              <RotateCcw size={13} /> Try again
            </button>
          )}
        </div>
      )}
      {act.error && <div className="banner danger">{act.error}</div>}
    </div>
  );
}
