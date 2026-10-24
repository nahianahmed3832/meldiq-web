import { Activity, Bot, CircleAlert, User } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { type AiOverview, JOB_STATE_LABEL, TASK_STATE_LABEL } from "../../sync/aiWorkforce";
import { STATUS_LABEL } from "../../sync/systemCheck";
import { ACTION_LABEL, formatCost, type WorkItem, workOverview } from "../../sync/work";
import { relative } from "../format";
import { Card, ErrorLine } from "../workspace/WorkspaceView";
import { useLoad } from "../workspace/useLoad";
import { JobView } from "./JobView";

/**
 * Community › AI agents › Overview (the work overview, server workCenter.ts): what needs this person first, then what
 * agents and people are doing, what finished and what failed, with what the agents' work cost. Every item opens its
 * record: a request opens here (with its approval or question), a task opens in Tasks.
 */
const stateLabel = (i: WorkItem) =>
  i.kind === "job" ? (JOB_STATE_LABEL[i.state as keyof typeof JOB_STATE_LABEL] ?? i.state) : (TASK_STATE_LABEL[i.state as keyof typeof TASK_STATE_LABEL] ?? i.state);

function Row({ item, o, orgId, openTask }: { item: WorkItem; o: AiOverview; orgId: string; openTask: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const Who = item.owner.kind === "agent" ? Bot : User;
  const facts = [
    stateLabel(item),
    item.owner.kind === "agent" ? `${item.owner.name} (AI)` : `for ${item.owner.name}`,
    `asked by ${item.requestedBy.name}`,
    relative(item.at),
    item.deliverables ? `${item.deliverables} file${item.deliverables === 1 ? "" : "s"}` : null,
    item.costMicro ? `${formatCost(item.costMicro)} est.` : null,
    item.error ? `last error: ${item.error}` : null,
  ].filter(Boolean);
  const go = () => (item.kind === "task" && item.taskId ? openTask(item.taskId) : setOpen(!open));
  return (
    <li className="ws-row work-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
      <div className="row">
        <span className="glyph" aria-hidden="true">
          <Who size={16} />
        </span>
        <span className="lines grow">
          <span>{item.title}</span>
          {item.reason && <small className="work-reason">{item.reason}</small>}
          <small>{facts.join(" · ")}</small>
        </span>
        <button className={item.action === "open" ? "btn btn-secondary" : "btn btn-primary"} aria-expanded={item.kind === "job" ? open : undefined} onClick={go}>
          {item.kind === "job" && open ? "Close" : ACTION_LABEL[item.action]}
        </button>
      </div>
      {open && item.jobId && <JobView orgId={orgId} jobId={item.jobId} canApprove={o.permissions.canApprove} canManage={o.permissions.canManage} />}
    </li>
  );
}

function Section({ title, empty, items, ...rest }: { title: string; empty: string; items: WorkItem[]; o: AiOverview; orgId: string; openTask: (id: string) => void }) {
  return (
    <Card title={title}>
      {items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="ws-list" aria-label={title}>
          {items.map((i) => (
            <Row key={`${i.kind}:${i.id}:${i.approvalId ?? ""}`} item={i} {...rest} />
          ))}
        </ul>
      )}
    </Card>
  );
}

export function WorkTab({ orgId, o, openTask, openHealth }: { orgId: string; o: AiOverview; openTask: (id: string) => void; openHealth: () => void }) {
  const engine = useEngine();
  const rev = useOrbit((s) => s.aiJobsRev);
  const work = useLoad(() => workOverview(engine, orgId), [engine, orgId, rev]);
  const w = work.data;
  if (!w) return work.error ? <ErrorLine text={work.error} /> : <div className="skeleton" style={{ height: 120 }} aria-busy="true" />;
  const props = { o, orgId, openTask };
  const t = w.totals;
  return (
    <>
      <div className="work-totals" role="group" aria-label="At a glance">
        <span>
          <strong>{t.attention}</strong> need you
        </span>
        <span>
          <strong>{t.active}</strong> in progress
        </span>
        <span>
          <strong>{t.finished}</strong> finished
        </span>
        <span>
          <strong>{t.failed}</strong> failed
        </span>
        <span>
          <strong>{formatCost(t.costMicro)}</strong> est. AI cost, {t.requests} request{t.requests === 1 ? "" : "s"}
        </span>
        <small className="muted">
          {w.scope === "all" ? "Everyone's work here" : "Your requests and tasks"}, last {w.days} days.
        </small>
      </div>
      {w.health && w.health.worst !== "healthy" && (
        <div className={`banner ${w.health.worst === "failed" ? "warn" : "info"}`} role="status">
          <CircleAlert size={16} aria-hidden="true" />
          <span className="grow">
            The last system check ({relative(w.health.at)}): {STATUS_LABEL[w.health.worst].toLowerCase()}
            {w.health.failed ? `, ${w.health.failed} failed` : ""}
            {w.health.warning ? `, ${w.health.warning} need attention` : ""}.
          </span>
          <button className="btn btn-secondary" onClick={openHealth}>
            <Activity size={14} /> Open Health
          </button>
        </div>
      )}
      <Section title="Needs you" empty="Nothing is waiting for you." items={w.attention} {...props} />
      <Section title="In progress" empty="Nothing is running right now." items={w.active} {...props} />
      {w.failed.length > 0 && <Section title="Failed" empty="" items={w.failed} {...props} />}
      <Section title="Finished" empty={`Nothing finished in the last ${w.days} days.`} items={w.finished} {...props} />
    </>
  );
}
