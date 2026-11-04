import { countLabel } from "../../i18n/counts";
import { useLocaleRender } from "../../i18n/Localized";
import { catalogText } from "../../i18n/catalog";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
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
import { Card, ErrorLine } from "../components/SettingsCard";
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
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const orgId = detail.org.id;
  const parity = useOrbit((s) => s.server?.features.includes(PARITY_FEATURES.permissions) ?? false);
  const [version, setVersion] = useState(0);
  const data = useLoad(() => rolesOverview(engine, orgId, true), [engine, orgId, version]);
  const [editing, setEditing] = useState<{
    role: Role | null;
    template?: string;
  } | null>(null);
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
        <Localized
          k="organization.interface.roles_group_people_and_give_them_powers_members_use_the_colour_of_91a3189"
          slots={[canOrder ? uiText("organization.interface.drag_roles_or_use_the_arrows_to_change_the_order_c56c5d4") : ""]}
        />
      </p>
      {o.everyone && (
        <button className="everyone-row" onClick={() => setEveryoneOpen(true)}>
          <UsersRound size={18} aria-hidden="true" />
          <span className="lines grow">
            <strong>
              <Localized k="organization.interface.default_permissions_43fc0ab" />
            </strong>
            <small>
              <Localized k="organization.interface.everyone_applies_to_all_members_846ca73" slots={[o.everyone.customized ? uiText("organization.interface.changed_6facee8") : ""]} />
            </small>
          </span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}
      <Card title={uiText("organization.interface.base_roles_15d0480")} sub={uiText("organization.interface.every_member_has_one_they_can_t_be_changed_custom_roles_add_to_th_6df9b8b")}>
        <ul className="ws-list">
          {o.baseRoles.map((b) => (
            <li key={b.key} className="ws-row">
              <span className="lines grow">
                <span>{b.name}</span>
                <small>
                  <Localized k="organization.interface.native_count_76ed3a99d" slots={[countLabel(b.memberCount, "people"), "", b.permissions.length]} />
                </small>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card
        title={uiText("organization.interface.roles_value0_f1198fe", { value0: active.length })}
        sub={active.length ? undefined : uiText("organization.interface.none_yet_a_role_grants_exactly_what_it_lists_for_example_a_modera_83018db")}
        actions={
          o.me.canManage && (
            <button className="btn btn-primary btn-sm" onClick={(e) => newMenu.open(e.currentTarget)} aria-haspopup="menu">
              <Localized k="organization.interface.create_role_1180e67" slots={[<Plus size={14} />]} />
            </button>
          )
        }
      >
        <ul className="ws-list" aria-label={uiText("organization.interface.custom_roles_c703c7f")}>
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
                    <button
                      className="icon-btn"
                      aria-label={uiText("organization.interface.move_value0_up_4f93d15", { value0: r.name })}
                      disabled={i === 0 || act.busy}
                      onClick={() => reorder(moveInOrder(ids, i, -1))}
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label={uiText("organization.interface.move_value0_down_7c18b9e", { value0: r.name })}
                      disabled={i === active.length - 1 || act.busy}
                      onClick={() => reorder(moveInOrder(ids, i, 1))}
                    >
                      <ChevronDown size={13} />
                    </button>
                  </span>
                )}
                <span
                  className="role-dot"
                  style={{ background: r.extras?.color2 && r.color ? `linear-gradient(135deg, ${r.color}, ${r.extras.color2})` : (r.color ?? "var(--outline)") }}
                  aria-hidden="true"
                />
                <button className="lines grow" style={{ textAlign: "start" }} onClick={() => setEditing({ role: r })}>
                  <span className={`sname${r.extras?.color2 ? " grad" : ""}`} style={paint}>
                    {r.name}
                  </span>
                  <small>
                    <Localized
                      k="organization.interface.native_count_6e5b6a770"
                      slots={[
                        countLabel(r.memberCount, "people"),
                        "",
                        r.permissions.length,
                        r.denies.length ? uiText("organization.interface.value0_restricted_24d3f7d", { value0: r.denies.length }) : "",
                        r.extras && r.extras.autoAssign.mode !== "none" ? uiText("organization.interface.given_automatically_2537f55") : "",
                      ]}
                    />
                  </small>
                </button>
                <button className="btn btn-ghost btn-sm" aria-label={uiText("workspace.interface.people_with_value0_580891b", { value0: r.name })} onClick={() => setHolders(r)}>
                  <UsersRound size={14} />
                </button>
                {r.canEdit && (
                  <button
                    className="btn btn-ghost btn-sm"
                    aria-label={uiText("organization.interface.archive_value0_70e6dbe", { value0: r.name })}
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
        <Card title={uiText("organization.interface.archived_roles_6eed10b")} sub={uiText("organization.interface.they_grant_nothing_their_holders_keep_them_in_case_a_role_is_rest_497e8dc")}>
          <ul className="ws-list">
            {archived.map((r) => (
              <li key={r.id} className="ws-row">
                <span className="grow ellipsis">{r.name}</span>
                {r.canEdit && (
                  <>
                    <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => void act.act(() => updateRole(engine, r, { archived: false }).then(reload))}>
                      <Localized k="organization.interface.restore_e004112" slots={[<ArchiveRestore size={14} />]} />
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      aria-label={uiText("organization.interface.delete_value0_8782b77", { value0: r.name })}
                      disabled={act.busy}
                      onClick={() => void act.act(() => deleteRole(engine, r.id).then(reload))}
                    >
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
          label={uiText("organization.interface.create_role_221163d")}
          align="end"
          onClose={newMenu.close}
          entries={[
            {
              get label() {
                return uiText("organization.interface.blank_role_bb74e47");
              },
              onSelect: () => setEditing({ role: null }),
            },
            "separator" as const,
            {
              get heading() {
                return uiText("organization.interface.start_from_eb3f51d");
              },
            },
            ...o.templates.map((t) => ({ label: catalogText(`organization.builtIn.roleTemplates.${t.key}.name`, t.name), onSelect: () => setEditing({ role: null, template: t.key }) })),
          ]}
        />
      )}
      {editing && <RoleEditor orgId={orgId} overview={o} role={editing.role} template={editing.template} onSaved={reload} onClose={() => setEditing(null)} />}
      {everyone && o.everyone && <EveryoneDialog orgId={orgId} overview={o} everyone={o.everyone} onSaved={reload} onClose={() => setEveryoneOpen(false)} />}
      {holders && (
        <Dialog
          title={uiText("workspace.interface.people_with_value0_580891b", { value0: holders.name })}
          onClose={() => setHolders(null)}
          footer={
            <button className="btn btn-primary" onClick={() => setHolders(null)}>
              {l10n("common.actions.done")}
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
