import { Archive, ArchiveRestore, ChevronDown, ChevronRight, ChevronUp, Plus, Trash2, UsersRound } from "lucide-react";
import { type DragEvent, useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { forgetCommunityMembers } from "../community/useCommunityMembers";
import { PARITY_FEATURES } from "../../sync/communityParity";
import { dropBefore, moveInOrder } from "../../sync/permissionGroups";
import { deleteRole, reorderRoles, type Role, rolesOverview, updateRole } from "../../sync/roles";
import { Dialog, Menu, useMenu } from "../components/Overlay";
import { namePaint } from "../people/NameStyle";
import { EveryoneDialog } from "./EveryoneDialog";
import { RoleEditor } from "./RoleEditor";
import { RoleMembersList } from "./RoleMembers";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

/** Custom roles highest first (a lower position is higher; roles without one keep the server's order). */
export function orderedRoles(roles: readonly Role[]): Role[] {
  return roles
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r.position ?? a.i) - (b.r.position ?? b.i) || a.i - b.i)
    .map((x) => x.r);
}

/**
 * Community settings › Roles (the reference's Roles page; server docs/WORKSPACE_ROLES.md, COMMUNITY_PERMISSIONS.md): the
 * @everyone defaults, the protected base roles, the community's custom roles in order (drag or arrows), who holds each,
 * and making, changing, archiving and deleting them as far as this person may.
 */
export function RolesPage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const parity = useOrbit((s) => s.server?.features.includes(PARITY_FEATURES.permissions) ?? false);
  const [version, setVersion] = useState(0);
  const data = useLoad(() => rolesOverview(engine, orgId, true), [engine, orgId, version]);
  const [editing, setEditing] = useState<{ role: Role | null; template?: string } | null>(null);
  const [holders, setHolders] = useState<Role | null>(null);
  const [everyone, setEveryoneOpen] = useState(false);
  const [dragged, setDragged] = useState<string | null>(null);
  const newMenu = useMenu();
  const act = useAction();
  const reload = () => {
    forgetCommunityMembers(orgId);
    setVersion((v) => v + 1);
  };
  const o = data.data;
  if (!o) return data.error ? <ErrorLine text={data.error} /> : <div className="skeleton" style={{ height: 160 }} />;
  const active = orderedRoles(o.roles.filter((r) => !r.archived));
  const archived = o.roles.filter((r) => r.archived);
  const ids = active.map((r) => r.id);
  const canOrder = parity && o.me.canManage;
  const reorder = (next: string[]) => {
    if (next.join() !== ids.join()) void act.act(() => reorderRoles(engine, orgId, next).then(reload));
  };
  const onDrop = (e: DragEvent, beforeId: string) => {
    e.preventDefault();
    if (dragged) reorder(dropBefore(ids, dragged, beforeId));
    setDragged(null);
  };

  return (
    <div className="ws-page">
      <ErrorLine text={act.error} />
      <p className="muted" style={{ margin: 0 }}>
        Roles group people and give them powers. Members use the colour of their highest role{canOrder ? "; drag roles or use the arrows to change the order" : ""}.
      </p>
      {o.everyone && (
        <button className="everyone-row" onClick={() => setEveryoneOpen(true)}>
          <UsersRound size={18} aria-hidden="true" />
          <span className="lines grow">
            <strong>Default permissions</strong>
            <small>@everyone · applies to all members{o.everyone.customized ? " · changed" : ""}</small>
          </span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}
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
        title={`Roles - ${active.length}`}
        sub={active.length ? undefined : "None yet. A role grants exactly what it lists, for example a Moderator who manages channels."}
        actions={
          o.me.canManage && (
            <button className="btn btn-primary btn-sm" onClick={(e) => newMenu.open(e.currentTarget)} aria-haspopup="menu">
              <Plus size={14} /> Create role
            </button>
          )
        }
      >
        <ul className="ws-list" aria-label="Custom roles">
          {active.map((r, i) => {
            const paint = r.color ? namePaint(r.extras?.color2 ? [r.color, r.extras.color2] : [r.color]) : undefined;
            return (
              <li
                key={r.id}
                className={`ws-row${dragged && dragged !== r.id ? " drop-target" : ""}`}
                draggable={canOrder}
                onDragStart={() => setDragged(r.id)}
                onDragEnd={() => setDragged(null)}
                onDragOver={(e) => canOrder && e.preventDefault()}
                onDrop={(e) => onDrop(e, r.id)}
              >
                {canOrder && (
                  <span className="role-order">
                    <button className="icon-btn" aria-label={`Move ${r.name} up`} disabled={i === 0 || act.busy} onClick={() => reorder(moveInOrder(ids, i, -1))}>
                      <ChevronUp size={13} />
                    </button>
                    <button className="icon-btn" aria-label={`Move ${r.name} down`} disabled={i === active.length - 1 || act.busy} onClick={() => reorder(moveInOrder(ids, i, 1))}>
                      <ChevronDown size={13} />
                    </button>
                  </span>
                )}
                <span
                  className="role-dot"
                  style={{ background: r.extras?.color2 && r.color ? `linear-gradient(135deg, ${r.color}, ${r.extras.color2})` : (r.color ?? "var(--outline)") }}
                  aria-hidden="true"
                />
                <button className="lines grow" style={{ textAlign: "left" }} onClick={() => setEditing({ role: r })}>
                  <span className={`sname${r.extras?.color2 ? " grad" : ""}`} style={paint}>
                    {r.name}
                  </span>
                  <small>
                    {r.memberCount} {r.memberCount === 1 ? "person" : "people"} · {r.permissions.length} granted{r.denies.length ? ` · ${r.denies.length} restricted` : ""}
                    {r.extras && r.extras.autoAssign.mode !== "none" ? " · given automatically" : ""}
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
            );
          })}
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
          label="Create role"
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
      {everyone && o.everyone && <EveryoneDialog orgId={orgId} overview={o} everyone={o.everyone} onSaved={reload} onClose={() => setEveryoneOpen(false)} />}
      {holders && (
        <Dialog
          title={`People with ${holders.name}`}
          onClose={() => setHolders(null)}
          footer={
            <button className="btn btn-primary" onClick={() => setHolders(null)}>
              Done
            </button>
          }
        >
          <div className="dialog-body">
            <RoleMembersList orgId={orgId} role={holders} canAssign={o.me.canAssign && holders.canAssign} onChanged={reload} />
          </div>
        </Dialog>
      )}
    </div>
  );
}
