import { useLocaleRender } from "../../i18n/Localized";
import { permissionLabel } from "../../i18n/catalog";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
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
  useLocaleRender();
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
    <section className="card setting-card" aria-label={uiText("organization.interface.effective_permission_preview_ed4035f")}>
      <h3>
        <Localized k="organization.interface.view_as_role_or_member_f8a7c65" />
      </h3>
      <p className="hint">
        <Localized k="organization.interface.read_only_preview_from_the_server_a_role_preview_represents_a_mem_63a5533" />
      </p>
      <label className="field">
        <span>
          <Localized k="organization.interface.preview_permissions_for_ac0c34d" />
        </span>
        <select className="input" aria-label={uiText("organization.interface.preview_permissions_for_ac0c34d")} value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">
            <Localized k="organization.interface.me_d30af07" />
          </option>
          {roles.map((r) => (
            <option key={r.id} value={`role:${r.id}`}>
              <Localized k="organization.interface.member_with_547bc42" slots={[r.name]} />
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
      <input
        className="input"
        aria-label={uiText("organization.interface.find_member_to_preview_414a9d0")}
        placeholder={uiText("organization.interface.find_a_member_by_name_289e2a7")}
        value={q}
        maxLength={40}
        onChange={(e) => setQ(e.target.value)}
      />
      {members.error && <p role="status">{members.error}</p>}
      {loaded.error ? (
        <p role="alert">{loaded.error}</p>
      ) : !loaded.data ? (
        <p role="status">
          <Localized k="organization.interface.loading_effective_permissions_1c3875d" />
        </p>
      ) : (
        <>
          <small>
            <Localized k="organization.interface.base_role_969af16" slots={[loaded.data.base]} />
          </small>
          {loaded.data.capabilities.map((c) => (
            <div key={c.key} className="setting">
              <span>{permissionLabel(c.key, c.label)}</span>
              <strong>{c.allowed ? uiText("organization.interface.allowed_1bb201d") : uiText("organization.interface.denied_da404de")}</strong>
            </div>
          ))}
          <details>
            <summary>
              <Localized k="organization.interface.how_these_permissions_were_resolved_8a9214a" />
            </summary>
            {loaded.data.steps.map((step, i) => (
              <div key={i}>
                <strong>{step.label}</strong>
                <ul>
                  {loaded.data!.capabilities.map((c) => (
                    <li key={c.key}>
                      {permissionLabel(c.key, c.label)}: {step.effective.includes(c.key) ? uiText("organization.interface.allowed_eabc01f") : uiText("organization.interface.denied_62d6c23")}
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
