import { Trash2, UserMinus } from "lucide-react";
import type { Department } from "../../api/workspaceSchemas";
import { type FormEvent, useState } from "react";
import { useEngine } from "../../app/orbit";
import { createDepartment, deleteDepartment, leadRole, renameDepartment, renameScope, type ScopeKind, type ScopeRole, scopeMembers, setScopeMember, setTeamDepartment } from "../../sync/scopes";
import { directory } from "../../sync/workspaces";
import { Avatar } from "../components/Avatar";
import { Dialog } from "../components/Overlay";
import { useAction, useLoad } from "./useLoad";
import { ErrorLine } from "./WorkspaceView";

const NAME_MAX = 60;

export interface ManagedScope {
  kind: ScopeKind;
  id: string;
  name: string;
  location?: string | null;
  /** A team's branch and department (departments group one branch's teams). */
  branchId?: string | null;
  departmentId?: string | null;
}

/**
 * One branch or team (android ScopeAdminViews): rename it, and choose who belongs and who leads it. Branch managers and
 * team leads can manage what's inside their scope; the server refuses anything else and its reason is shown.
 */
export function ScopeManageDialog({
  orgId,
  scope,
  departments,
  onChanged,
  onClose,
}: {
  orgId: string;
  scope: ManagedScope;
  /** The departments of this branch (a branch) or of the team's branch (a team). */
  departments: Department[];
  onChanged: () => void;
  onClose: () => void;
}) {
  const engine = useEngine();
  const [name, setName] = useState(scope.name);
  const [location, setLocation] = useState(scope.location ?? "");
  const [q, setQ] = useState("");
  const [departmentId, setDepartmentId] = useState(scope.departmentId ?? "");
  const [version, setVersion] = useState(0);
  const members = useLoad(() => scopeMembers(engine, scope.kind, scope.id), [engine, scope.kind, scope.id, version]);
  const people = useLoad(() => directory(engine, orgId, q), [engine, orgId, q]);
  const act = useAction();
  const lead = leadRole(scope.kind);
  const leadLabel = scope.kind === "branch" ? "Manager" : "Lead";
  const trimmed = name.trim();
  const renamed = trimmed !== scope.name || (scope.kind === "branch" && (location.trim() || null) !== (scope.location ?? null));

  const changed = () => {
    setVersion((v) => v + 1);
    onChanged();
  };
  const rename = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || !renamed) return;
    void act.act(() => renameScope(engine, scope.kind, scope.id, { name: trimmed, location: location.trim() || null }).then(onChanged));
  };
  const setRole = (userId: string, role: ScopeRole | null) => void act.act(() => setScopeMember(engine, scope.kind, scope.id, userId, role).then(changed));

  const memberIds = new Set((members.data ?? []).map((m) => m.id));
  const addable = (people.data ?? []).filter((p) => !memberIds.has(p.id)).slice(0, 8);

  return (
    <Dialog
      title={`Manage ${scope.kind === "branch" ? "branch" : "team"}`}
      onClose={onClose}
      wide
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="dialog-body">
        <ErrorLine text={act.error} />
        <form className="ws-form" onSubmit={rename}>
          <label className="field">
            <span>Name</span>
            <input className="input" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} aria-invalid={!trimmed} />
          </label>
          {scope.kind === "branch" && (
            <label className="field">
              <span>Location</span>
              <input className="input" value={location} maxLength={120} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" />
            </label>
          )}
          <div className="ws-form-actions">
            <button className="btn btn-secondary btn-sm" disabled={!trimmed || !renamed || act.busy}>
              Save name
            </button>
          </div>
        </form>

        {scope.kind === "branch" && <Departments branchId={scope.id} departments={departments} act={act} onChanged={onChanged} />}
        {scope.kind === "team" && scope.branchId && departments.length > 0 && (
          <label className="field">
            <span>Department</span>
            <select
              className="input"
              value={departmentId}
              disabled={act.busy}
              onChange={(e) => {
                const next = e.target.value;
                void act.act(() => setTeamDepartment(engine, scope.id, next || null).then(() => (setDepartmentId(next), onChanged())));
              }}
            >
              <option value="">None</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <span className="hint">Departments group a branch's teams. They don't change who can see what.</span>
          </label>
        )}

        <div className="panel-section-title">
          <span>Members</span>
          <span>{members.data?.length ?? ""}</span>
        </div>
        <ErrorLine text={members.error} />
        {members.loading && !members.data ? (
          <span className="skeleton" style={{ height: 80 }} />
        ) : (
          <ul className="ws-list" aria-label="Members">
            {(members.data ?? []).map((m) => (
              <li key={m.id} className="ws-row">
                <Avatar name={m.displayName} colorIndex={m.avatarColor} size={30} decorative />
                <span className="lines grow">
                  <span className="ellipsis">{m.displayName}</span>
                  <small className="ellipsis">@{m.username}</small>
                </span>
                <select
                  className="input input-sm"
                  aria-label={`Role of ${m.displayName}`}
                  value={m.role === lead ? lead : "MEMBER"}
                  disabled={act.busy}
                  onChange={(e) => setRole(m.id, e.target.value as ScopeRole)}
                >
                  <option value="MEMBER">Member</option>
                  <option value={lead}>{leadLabel}</option>
                </select>
                <button className="btn btn-ghost btn-sm" disabled={act.busy} aria-label={`Remove ${m.displayName}`} onClick={() => setRole(m.id, null)}>
                  <UserMinus size={14} />
                </button>
              </li>
            ))}
            {members.data?.length === 0 && <li className="faint">Nobody yet.</li>}
          </ul>
        )}

        <div className="panel-section-title">
          <span>Add people from this workspace</span>
        </div>
        <input className="input" placeholder="Search members" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search workspace members" />
        <ul className="ws-list" aria-label="People to add">
          {addable.map((p) => (
            <li key={p.id} className="ws-row">
              <Avatar name={p.displayName} colorIndex={p.avatarColor} size={30} decorative />
              <span className="lines grow">
                <span className="ellipsis">{p.displayName}</span>
                <small className="ellipsis">@{p.username}</small>
              </span>
              <button className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => setRole(p.id, "MEMBER")}>
                Add
              </button>
            </li>
          ))}
          {people.data && addable.length === 0 && <li className="faint">Everyone found is already here.</li>}
        </ul>
      </div>
    </Dialog>
  );
}

/** A branch's departments: add, rename, delete (their teams stay in the branch, ungrouped). */
function Departments({ branchId, departments, act, onChanged }: { branchId: string; departments: Department[]; act: ReturnType<typeof useAction>; onChanged: () => void }) {
  const engine = useEngine();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const add = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    void act.act(() => createDepartment(engine, branchId, n).then(() => (setName(""), onChanged())));
  };
  return (
    <>
      <div className="panel-section-title">
        <span>Departments</span>
        <span>{departments.length}</span>
      </div>
      <ul className="ws-list" aria-label="Departments">
        {departments.map((d) => (
          <li key={d.id} className="ws-row">
            {editing?.id === d.id ? (
              <form
                className="row grow"
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = editing.name.trim();
                  if (n) void act.act(() => renameDepartment(engine, d.id, n).then(() => (setEditing(null), onChanged())));
                }}
              >
                <input
                  className="input input-sm grow"
                  value={editing.name}
                  maxLength={NAME_MAX}
                  onChange={(e) => setEditing({ id: d.id, name: e.target.value })}
                  aria-label={`New name for ${d.name}`}
                  autoFocus
                />
                <button className="btn btn-secondary btn-sm" disabled={act.busy || !editing.name.trim()}>
                  Save
                </button>
              </form>
            ) : (
              <>
                <span className="grow ellipsis">{d.name}</span>
                <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => setEditing({ id: d.id, name: d.name })}>
                  Rename
                </button>
                <button className="btn btn-ghost btn-sm" disabled={act.busy} aria-label={`Delete ${d.name}`} onClick={() => void act.act(() => deleteDepartment(engine, d.id).then(onChanged))}>
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </li>
        ))}
        {departments.length === 0 && <li className="faint">None. Departments group this branch's teams.</li>}
      </ul>
      <form className="row" onSubmit={add}>
        <input className="input input-sm grow" placeholder="New department" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} aria-label="New department name" />
        <button className="btn btn-secondary btn-sm" disabled={act.busy || !name.trim()}>
          Add
        </button>
      </form>
    </>
  );
}
