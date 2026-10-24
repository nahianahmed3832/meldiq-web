import { CheckCircle2, CircleAlert, CircleDashed, FlaskConical } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { type Activity, agentActivity, agentReadiness, type Readiness, testAgent } from "../../sync/aiWorkforce";
import { relative } from "../format";
import { Card, ErrorLine } from "../workspace/WorkspaceView";
import { useAction, useLoad } from "../workspace/useLoad";
import { JobView } from "./JobView";

/**
 * An agent's health (server docs/AI_WORKFORCE.md §5b): its readiness checks as the server computes them (a check is
 * "ok" only when a job would pass it), a real test request, and what it did lately. Nothing here is decorative:
 * unavailable figures say so instead of showing zero.
 */
export function useReadiness(orgId: string, installId: string) {
  const engine = useEngine();
  const rev = useOrbit((s) => s.aiJobsRev);
  return useLoad(() => agentReadiness(engine, orgId, installId), [engine, orgId, installId, rev]);
}

export function ReadinessPill({ r }: { r: Readiness | null }) {
  if (!r) return null;
  const missing = r.checks.filter((c) => c.status === "missing").length;
  return r.ready ? <span className="status-pill ok">Ready</span> : <span className="status-pill warn">{missing === 1 ? "1 thing missing" : `${missing} things missing`}</span>;
}

/** The checks, or only those whose key starts with one of [only] (e.g. "model." for the Models step). */
export function ReadinessList({ r, only }: { r: Readiness; only?: string[] }) {
  const checks = only ? r.checks.filter((c) => only.some((p) => c.key.startsWith(p))) : r.checks;
  if (checks.length === 0) return <p className="muted">Nothing to check here for this agent.</p>;
  return (
    <ul className="ws-list readiness-list">
      {checks.map((c) => (
        <li key={c.key} className={`ws-row readiness-${c.status}`}>
          <span className="glyph" aria-hidden="true">
            {c.status === "ok" ? <CheckCircle2 size={16} /> : c.status === "missing" ? <CircleAlert size={16} /> : <CircleDashed size={16} />}
          </span>
          <span className="lines grow">
            <span>{c.label}</span>
            <small>
              {c.detail}
              {c.fixBy === "operator" && " · A platform operator fixes this in the AI Control Center."}
              {c.fixBy === "community" && " · This community's admins fix this here."}
            </small>
          </span>
          <span className="sr-only">{c.status === "ok" ? "OK" : c.status === "missing" ? "Missing" : "Advice"}</span>
        </li>
      ))}
    </ul>
  );
}

const ms = (n: number | null) => (n === null ? "no finished request this week" : n < 1000 ? `${n} ms` : `${(n / 1000).toFixed(1)} s`);

function ActivityView({ a }: { a: Activity }) {
  return (
    <dl className="agent-activity">
      <div>
        <dt>Now</dt>
        <dd>
          {a.now.running} running · {a.now.queued} queued · {a.now.waiting} waiting for people
        </dd>
      </div>
      <div>
        <dt>Last 7 days</dt>
        <dd>
          {a.week.completed} completed · {a.week.failed} failed · {a.week.cancelled} cancelled · {a.week.retries} retries · typical time {ms(a.week.averageMs)}
        </dd>
      </div>
      <div>
        <dt>Last success</dt>
        <dd>{a.lastSuccessAt ? relative(a.lastSuccessAt) : "None yet"}</dd>
      </div>
      <div>
        <dt>Last failure</dt>
        <dd>{a.lastFailure ? `${relative(a.lastFailure.at)}: ${a.lastFailure.message}` : "None"}</dd>
      </div>
      <div>
        <dt>Next run on its own</dt>
        <dd>{a.nextRunAt ? new Date(a.nextRunAt).toLocaleString() : "None: it isn't continuous, or no schedule is on"}</dd>
      </div>
    </dl>
  );
}

/** Step "Test and activate": every check, a real test request, and recent activity. */
export function TestStep({
  orgId,
  installId,
  canManage,
  canApprove,
  readiness,
}: {
  orgId: string;
  installId: string;
  canManage: boolean;
  canApprove: boolean;
  readiness: ReturnType<typeof useReadiness>;
}) {
  const engine = useEngine();
  const rev = useOrbit((s) => s.aiJobsRev);
  const activity = useLoad(() => agentActivity(engine, orgId, installId), [engine, orgId, installId, rev]);
  const act = useAction();
  const [job, setJob] = useState<string | null>(null);
  return (
    <>
      <Card title="Readiness" sub="Checked by the server against the rules its requests run under." actions={<ReadinessPill r={readiness.data ?? null} />}>
        <ErrorLine text={readiness.error} />
        {readiness.data ? <ReadinessList r={readiness.data} /> : <div className="skeleton" style={{ height: 80 }} aria-busy="true" />}
      </Card>
      {canManage && (
        <Card title="Test" sub="Sends one real short request through the normal path (model, quotas, its skill). It uses the platform's AI like any request.">
          <ErrorLine text={act.error} />
          <button className="btn btn-primary" style={{ justifySelf: "start" }} disabled={act.busy} onClick={() => void act.act(async () => setJob((await testAgent(engine, orgId, installId)).id))}>
            <FlaskConical size={14} /> {act.busy ? "Sending…" : "Test this agent"}
          </button>
          {job && (
            <div className="card">
              <JobView orgId={orgId} jobId={job} canApprove={canApprove} />
            </div>
          )}
        </Card>
      )}
      <Card title="Activity" sub="Counts from its request records, never their content.">
        <ErrorLine text={activity.error} />
        {activity.data ? <ActivityView a={activity.data} /> : <div className="skeleton" style={{ height: 80 }} aria-busy="true" />}
      </Card>
    </>
  );
}
