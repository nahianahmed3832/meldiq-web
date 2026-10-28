import { useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { AUDIT_FILTERS } from "../../sync/reports";
import { type AuditPage as Page, auditLog } from "../../sync/roles";
import { directory } from "../../sync/workspaces";
import { fullTime } from "../format";
import { useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

/** The older servers' filters (workspaces with apps and branches). */
const LEGACY_FILTERS: { action: string | null; label: string }[] = [
  { action: null, label: "Everything" },
  { action: "role", label: "Roles" },
  { action: "member", label: "Members" },
  { action: "channel", label: "Channels" },
  { action: "invite", label: "Invitations" },
  { action: "integration", label: "Apps" },
  { action: "org", label: "Workspace" },
];

/**
 * Audit log (server docs/WORKSPACE_ROLES.md, batch B4 filters): every administrative change, newest first, for those
 * allowed; filtered by kind of change (Members, Channels, Categories, Roles, Invites, Community, Reports) and by person.
 */
export function AuditPage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const community = useOrbit((s) => s.server?.features.includes("community-channels") ?? false);
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [pages, setPages] = useState<Page[]>([]);
  const people = useLoad(() => (community && detail.permissions.canViewDirectory ? directory(engine, detail.org.id) : Promise.resolve([])), [engine, detail.org.id, community]);
  const first = useLoad(() => auditLog(engine, detail.org.id, null, action || undefined, actor || undefined), [engine, detail.org.id, action, actor]);
  const all = [first.data, ...pages].filter((p): p is Page => !!p);
  const next = all.at(-1)?.nextBefore ?? null;
  const filters = community ? AUDIT_FILTERS : LEGACY_FILTERS;
  return (
    <div className="ws-page">
      <Card title="Audit log" sub={`Administrative changes in this ${community ? "community" : "workspace"}. Message content is never here.`}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <div className="chips" role="group" aria-label="Kind of change">
            {filters.map((f) => (
              <button
                key={f.label}
                className="chip"
                aria-pressed={(f.action ?? "") === action}
                onClick={() => {
                  setPages([]);
                  setAction(f.action ?? "");
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          {community && (people.data?.length ?? 0) > 0 && (
            <select
              className="input input-sm"
              value={actor}
              aria-label="Made by"
              onChange={(e) => {
                setPages([]);
                setActor(e.target.value);
              }}
            >
              <option value="">Anyone</option>
              {people.data!.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          )}
        </div>
        <ErrorLine text={first.error} />
        <ul className="ws-list">
          {all
            .flatMap((p) => p.entries)
            .map((e) => (
              <li key={e.id} className="ws-row">
                <span className="lines grow">
                  <span>
                    <strong>{e.actorName ?? "Someone"}</strong> · {e.action.replace(/[._]/g, " ")}
                  </span>
                  <small>
                    {fullTime(e.at)}
                    {e.detail ? ` · ${e.detail}` : ""}
                  </small>
                </span>
              </li>
            ))}
          {first.data && all[0].entries.length === 0 && <li className="faint">Nothing recorded {action || actor ? "that matches" : "yet"}.</li>}
        </ul>
        {next && (
          <button className="btn btn-secondary btn-sm" onClick={() => void auditLog(engine, detail.org.id, next, action || undefined, actor || undefined).then((p) => setPages((x) => [...x, p]))}>
            Older
          </button>
        )}
      </Card>
    </div>
  );
}
