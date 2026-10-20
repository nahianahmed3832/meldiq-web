import { CheckCircle2, RotateCw } from "lucide-react";
import { useState } from "react";
import { useEngine } from "../../app/orbit";
import { ageText, busyRoutes, type Health, serviceHealth } from "../../sync/ops";
import { bytes } from "../format";
import { useLoad } from "../workspace/useLoad";

type Measured = { available: true } | { available: false; reason: string };
const measured = <T extends Measured>(m: T, describe: (v: Extract<T, { available: true }>) => string): string =>
  m.available ? describe(m as Extract<T, { available: true }>) : `not measured: ${(m as { reason: string }).reason}`;

/**
 * Settings › Service health (android round 7 C1 ServiceHealthScreen), for platform administrators only: what the
 * server measures about itself, with "not measured" instead of invented numbers. Fetched on open and on Refresh.
 */
export function ServiceHealthPage() {
  const engine = useEngine();
  const [tick, setTick] = useState(0);
  const health = useLoad(() => serviceHealth(engine), [engine, tick]);
  const h = health.data;
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Service health</h1>
        <button className="btn btn-secondary btn-sm" onClick={() => setTick((t) => t + 1)} disabled={health.loading}>
          <RotateCw size={14} /> Refresh
        </button>
      </div>
      {health.error && (
        <div className="banner danger" role="alert">
          {health.error}
        </div>
      )}
      {!h ? !health.error && <div className="skeleton" style={{ height: 160, borderRadius: 16 }} aria-busy="true" /> : <Report h={h} />}
    </>
  );
}

function Report({ h }: { h: Health }) {
  const w = h.metrics.window;
  const busy = busyRoutes(h);
  return (
    <>
      <div className="card health-summary">
        <small className="faint">
          Meldiq {h.version} · up {ageText(h.uptimeSeconds)}
        </small>
        {h.warnings.length === 0 ? (
          <p className="row" style={{ gap: 8, margin: 0 }}>
            <CheckCircle2 size={18} className="ok-text" /> No problems found in what the server measures.
          </p>
        ) : (
          <ul className="health-warnings">
            {h.warnings.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        )}
      </div>
      <Section title="Checks">
        <Line label="Database" value={measured(h.checks.database, (d) => `${d.ok ? "ok" : "NOT OK"} · ${bytes(d.sizeBytes)}`)} />
        <Line label="MongoDB" value={measured(h.checks.mongodb, (m) => (m.ok ? "ok" : "NOT ANSWERING"))} />
        <Line label="Calling (LiveKit)" value={measured(h.checks.livekit, (l) => (l.configured ? "configured" : "not configured"))} />
        <Line label="File storage" value={measured(h.checks.storage, (s) => `${s.backend} · ${s.reachable ? "reachable" : `UNREACHABLE (${s.errorKind ?? "error"})`}`)} />
      </Section>
      <Section title="Load">
        <Line label={`Requests, last ${w.minutes} min`} value={String(w.requests)} />
        <Line label="Server errors" value={`${w.serverErrors}${w.errorRate !== null ? ` (${(w.errorRate * 100).toFixed(1)} %)` : ""}`} />
        <Line label="Response time, 95th percentile" value={w.p95Ms !== null ? `≤ ${w.p95Ms} ms` : w.requests === 0 ? "no requests yet" : "over 5 s"} />
        <Line label="Event-loop delay, 99th percentile" value={h.process.eventLoopDelayP99Ms !== null ? `${h.process.eventLoopDelayP99Ms} ms` : "not measured yet"} />
        <Line label="Memory" value={`${bytes(h.process.rssBytes)} (heap ${bytes(h.process.heapUsedBytes)})`} />
        <Line label="Devices online" value={String(h.realtime.onlineDevices)} />
      </Section>
      <Section title="Queues">
        <Line label="Waiting deliveries" value={`${h.queues.delivery.items}${h.queues.delivery.oldestAgeSeconds !== null ? ` · oldest ${ageText(h.queues.delivery.oldestAgeSeconds)}` : ""}`} />
        <Line label="Reminders late (> 5 min)" value={String(h.queues.reminders.overdueUndelivered)} />
        <Line label="Reminders retrying" value={String(h.queues.reminders.retrying)} />
        <Line label="App jobs" value={measured(h.queues.integrations, (q) => `${q.jobsQueued} queued · ${q.jobsDead} gave up · ${q.deliveriesFailed24h} failed deliveries (24 h)`)} />
      </Section>
      {h.metrics.jobs.length > 0 && (
        <Section title="Background jobs (since start)">
          {h.metrics.jobs.map((j) => (
            <Line
              key={j.name}
              label={j.name}
              value={`${j.runs} runs · ${j.failures} failed${j.lastErrorKind ? ` · last: ${j.lastErrorKind}` : ""}${j.lastDurationMs !== null ? ` · ${j.lastDurationMs} ms` : ""}`}
            />
          ))}
        </Section>
      )}
      <Section title="Outside services (since start)">
        {h.metrics.providers.length === 0 ? (
          <Line label="No calls yet" value="email, push and storage appear after their first use" />
        ) : (
          h.metrics.providers.map((p) => <Line key={p.name} label={p.name} value={`${p.ok} ok · ${p.failed} failed${p.lastErrorKind ? ` · last: ${p.lastErrorKind}` : ""}`} />)
        )}
      </Section>
      {busy.length > 0 && (
        <Section title="Failing or slow requests">
          {busy.map((r) => (
            <Line key={r.route} label={r.route} value={`${r.count} · ${r.serverErrors} errors · p95 ${r.p95Ms !== null ? `≤ ${r.p95Ms}` : "> 5000"} ms`} />
          ))}
        </Section>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h2 className="health-title">{title}</h2>
      <dl className="card info-list health-card">{children}</dl>
    </>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
