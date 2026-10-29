import { UserMinus } from "lucide-react";
import { useState } from "react";
import { useEngine } from "../../application/orbit";
import { assignRole, type Role, roleMembers, unassignRole } from "../../sync/roles";
import { directory } from "../../sync/workspaces";
import { Avatar } from "../components/Avatar";
import { useAction, useLoad } from "./useLoad";
import { ErrorLine } from "./WorkspaceView";

interface RoleMembersListProps {
  orgId: string;
  role: Role;
  canAssign: boolean;
  onChanged: () => void;
}

/** A role's Manage Members: who holds it, removing them, and adding members found by name. */
export function RoleMembersList({ orgId, role, canAssign, onChanged }: RoleMembersListProps) {
  const engine = useEngine();
  const [version, setVersion] = useState(0);
  const [q, setQ] = useState("");
  const members = useLoad(() => roleMembers(engine, role.id), [engine, role.id, version]);
  const people = useLoad(() => (canAssign ? directory(engine, orgId, q) : Promise.resolve([])), [engine, orgId, q, canAssign]);
  const act = useAction();
  const changed = () => {
    setVersion((v) => v + 1);
    onChanged();
  };
  const held = new Set((members.data ?? []).map((m) => m.id));
  return (
    <>
      <ErrorLine text={act.error ?? members.error} />
      {canAssign && (
        <>
          <input className="input" placeholder="Add members by name or @username" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" />
          <ul className="ws-list">
            {(people.data ?? [])
              .filter((p) => !held.has(p.id))
              .slice(0, 8)
              .map((p) => (
                <li key={p.id} className="ws-row">
                  <Avatar name={p.displayName} colorIndex={p.avatarColor} size={28} decorative />
                  <span className="lines grow">
                    <span>{p.displayName}</span>
                    <small>@{p.username}</small>
                  </span>
                  <button className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => void act.act(() => assignRole(engine, role.id, p.id).then(changed))}>
                    Add
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}
      <ul className="ws-list" aria-label={`People with ${role.name}`}>
        {(members.data ?? []).map((m) => (
          <li key={m.id} className="ws-row">
            <span className="lines grow">
              <span>{m.displayName}</span>
              <small>
                @{m.username} · {m.orgRole.toLowerCase()}
              </small>
            </span>
            {canAssign && (
              <button className="btn btn-ghost btn-sm" aria-label={`Remove ${m.displayName}`} disabled={act.busy} onClick={() => void act.act(() => unassignRole(engine, role.id, m.id).then(changed))}>
                <UserMinus size={14} />
              </button>
            )}
          </li>
        ))}
        {members.data?.length === 0 && <li className="faint">Nobody has this role yet.</li>}
      </ul>
    </>
  );
}
