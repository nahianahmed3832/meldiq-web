import { useLocaleRender } from "../../../i18n/Localized";
import { text as uiText } from "../../../i18n";
import { Localized } from "../../../i18n/Localized";
import { interfaceLocale } from "../../../i18n/format";
import { z } from "zod";
import { useEngine } from "../../../application/orbit";
import { useLoad } from "../useLoad";
const zDiagnostics = z.object({
  enabled: z.boolean(),
  available: z.boolean(),
  reason: z.string().nullable(),
  checkedAt: z.number(),
  checks: z.array(z.object({ label: z.string(), ok: z.boolean(), detail: z.string() })),
  events: z.array(z.object({ id: z.string(), kind: z.string(), outcome: z.enum(["ok", "failed"]), at: z.number() })),
});
export function BotDiagnostics({ orgId, botKey }: { orgId: string; botKey: string }) {
  useLocaleRender();
  const engine = useEngine();
  const loaded = useLoad(() => engine.api.json("GET", `/v1/orgs/${encodeURIComponent(orgId)}/official-bots/${encodeURIComponent(botKey)}/diagnostics`, zDiagnostics), [engine, orgId, botKey]);
  return (
    <section className="card setting-card" aria-label={uiText("workspace.interface.bot_health_event_history_11a68b7")}>
      <h3>
        <Localized k="workspace.interface.health_event_history_d71e2e9" />
      </h3>
      <button className="btn btn-secondary" onClick={loaded.reload} disabled={loaded.loading}>
        <Localized k="workspace.interface.run_configuration_check_13d45a0" />
      </button>
      <p className="hint">
        <Localized k="workspace.interface.checks_the_saved_configuration_without_posting_a_message_event_ou_b7d391b" />
      </p>
      {loaded.error && <p role="alert">{loaded.error}</p>}
      {loaded.data && (
        <>
          <small>
            <Localized k="workspace.interface.checked_27ca340" slots={[new Date(loaded.data.checkedAt).toLocaleString(interfaceLocale())]} />
          </small>
          {loaded.data.checks.map((c) => (
            <div className="setting" key={c.label}>
              <span className="lines">
                <strong>{c.label}</strong>
                <small>{c.detail}</small>
              </span>
              <span>{c.ok ? uiText("messaging.interface.ready_5fa7aac") : uiText("workspace.interface.needs_attention_c1ebc78")}</span>
            </div>
          ))}
          <details>
            <summary>
              <Localized k="workspace.interface.recent_event_outcomes_70227a8" slots={[loaded.data.events.length]} />
            </summary>
            {!loaded.data.events.length && (
              <p>
                <Localized k="workspace.interface.no_runtime_events_recorded_yet_096392e" />
              </p>
            )}
            {loaded.data.events.map((e) => (
              <div className="setting" key={e.id}>
                <span>
                  {e.kind} · {e.outcome === "ok" ? uiText("workspace.interface.completed_22a970d") : uiText("messaging.interface.failed_031a8f0")}
                </span>
                <time dateTime={new Date(e.at).toISOString()}>{new Date(e.at).toLocaleString(interfaceLocale())}</time>
              </div>
            ))}
          </details>
        </>
      )}
    </section>
  );
}
