import { useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../app/orbit";
import { type AuditPage as Page, auditLog } from "../../sync/roles";
import { fullTime } from "../format";
import { useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

/** Workspace › Audit log (server docs/WORKSPACE_ROLES.md): every administrative change, newest first, for those allowed. */
export function AuditPage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const [action, setAction] = useState("");
  const [pages, setPages] = useState<Page[]>([]);
  const first = useLoad(() => auditLog(engine, detail.org.id, null, action || undefined), [engine, detail.org.id, action]);
  const all = [first.data, ...pages].filter((p): p is Page => !!p);
  const next = all.at(-1)?.nextBefore ?? null;
  return (
    <div className="ws-page">
      <Card
        title="Audit log"
        sub="Administrative changes in this workspace. Message content is never here: it's end-to-end encrypted."
        actions={
          <select
            className="input input-sm"
            value={action}
            onChange={(e) => {
              setPages([]);
              setAction(e.target.value);
            }}
            aria-label="Filter"
          >
            <option value="">Everything</option>
            <option value="role">Roles</option>
            <option value="member">Members</option>
            <option value="channel">Channels</option>
            <option value="invite">Invitations</option>
            <option value="integration">Apps</option>
            <option value="org">Workspace</option>
          </select>
        }
      >
        <ErrorLine text={first.error} />
        <ul className="ws-list">
          {all
            .flatMap((p) => p.entries)
            .map((e) => (
              <li key={e.id} className="ws-row">
                <span className="lines grow">
                  <span>
                    <strong>{e.actorName ?? "Someone"}</strong> · <code>{e.action}</code>
                  </span>
                  <small>
                    {fullTime(e.at)}
                    {e.detail ? ` · ${e.detail}` : ""}
                  </small>
                </span>
              </li>
            ))}
          {first.data && all[0].entries.length === 0 && <li className="faint">Nothing recorded yet.</li>}
        </ul>
        {next && (
          <button className="btn btn-secondary btn-sm" onClick={() => void auditLog(engine, detail.org.id, next, action || undefined).then((p) => setPages((x) => [...x, p]))}>
            Older
          </button>
        )}
      </Card>
    </div>
  );
}
