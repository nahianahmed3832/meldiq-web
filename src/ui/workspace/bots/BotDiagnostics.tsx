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
  const engine = useEngine();
  const loaded = useLoad(() => engine.api.json("GET", `/v1/orgs/${encodeURIComponent(orgId)}/official-bots/${encodeURIComponent(botKey)}/diagnostics`, zDiagnostics), [engine, orgId, botKey]);
  return (
    <section className="card setting-card" aria-label="Bot health & event history">
      <h3>Health & event history</h3>
      <button className="btn btn-secondary" onClick={loaded.reload} disabled={loaded.loading}>
        Run configuration check
      </button>
      <p className="hint">
        Checks the saved configuration without posting a message. Event outcomes describe runtime handlers; they do not guarantee a message was posted. History keeps the latest 50 events without
        message contents.
      </p>
      {loaded.error && <p role="alert">{loaded.error}</p>}
      {loaded.data && (
        <>
          <small>Checked {new Date(loaded.data.checkedAt).toLocaleString()}</small>
          {loaded.data.checks.map((c) => (
            <div className="setting" key={c.label}>
              <span className="lines">
                <strong>{c.label}</strong>
                <small>{c.detail}</small>
              </span>
              <span>{c.ok ? "Ready" : "Needs attention"}</span>
            </div>
          ))}
          <details>
            <summary>Recent event outcomes ({loaded.data.events.length})</summary>
            {!loaded.data.events.length && <p>No runtime events recorded yet.</p>}
            {loaded.data.events.map((e) => (
              <div className="setting" key={e.id}>
                <span>
                  {e.kind} · {e.outcome === "ok" ? "Completed" : "Failed"}
                </span>
                <time dateTime={new Date(e.at).toISOString()}>{new Date(e.at).toLocaleString()}</time>
              </div>
            ))}
          </details>
        </>
      )}
    </section>
  );
}
