import { formatNumber } from "../../i18n/format";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { CheckCircle2, RotateCw } from "lucide-react";
import { useState } from "react";
import { useEngine } from "../../application/orbit";
import { ageText, busyRoutes, type Health, serviceHealth } from "../../sync/ops";
import { bytes } from "../format";
import { useLoad } from "../workspace/useLoad";
type Measured =
  | {
      available: true;
    }
  | {
      available: false;
      reason: string;
    };
const measured = <T extends Measured>(
  m: T,
  describe: (
    v: Extract<
      T,
      {
        available: true;
      }
    >,
  ) => string,
): string =>
  m.available
    ? describe(
        m as Extract<
          T,
          {
            available: true;
          }
        >,
      )
    : uiText("settings.interface.not_measured_value0_7209847", {
        value0: (
          m as {
            reason: string;
          }
        ).reason,
      });
/**
 * Settings › Service health (android round 7 C1 ServiceHealthScreen), for platform administrators only: what the
 * server measures about itself, with "not measured" instead of invented numbers. Fetched on open and on Refresh.
 */
export function ServiceHealthPage() {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [tick, setTick] = useState(0);
  const health = useLoad(() => serviceHealth(engine), [engine, tick]);
  const h = health.data;
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>{l10n("admin.health")}</h1>
        <button className="btn btn-secondary btn-sm" onClick={() => setTick((t) => t + 1)} disabled={health.loading}>
          <RotateCw size={14} /> {l10n("messaging.collection_refresh")}
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
  useLocaleRender();
  const w = h.metrics.window;
  const busy = busyRoutes(h);
  return (
    <>
      <div className="card health-summary">
        <small className="faint">
          <Localized k="settings.interface.meldiq_up_49d0195" slots={[h.version, ageText(h.uptimeSeconds)]} />
        </small>
        {h.warnings.length === 0 ? (
          <p className="row" style={{ gap: 8, margin: 0 }}>
            <Localized k="settings.interface.no_problems_found_in_what_the_server_measures_601f5cb" slots={[<CheckCircle2 size={18} className="ok-text" />]} />
          </p>
        ) : (
          <ul className="health-warnings">
            {h.warnings.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        )}
      </div>
      <Section title={uiText("settings.interface.checks_de07d07")}>
        <Line
          label={uiText("settings.interface.database_fa7fe67")}
          value={measured(h.checks.database, (d) => `${d.ok ? uiText("settings.interface.ok_7a85f47") : uiText("settings.interface.not_ok_8b3ab5e")} · ${bytes(d.sizeBytes)}`)}
        />
        <Line
          label={uiText("settings.interface.mongodb_91231ff")}
          value={measured(h.checks.mongodb, (m) => (m.ok ? uiText("settings.interface.ok_7a85f47") : uiText("settings.interface.not_answering_3daa967")))}
        />
        <Line
          label={uiText("settings.interface.calling_livekit_24299fb")}
          value={measured(h.checks.livekit, (l) => (l.configured ? uiText("settings.interface.configured_3be9f95") : uiText("settings.interface.not_configured_67f2141")))}
        />
        <Line
          label={uiText("settings.interface.file_storage_879ebfb")}
          value={measured(
            h.checks.storage,
            (s) =>
              `${s.backend} · ${s.reachable ? uiText("settings.interface.reachable_2529cea") : uiText("settings.interface.unreachable_value0_e2d2e4f", { value0: s.errorKind ?? uiText("settings.interface.error_11f9578") })}`,
          )}
        />
      </Section>
      <Section title={uiText("settings.interface.load_8a6bdb6")}>
        <Line label={uiText("settings.interface.requests_last_value0_min_21dd0fb", { value0: w.minutes })} value={formatNumber(w.requests)} />
        <Line
          label={uiText("settings.interface.server_errors_120bd42")}
          value={`${formatNumber(w.serverErrors)}${w.errorRate !== null ? ` (${formatNumber(w.errorRate, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 })})` : ""}`}
        />
        <Line
          label={uiText("settings.interface.response_time_95th_percentile_569a3a6")}
          value={
            w.p95Ms !== null
              ? uiText("settings.interface.ms_cb7873c", { value0: w.p95Ms })
              : w.requests === 0
                ? uiText("settings.interface.no_requests_yet_87edc82")
                : uiText("settings.interface.over_5_s_5033ffd")
          }
        />
        <Line
          label={uiText("settings.interface.event_loop_delay_99th_percentile_dfc1165")}
          value={
            h.process.eventLoopDelayP99Ms !== null ? uiText("calls.interface.value0_ms_33f3d58", { value0: h.process.eventLoopDelayP99Ms }) : uiText("settings.interface.not_measured_yet_64196e9")
          }
        />
        <Line label={uiText("settings.interface.memory_c3963ae")} value={uiText("settings.interface.heap_f4beabd", { value0: bytes(h.process.rssBytes), value1: bytes(h.process.heapUsedBytes) })} />
        <Line label={uiText("settings.interface.devices_online_792267f")} value={formatNumber(h.realtime.onlineDevices)} />
      </Section>
      <Section title={uiText("settings.interface.queues_be77db1")}>
        <Line
          label={uiText("settings.interface.waiting_deliveries_a740eaa")}
          value={`${h.queues.delivery.items}${h.queues.delivery.oldestAgeSeconds !== null ? uiText("settings.interface.oldest_a5fbf20", { value0: ageText(h.queues.delivery.oldestAgeSeconds) }) : ""}`}
        />
        <Line label={uiText("settings.interface.reminders_late_5_min_6b17b08")} value={formatNumber(h.queues.reminders.overdueUndelivered)} />
        <Line label={uiText("settings.interface.reminders_retrying_d43b00b")} value={formatNumber(h.queues.reminders.retrying)} />
        <Line
          label={uiText("settings.interface.app_jobs_726e025")}
          value={measured(h.queues.integrations, (q) =>
            uiText("settings.interface.value0_queued_value1_gave_up_value2_failed_deliveries_24_h_636a630", { value0: q.jobsQueued, value1: q.jobsDead, value2: q.deliveriesFailed24h }),
          )}
        />
      </Section>
      {h.metrics.jobs.length > 0 && (
        <Section title={uiText("settings.interface.background_jobs_since_start_93c2ad4")}>
          {h.metrics.jobs.map((j) => (
            <Line
              key={j.name}
              label={j.name}
              value={uiText("settings.interface.runs_failed_bb7881b", {
                value0: j.runs,
                value1: j.failures,
                value2: j.lastErrorKind ? uiText("settings.interface.last_30627b4", { value0: j.lastErrorKind }) : "",
                value3: j.lastDurationMs !== null ? uiText("settings.interface.ms_5ff36e6", { value0: j.lastDurationMs }) : "",
              })}
            />
          ))}
        </Section>
      )}
      <Section title={uiText("settings.interface.outside_services_since_start_9f6bd9c")}>
        {h.metrics.providers.length === 0 ? (
          <Line label={uiText("settings.interface.no_calls_yet_68f06cf")} value={uiText("settings.interface.email_push_and_storage_appear_after_their_first_use_63d684e")} />
        ) : (
          h.metrics.providers.map((p) => (
            <Line
              key={p.name}
              label={p.name}
              value={uiText("settings.interface.ok_failed_15fb0df", {
                value0: p.ok,
                value1: p.failed,
                value2: p.lastErrorKind ? uiText("settings.interface.last_30627b4", { value0: p.lastErrorKind }) : "",
              })}
            />
          ))
        )}
      </Section>
      {busy.length > 0 && (
        <Section title={uiText("settings.interface.failing_or_slow_requests_437cb3c")}>
          {busy.map((r) => (
            <Line
              key={r.route}
              label={r.route}
              value={uiText("settings.interface.errors_p95_ms_6fc8f4d", { value0: r.count, value1: r.serverErrors, value2: r.p95Ms !== null ? `≤ ${r.p95Ms}` : "> 5000" })}
            />
          ))}
        </Section>
      )}
    </>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  useLocaleRender();
  return (
    <>
      <h2 className="health-title">{title}</h2>
      <dl className="card info-list health-card">{children}</dl>
    </>
  );
}
function Line({ label, value }: { label: string; value: string }) {
  useLocaleRender();
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
