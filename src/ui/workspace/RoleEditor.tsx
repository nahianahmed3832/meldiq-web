import { useMemo, useState } from "react";
import { Toggle } from "../components/Toggle";
import { useEngine, useOrbit } from "../../application/orbit";
import { createRole, grantable, type PermissionDef, type Role, type RolesOverview, updateRole } from "../../sync/roles";
import { Dialog } from "../components/Overlay";
import { ErrorLine } from "./WorkspaceView";
import { useAction } from "./useLoad";

const CATEGORY_LABEL: Record<string, string> = {
  workspace: "Community",
  members: "Members",
  roles: "Roles",
  teams: "Branches and teams",
  channels: "Channels",
  messaging: "Messaging",
  integrations: "Apps",
  security: "Security",
};
const COLORS = ["#E39B7B", "#7C9CE3", "#6FBF8E", "#C58BE0", "#E3C26F", "#6FC6C9", "#E37B9B", "#8C8FA3"];

/**
 * Making or changing a custom role (android ui/screens/workspace/roles, server docs/WORKSPACE_ROLES.md): its name, colour
 * and description, what it grants and what it restricts. Only powers this person may hand out are offered (owner-only
 * never, administrative ones only with delegation); the server checks everything again and its reason is shown.
 */
export function RoleEditor({
  orgId,
  overview,
  role,
  template,
  onSaved,
  onClose,
}: {
  orgId: string;
  overview: RolesOverview;
  role: Role | null;
  template?: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const engine = useEngine();
  const start = role ?? overview.templates.find((t) => t.key === template) ?? null;
  const [name, setName] = useState(role?.name ?? (start && "name" in start ? start.name : ""));
  const [description, setDescription] = useState(start?.description ?? "");
  const [color, setColor] = useState(start?.color ?? COLORS[0]);
  const [grants, setGrants] = useState<Set<string>>(new Set(start?.permissions ?? []));
  const [denies, setDenies] = useState<Set<string>>(new Set(start?.denies ?? []));
  const hoistable = useOrbit((s) => s.server?.features.includes("role-hoist") ?? false);
  const [hoist, setHoist] = useState(role?.hoist ?? false);
  const act = useAction();
  const byCategory = useMemo(() => {
    const m = new Map<string, PermissionDef[]>();
    for (const p of overview.catalog) m.set(p.category, [...(m.get(p.category) ?? []), p]);
    return [...m.entries()];
  }, [overview.catalog]);
  const readOnly = role !== null && !role.canEdit;

  const toggle = (set: Set<string>, key: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(key);
    else next.delete(key);
    return next;
  };
  const save = () =>
    void act.act(async () => {
      const fields = { name: name.trim(), description: description.trim() || null, color, permissions: [...grants], denies: [...denies], ...(hoistable ? { hoist } : {}) };
      if (role) await updateRole(engine, role, fields);
      else await createRole(engine, orgId, { ...fields, ...(template ? { template } : {}) });
      onSaved();
      onClose();
    });

  return (
    <Dialog
      title={role ? (readOnly ? role.name : `Edit ${role.name}`) : "New role"}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </button>
          {!readOnly && (
            <button className="btn btn-primary" disabled={!name.trim() || act.busy} onClick={save}>
              {act.busy ? "Saving…" : "Save role"}
            </button>
          )}
        </>
      }
    >
      <div className="dialog-body">
        <ErrorLine text={act.error} />
        {readOnly && <div className="banner info">This role carries powers beyond yours, so you can see it but not change it.</div>}
        <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="field" style={{ flex: "1 1 220px" }}>
            <span>Name</span>
            <input className="input" value={name} maxLength={overview.limits.nameMax ?? 40} disabled={readOnly} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <div className="field">
            <span>Colour</span>
            <div className="row" style={{ gap: 4 }} role="radiogroup" aria-label="Colour">
              {COLORS.map((c) => (
                <button key={c} role="radio" aria-checked={color === c} aria-label={c} disabled={readOnly} className="role-swatch" style={{ background: c }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>
        </div>
        {hoistable && (
          <div className="setting">
            <span className="lines">
              <strong>Show members separately</strong>
              <small>People with this role are listed under its name in the member list, in role order.</small>
            </span>
            <Toggle checked={hoist} onChange={setHoist} label="Show members separately" />
          </div>
        )}
        <label className="field">
          <span>Description</span>
          <input
            className="input"
            value={description}
            maxLength={overview.limits.descriptionMax ?? 200}
            disabled={readOnly}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this role is for"
          />
        </label>
        {byCategory.map(([category, perms]) => (
          <fieldset key={category} className="perm-group">
            <legend>{CATEGORY_LABEL[category] ?? category}</legend>
            {perms.map((p) => {
              const can = !readOnly && grantable(p, overview.me);
              return (
                <div key={p.key} className="perm-row">
                  <div className="lines grow">
                    <span>
                      {p.label}
                      {p.admin && (
                        <span className="tag" style={{ marginLeft: 6 }}>
                          Admin
                        </span>
                      )}
                      {p.ownerOnly && (
                        <span className="tag" style={{ marginLeft: 6 }}>
                          Owners only
                        </span>
                      )}
                    </span>
                    <small>{p.description}</small>
                  </div>
                  <label className="perm-choice">
                    <input type="checkbox" checked={grants.has(p.key)} disabled={!can} onChange={(e) => setGrants(toggle(grants, p.key, e.target.checked))} />
                    Grant
                  </label>
                  {p.restrictable && (
                    <label className="perm-choice">
                      <input
                        type="checkbox"
                        checked={denies.has(p.key)}
                        disabled={readOnly || !(overview.me.base === "OWNER" || overview.me.permissions.includes(p.key))}
                        onChange={(e) => setDenies(toggle(denies, p.key, e.target.checked))}
                      />
                      Restrict
                    </label>
                  )}
                </div>
              );
            })}
          </fieldset>
        ))}
        <span className="hint">A role grants only what's ticked; restrictions win over grants. Owners always keep every power.</span>
      </div>
    </Dialog>
  );
}
