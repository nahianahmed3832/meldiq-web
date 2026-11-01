import { useState } from "react";
import { z } from "zod";
import { useEngine, useOrbit } from "../../application/orbit";
import type { Overwrites } from "../../api/communitySchemas";
import type { OverwriteTarget } from "../../sync/community";
import { directory } from "../../sync/workspaces";
import { useLoad } from "../workspace/useLoad";
const result = z.object({
  base: z.string(),
  subject: z.string(),
  steps: z.array(z.object({ label: z.string(), effective: z.array(z.string()) })),
  capabilities: z.array(z.object({ key: z.string(), label: z.string(), allowed: z.boolean() })),
});
export function PermissionPreview({ orgId, target, roles, revision }: { orgId: string; target: OverwriteTarget; roles: Overwrites["roles"]; revision: unknown }) {
  const engine = useEngine();
  const me = useOrbit((s) => s.me?.userId);
  const [subject, setSubject] = useState("");
  const [q, setQ] = useState("");
  const members = useLoad(() => (q.trim().length >= 2 ? directory(engine, orgId, q) : Promise.resolve([])), [engine, orgId, q]);
  const loaded = useLoad(
    () =>
      engine.api.json(
        "GET",
        `/v1/${target.type === "category" ? "categories" : "conversations"}/${encodeURIComponent(target.id)}/permission-preview${subject ? `?${subject.startsWith("role:") ? "roleId" : "userId"}=${encodeURIComponent(subject.slice(subject.indexOf(":") + 1))}` : ""}`,
        result,
      ),
    [engine, target.type, target.id, subject, revision],
  );
  return (
    <section className="card setting-card" aria-label="Effective permission preview">
      <h3>View as role or member</h3>
      <p className="hint">
        Read-only preview from the server. A role preview represents a Member holding only that role. Member previews include all their roles and personal rules. Posting restrictions such as timeouts
        and onboarding still apply.
      </p>
      <label className="field">
        <span>Preview permissions for</span>
        <select className="input" aria-label="Preview permissions for" value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">Me</option>
          {roles.map((r) => (
            <option key={r.id} value={`role:${r.id}`}>
              Member with {r.name}
            </option>
          ))}
          {members.data
            ?.filter((m) => m.id !== me)
            .map((m) => (
              <option key={m.id} value={`user:${m.id}`}>
                {m.displayName} (@{m.username})
              </option>
            ))}
        </select>
      </label>
      <input className="input" aria-label="Find member to preview" placeholder="Find a member by name" value={q} maxLength={40} onChange={(e) => setQ(e.target.value)} />
      {members.error && <p role="status">{members.error}</p>}
      {loaded.error ? (
        <p role="alert">{loaded.error}</p>
      ) : !loaded.data ? (
        <p role="status">Loading effective permissions…</p>
      ) : (
        <>
          <small>Base role: {loaded.data.base}</small>
          {loaded.data.capabilities.map((c) => (
            <div key={c.key} className="setting">
              <span>{c.label}</span>
              <strong>{c.allowed ? "Allowed" : "Denied"}</strong>
            </div>
          ))}
          <details>
            <summary>How these permissions were resolved</summary>
            {loaded.data.steps.map((step, i) => (
              <div key={i}>
                <strong>{step.label}</strong>
                <ul>
                  {loaded.data!.capabilities.map((c) => (
                    <li key={c.key}>
                      {c.label}: {step.effective.includes(c.key) ? "allowed" : "denied"}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </details>
        </>
      )}
    </section>
  );
}
