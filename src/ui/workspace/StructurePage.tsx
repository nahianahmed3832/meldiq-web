import { Archive, ArchiveRestore, Building2, Plus, UsersRound } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../app/orbit";
import { archivedScopes, createBranch, createTeam, setBranchArchived, setTeamArchived } from "../../sync/workspaces";
import { roleName } from "../../sync/workspaceRules";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

/**
 * Branches and teams (docs/WORKSPACES.md, WORKSPACE_ADMINISTRATION.md §1): owners and admins create branches and
 * cross-branch teams, branch managers create their branch's teams; archiving makes a scope read-only and restoring
 * brings it back (a team in an archived branch comes back with its branch).
 */
export function StructurePage({ detail, onChanged }: { detail: OrgAdminDetail; onChanged: () => void }) {
  const engine = useEngine();
  const isAdmin = detail.permissions.canManageOrg;
  const [version, setVersion] = useState(0);
  const archived = useLoad(() => (detail.permissions.canRestore ? archivedScopes(engine, detail.org.id) : Promise.resolve(null)), [engine, detail, version]);
  const act = useAction();
  const changed = () => {
    setVersion((v) => v + 1);
    onChanged();
  };
  const managedBranches = detail.branches.filter((b) => b.canManage);

  return (
    <div className="ws-page">
      {(isAdmin || managedBranches.length > 0) && <NewScope detail={detail} onCreated={changed} />}
      <ErrorLine text={act.error} />
      <Card title="Branches" sub={detail.branches.length ? undefined : "No branches. Branches group people by place or division; teams can sit inside one or across them."}>
        <ul className="ws-list" aria-label="Branches">
          {detail.branches.map((b) => (
            <li key={b.id} className="ws-row">
              <Building2 size={18} className="faint" />
              <span className="lines grow">
                <span className="ellipsis">{b.name}</span>
                <small className="ellipsis">
                  {b.location ? `${b.location} · ` : ""}
                  {b.memberCount} {b.memberCount === 1 ? "member" : "members"}
                  {b.myRole ? ` · you're ${roleName(b.myRole).toLowerCase()}` : ""}
                </small>
              </span>
              {isAdmin && (
                <button className="btn btn-ghost btn-sm" disabled={act.busy} aria-label={`Archive ${b.name}`} onClick={() => void act.act(() => setBranchArchived(engine, b.id, true).then(changed))}>
                  <Archive size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Teams">
        <ul className="ws-list" aria-label="Teams">
          {detail.teams.map((t) => (
            <li key={t.id} className="ws-row">
              <UsersRound size={18} className="faint" />
              <span className="lines grow">
                <span className="ellipsis">{t.name}</span>
                <small className="ellipsis">
                  {t.branchId ? (detail.branches.find((b) => b.id === t.branchId)?.name ?? "Branch") : "Across branches"} · {t.memberCount} {t.memberCount === 1 ? "member" : "members"}
                  {t.myRole ? ` · you're ${roleName(t.myRole).toLowerCase()}` : ""}
                </small>
              </span>
              {(isAdmin || (t.branchId && detail.branches.find((b) => b.id === t.branchId)?.canManage)) && (
                <button className="btn btn-ghost btn-sm" disabled={act.busy} aria-label={`Archive ${t.name}`} onClick={() => void act.act(() => setTeamArchived(engine, t.id, true).then(changed))}>
                  <Archive size={14} />
                </button>
              )}
            </li>
          ))}
          {detail.teams.length === 0 && <li className="faint">No teams you can see.</li>}
        </ul>
      </Card>
      {archived.data && (archived.data.branches.length > 0 || archived.data.teams.length > 0) && (
        <Card title="Archived" sub="Read-only until restored.">
          <ul className="ws-list" aria-label="Archived branches and teams">
            {archived.data.branches.map((b) => (
              <li key={b.id} className="ws-row">
                <Building2 size={18} className="faint" />
                <span className="grow ellipsis">{b.name}</span>
                <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => void act.act(() => setBranchArchived(engine, b.id, false).then(changed))}>
                  <ArchiveRestore size={14} /> Restore
                </button>
              </li>
            ))}
            {archived.data.teams.map((t) => (
              <li key={t.id} className="ws-row">
                <UsersRound size={18} className="faint" />
                <span className="lines grow">
                  <span className="ellipsis">{t.name}</span>
                  {t.branchArchived && <small>Comes back with its branch</small>}
                </span>
                {!t.branchArchived && (
                  <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => void act.act(() => setTeamArchived(engine, t.id, false).then(changed))}>
                    <ArchiveRestore size={14} /> Restore
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function NewScope({ detail, onCreated }: { detail: OrgAdminDetail; onCreated: () => void }) {
  const engine = useEngine();
  const isAdmin = detail.permissions.canManageOrg;
  const branchOptions = detail.branches.filter((b) => isAdmin || b.canManage);
  const [what, setWhat] = useState<"branch" | "team">(isAdmin ? "branch" : "team");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [branchId, setBranchId] = useState(isAdmin ? "" : (branchOptions[0]?.id ?? ""));
  const act = useAction();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    void act.act(async () => {
      if (what === "branch") await createBranch(engine, detail.org.id, name, location || null);
      else await createTeam(engine, detail.org.id, name, branchId || null);
      setName("");
      setLocation("");
      onCreated();
    });
  };
  return (
    <Card title="Add a branch or team">
      <form onSubmit={submit} className="ws-form">
        {isAdmin && (
          <label className="field">
            <span>Add</span>
            <select className="input" value={what} onChange={(e) => setWhat(e.target.value as "branch" | "team")}>
              <option value="branch">Branch</option>
              <option value="team">Team</option>
            </select>
          </label>
        )}
        <label className="field">
          <span>Name</span>
          <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </label>
        {what === "branch" ? (
          <label className="field">
            <span>Location (optional)</span>
            <input className="input" value={location} maxLength={250} onChange={(e) => setLocation(e.target.value)} />
          </label>
        ) : (
          <label className="field">
            <span>In</span>
            <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {isAdmin && <option value="">Across branches</option>}
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="ws-form-actions">
          <button className="btn btn-primary btn-sm" disabled={!name.trim() || act.busy}>
            <Plus size={14} /> Add {what}
          </button>
        </div>
      </form>
      <ErrorLine text={act.error} />
    </Card>
  );
}
