import { Activity, CheckCircle2, CircleAlert, CircleDashed, CircleHelp, Download, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useEngine } from "../../application/orbit";
import type { AiOverview } from "../../sync/aiWorkforce";
import { CHECK_STATUSES, type CheckItem, type CheckReport, type CheckStatus, LEVEL_LABEL, reportFile, runSystemCheck, STATUS_LABEL, systemCheckReport, systemChecks } from "../../sync/systemCheck";
import { relative } from "../format";
import { Card, ErrorLine } from "../workspace/WorkspaceView";
import { useAction, useLoad } from "../workspace/useLoad";
import { JobView } from "./JobView";

/**
 * Community › AI agents › Health: Run Full System Check (server src/modules/workforce/health). One action checks every
 * agent, the models they need, triggers, the queue, failures, people's tasks and approvals, and runs safe smoke tests;
 * the report says what needs attention first, with the evidence, what to do and who can do it. Nothing here calls the
 * AI model, sends or publishes.
 */
const ATTENTION: readonly CheckStatus[] = ["failed", "warning", "not_configured"];
const PILL: Record<CheckStatus, string> = { healthy: "ok", warning: "warn", failed: "danger", not_configured: "muted", not_tested: "muted" };

function Glyph({ status }: { status: CheckStatus }) {
  const Icon = status === "healthy" ? CheckCircle2 : status === "failed" ? CircleAlert : status === "warning" ? TriangleAlert : status === "not_tested" ? CircleHelp : CircleDashed;
  return (
    <span className={`glyph check-${status}`} aria-hidden="true">
      <Icon size={16} />
    </span>
  );
}

function ItemRow({ item, orgId, o }: { item: CheckItem; orgId: string; o: AiOverview }) {
  const [job, setJob] = useState<string | null>(null);
  const jobs = item.links.jobs ?? [];
  return (
    <li className={`ws-row check-row check-${item.status}`}>
      <Glyph status={item.status} />
      <span className="lines grow">
        <span>
          {item.title} <span className="check-level">{LEVEL_LABEL[item.level]}</span>
          {item.verified && <span className="check-level">tested</span>}
        </span>
        <small>{item.evidence}</small>
        {item.cause && <small>Why: {item.cause}</small>}
        {item.remediation && <small>What to do: {item.remediation}</small>}
        {item.remediation && item.owner && <small>Who can fix it: {item.owner === "platform_operator" ? "the platform's operators" : "people who manage agents here"}</small>}
        {item.impacts.length > 0 && item.status !== "healthy" && <small>Affects: {item.impacts.join(", ")}</small>}
        {item.links.tasks?.length ? <small>{item.links.tasks.length === 1 ? "1 task: see Tasks." : `${item.links.tasks.length} tasks: see Tasks.`}</small> : null}
        {jobs.length > 0 && (
          <span className="check-links">
            {jobs.map((id, i) => (
              <button key={id} className="link-button" aria-expanded={job === id} onClick={() => setJob(job === id ? null : id)}>
                {jobs.length === 1 ? "Open the request" : `Request ${i + 1}`}
              </button>
            ))}
          </span>
        )}
        {job && <JobView orgId={orgId} jobId={job} canApprove={o.permissions.canApprove} canManage={o.permissions.canManage} />}
      </span>
      <span className={`status-pill ${PILL[item.status]}`}>{STATUS_LABEL[item.status]}</span>
    </li>
  );
}

function Counts({ r }: { r: Pick<CheckReport, "summary"> }) {
  return (
    <span className="check-counts" aria-label="Results">
      {CHECK_STATUSES.map((s) =>
        r.summary[s] ? (
          <span key={s} className={`status-pill ${PILL[s]}`}>
            {r.summary[s]} {STATUS_LABEL[s].toLowerCase()}
          </span>
        ) : null,
      )}
    </span>
  );
}

function Report({ r, orgId, o }: { r: CheckReport; orgId: string; o: AiOverview }) {
  const attention = r.items.filter((i) => ATTENTION.includes(i.status));
  const untested = r.items.filter((i) => i.status === "not_tested");
  const healthy = r.items.filter((i) => i.status === "healthy");
  const save = () => {
    const f = reportFile(r);
    const url = URL.createObjectURL(new Blob([f.text], { type: "application/json" }));
    Object.assign(document.createElement("a"), { href: url, download: f.name }).click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  return (
    <Card
      title={attention.length ? `${attention.length === 1 ? "1 thing needs" : `${attention.length} things need`} attention` : "Everything checked is working"}
      sub={
        <>
          Checked {relative(r.startedAt)}, {r.items.length} checks. <Counts r={r} />
        </>
      }
      actions={
        <button className="btn btn-secondary" onClick={save}>
          <Download size={14} /> Export
        </button>
      }
    >
      {attention.length > 0 && (
        <ul className="ws-list check-list" aria-label="Needs attention">
          {attention.map((i) => (
            <ItemRow key={i.key} item={i} orgId={orgId} o={o} />
          ))}
        </ul>
      )}
      {untested.length > 0 && (
        <details className="check-group" open={attention.length === 0}>
          <summary>Not tested ({untested.length}): couldn't be proved safely, see why</summary>
          <ul className="ws-list check-list">
            {untested.map((i) => (
              <ItemRow key={i.key} item={i} orgId={orgId} o={o} />
            ))}
          </ul>
        </details>
      )}
      {healthy.length > 0 && (
        <details className="check-group">
          <summary>Healthy ({healthy.length})</summary>
          <ul className="ws-list check-list">
            {healthy.map((i) => (
              <ItemRow key={i.key} item={i} orgId={orgId} o={o} />
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

export function SystemCheckTab({ orgId, o }: { orgId: string; o: AiOverview }) {
  const engine = useEngine();
  const list = useLoad(() => systemChecks(engine, orgId), [engine, orgId]);
  const act = useAction();
  const [shown, setShown] = useState<CheckReport | null>(null);
  const report = shown ?? list.data?.latest ?? null;
  const run = () =>
    void act.act(async () => {
      setShown(await runSystemCheck(engine, orgId));
      list.reload();
    });
  const open = (id: string) => void act.act(async () => setShown(await systemCheckReport(engine, orgId, id)));
  return (
    <>
      <Card
        title="System check"
        sub="Checks every agent, the models they need, triggers, the queue, failures, people's tasks and approvals, and runs safe tests. It never asks the AI model, sends a message or publishes anything."
        actions={
          <button className="btn btn-primary" disabled={act.busy} onClick={run}>
            <Activity size={14} /> {act.busy ? "Checking…" : "Run full system check"}
          </button>
        }
      >
        <ErrorLine text={list.error ?? act.error} />
        {!list.data && !list.error && <div className="skeleton" style={{ height: 60 }} aria-busy="true" />}
        {list.data && !report && <p className="muted">No check has run here yet.</p>}
      </Card>
      {report && <Report r={report} orgId={orgId} o={o} />}
      {list.data && list.data.history.length > 1 && (
        <Card title="Earlier checks">
          <ul className="ws-list">
            {list.data.history.map((h) => (
              <li key={h.id} className="ws-row">
                <Glyph status={h.worst} />
                <span className="lines grow">
                  <span>{relative(h.startedAt)}</span>
                  <small>
                    <Counts r={h} />
                  </small>
                </span>
                <button className="btn btn-secondary" disabled={act.busy || report?.id === h.id} onClick={() => open(h.id)}>
                  {report?.id === h.id ? "Shown" : "Show"}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
