import { Archive, ArchiveRestore, Plus, Trash2, UserMinus, UsersRound } from "lucide-react";
import { useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../application/orbit";
import { assignRole, deleteRole, type Role, roleMembers, rolesOverview, unassignRole, updateRole } from "../../sync/roles";
import { directory } from "../../sync/workspaces";
import { Avatar } from "../components/Avatar";
import { Dialog, Menu, useMenu } from "../components/Overlay";
import { RoleEditor } from "./RoleEditor";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

/**
 * Workspace › Roles (android workspace roles screens, server docs/WORKSPACE_ROLES.md): the protected base roles, the
 * workspace's custom roles, who holds each, and making, changing, archiving and deleting them as far as this person may.
 */
export function RolesPage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const [version, setVersion] = useState(0);
  const data = useLoad(() => rolesOverview(engine, orgId, true), [engine, orgId, version]);
  const [editing, setEditing] = useState<{ role: Role | null; template?: string } | null>(null);
  const [holders, setHolders] = useState<Role | null>(null);
  const newMenu = useMenu();
  const act = useAction();
  const reload = () => setVersion((v) => v + 1);
  const o = data.data;
  if (!o) return data.error ? <ErrorLine text={data.error} /> : <div className="skeleton" style={{ height: 160 }} />;
  const active = o.roles.filter((r) => !r.archived);
  const archived = o.roles.filter((r) => r.archived);

  return (
    <div className="ws-page">
      <ErrorLine text={act.error} />
      <Card title="Base roles" sub="Every member has one. They can't be changed; custom roles add to them.">
        <ul className="ws-list">
          {o.baseRoles.map((b) => (
            <li key={b.key} className="ws-row">
              <span className="lines grow">
                <span>{b.name}</span>
                <small>
                  {b.memberCount} {b.memberCount === 1 ? "person" : "people"} · {b.permissions.length} permissions
                </small>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card
        title="Custom roles"
        sub={active.length ? undefined : "None yet. A role grants exactly what it lists, for example a Moderator who manages channels."}
        actions={
          o.me.canManage && (
            <button className="btn btn-primary btn-sm" onClick={(e) => newMenu.open(e.currentTarget)} aria-haspopup="menu">
              <Plus size={14} /> New role
            </button>
          )
        }
      >
        <ul className="ws-list" aria-label="Custom roles">
          {active.map((r) => (
            <li key={r.id} className="ws-row">
              <span className="role-dot" style={{ background: r.color ?? "var(--outline)" }} aria-hidden="true" />
              <button className="lines grow" style={{ textAlign: "left" }} onClick={() => setEditing({ role: r })}>
                <span>{r.name}</span>
                <small>
                  {r.memberCount} {r.memberCount === 1 ? "person" : "people"} · {r.permissions.length} granted{r.denies.length ? ` · ${r.denies.length} restricted` : ""}
                </small>
              </button>
              <button className="btn btn-ghost btn-sm" aria-label={`People with ${r.name}`} onClick={() => setHolders(r)}>
                <UsersRound size={14} />
              </button>
              {r.canEdit && (
                <button
                  className="btn btn-ghost btn-sm"
                  aria-label={`Archive ${r.name}`}
                  disabled={act.busy}
                  onClick={() => void act.act(() => updateRole(engine, r, { archived: true }).then(reload))}
                >
                  <Archive size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>
      {archived.length > 0 && (
        <Card title="Archived roles" sub="They grant nothing; their holders keep them in case a role is restored.">
          <ul className="ws-list">
            {archived.map((r) => (
              <li key={r.id} className="ws-row">
                <span className="grow ellipsis">{r.name}</span>
                {r.canEdit && (
                  <>
                    <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => void act.act(() => updateRole(engine, r, { archived: false }).then(reload))}>
                      <ArchiveRestore size={14} /> Restore
                    </button>
                    <button className="btn btn-ghost btn-sm" aria-label={`Delete ${r.name}`} disabled={act.busy} onClick={() => void act.act(() => deleteRole(engine, r.id).then(reload))}>
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {newMenu.anchor && (
        <Menu
          anchor={newMenu.anchor}
          label="New role"
          align="end"
          onClose={newMenu.close}
          entries={[
            { label: "Blank role", onSelect: () => setEditing({ role: null }) },
            "separator" as const,
            { heading: "Start from" },
            ...o.templates.map((t) => ({ label: t.name, onSelect: () => setEditing({ role: null, template: t.key }) })),
          ]}
        />
      )}
      {editing && <RoleEditor orgId={orgId} overview={o} role={editing.role} template={editing.template} onSaved={reload} onClose={() => setEditing(null)} />}
      {holders && <RoleHolders orgId={orgId} role={holders} canAssign={o.me.canAssign && holders.canAssign} onChanged={reload} onClose={() => setHolders(null)} />}
    </div>
  );
}

function RoleHolders({ orgId, role, canAssign, onChanged, onClose }: { orgId: string; role: Role; canAssign: boolean; onChanged: () => void; onClose: () => void }) {
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
    <Dialog
      title={`People with ${role.name}`}
      onClose={onClose}
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="dialog-body">
        <ErrorLine text={act.error ?? members.error} />
        <ul className="ws-list">
          {(members.data ?? []).map((m) => (
            <li key={m.id} className="ws-row">
              <span className="lines grow">
                <span>{m.displayName}</span>
                <small>
                  @{m.username} · {m.orgRole.toLowerCase()}
                </small>
              </span>
              {canAssign && (
                <button
                  className="btn btn-ghost btn-sm"
                  aria-label={`Remove ${m.displayName}`}
                  disabled={act.busy}
                  onClick={() => void act.act(() => unassignRole(engine, role.id, m.id).then(changed))}
                >
                  <UserMinus size={14} />
                </button>
              )}
            </li>
          ))}
          {members.data?.length === 0 && <li className="faint">Nobody holds this role.</li>}
        </ul>
        {canAssign && (
          <>
            <input className="input" placeholder="Give this role to…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" />
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
                      Give role
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}
      </div>
    </Dialog>
  );
}
