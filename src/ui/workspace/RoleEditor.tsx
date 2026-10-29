import { IdCard } from "lucide-react";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { PARITY_FEATURES } from "../../sync/communityParity";
import { autoRoleProblem } from "../../sync/permissionGroups";
import { type AutoAssign, createRole, grantable, type Role, type RoleExtrasChange, type RolesOverview, setRoleExtras, updateRole } from "../../sync/roles";
import { Dialog } from "../components/Overlay";
import { RoleDisplayTab, type RoleDraft, ROLE_COLORS } from "./RoleDisplayTab";
import { RoleMembersList } from "./RoleMembers";
import { PermissionChecklist } from "./RolePermissionsTab";
import { useAction } from "./useLoad";
import { ErrorLine } from "./WorkspaceView";

type Tab = "display" | "permissions" | "members";

const dayInput = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString().slice(0, 10) : "");
const dayMs = (day: string) => (day ? Date.parse(`${day}T00:00:00Z`) : null);

function startDraft(overview: RolesOverview, role: Role | null, template?: string): RoleDraft {
  const t = role ? null : (overview.templates.find((x) => x.key === template) ?? null);
  const from = role ?? t;
  return {
    name: role?.name ?? t?.name ?? "",
    description: from?.description ?? "",
    color: from ? (from.color ?? null) : ROLE_COLORS[0],
    color2: role?.extras?.color2 ?? null,
    hoist: role?.hoist ?? false,
    mentionable: role?.extras?.mentionable ?? false,
    autoMode: role?.extras?.autoAssign.mode ?? "none",
    autoBefore: dayInput(role?.extras?.autoAssign.before),
    grants: new Set(from?.permissions ?? []),
    denies: new Set(from?.denies ?? []),
  };
}

/** What changed in the extras, or null when nothing did (only sent to servers with community-permissions). */
function extrasChange(draft: RoleDraft, role: Role | null): RoleExtrasChange | null {
  const auto: AutoAssign = { mode: draft.autoMode, before: draft.autoMode === "joined_before" ? dayMs(draft.autoBefore) : null };
  const was = role?.extras ?? { color2: null, mentionable: false, autoAssign: { mode: "none", before: null } };
  const change: RoleExtrasChange = {};
  if ((draft.color ? draft.color2 : null) !== was.color2) change.color2 = draft.color ? draft.color2 : null;
  if (draft.mentionable !== was.mentionable) change.mentionable = draft.mentionable;
  if (auto.mode !== was.autoAssign.mode || auto.before !== was.autoAssign.before) change.autoAssign = auto;
  return Object.keys(change).length ? change : null;
}

const toggled = (set: ReadonlySet<string>, key: string, on: boolean): Set<string> => {
  const next = new Set(set);
  if (on) next.add(key);
  else next.delete(key);
  return next;
};

/**
 * Making or changing a custom role (the reference's role editor; server docs/WORKSPACE_ROLES.md and
 * COMMUNITY_PERMISSIONS.md): Display, Permissions and Manage Members tabs, "Edit role - NAME", Copy role ID. Only powers
 * this person may hand out are offered; the server checks everything again and its reason is shown.
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
  const features = useOrbit((s) => s.server?.features ?? []);
  const extras = features.includes(PARITY_FEATURES.permissions);
  const [draft, setDraft] = useState<RoleDraft>(() => startDraft(overview, role, template));
  const [tab, setTab] = useState<Tab>("display");
  const act = useAction();
  const readOnly = role !== null && !role.canEdit;
  const patch = (change: Partial<RoleDraft>) => setDraft((d) => ({ ...d, ...change }));
  const problem = extras ? autoRoleProblem(draft.autoMode, draft.grants.size, draft.denies.size) : null;
  const holds = (key: string) => overview.me.base === "OWNER" || overview.me.permissions.includes(key);

  const save = () =>
    void act.act(async () => {
      const fields = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        color: draft.color,
        permissions: [...draft.grants],
        denies: [...draft.denies],
        ...(features.includes("role-hoist") ? { hoist: draft.hoist } : {}),
      };
      const saved = role ? await updateRole(engine, role, fields) : await createRole(engine, orgId, { ...fields, ...(template ? { template } : {}) });
      const change = extras ? extrasChange(draft, role) : null;
      if (change) await setRoleExtras(engine, saved.id, change);
      onSaved();
      onClose();
    });
  const copyId = () => {
    if (!role) return;
    void navigator.clipboard?.writeText(role.id).catch(() => undefined);
    engine.notice("info", "Role ID copied.");
  };

  return (
    <Dialog
      title={role ? (readOnly ? role.name : `Edit role - ${role.name}`) : "New role"}
      onClose={onClose}
      wide
      footer={
        <>
          {!readOnly && <span className="faint grow">Changes are saved when you press Save.</span>}
          <button className="btn btn-secondary" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </button>
          {!readOnly && (
            <button className="btn btn-primary" disabled={!draft.name.trim() || act.busy || !!problem} onClick={save}>
              {act.busy ? "Saving…" : "Save"}
            </button>
          )}
        </>
      }
    >
      <div className="dialog-body">
        <ErrorLine text={act.error} />
        {readOnly && <div className="banner info">This role carries powers beyond yours, so you can see it but not change it.</div>}
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <div className="role-tabs grow" role="tablist" aria-label="Role">
            {(["display", "permissions", ...(role ? (["members"] as const) : [])] as Tab[]).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                {t === "display" ? "Display" : t === "permissions" ? "Permissions" : "Manage Members"}
              </button>
            ))}
          </div>
          {role && (
            <button className="btn btn-ghost btn-sm" onClick={copyId}>
              <IdCard size={14} /> Copy role ID
            </button>
          )}
        </div>
        {tab === "display" && (
          <RoleDisplayTab
            draft={draft}
            patch={patch}
            readOnly={readOnly}
            nameMax={overview.limits.nameMax ?? 40}
            descriptionMax={overview.limits.descriptionMax ?? 200}
            extras={extras}
            hoistable={features.includes("role-hoist")}
          />
        )}
        {tab === "permissions" && (
          <>
            <PermissionChecklist
              catalog={overview.catalog}
              grants={draft.grants}
              denies={draft.denies}
              canChange={(p) => !readOnly && grantable(p, overview.me)}
              canDeny={(p) => !readOnly && holds(p.key)}
              onGrant={(key, on) => patch({ grants: toggled(draft.grants, key, on) })}
              onDeny={(key, on) => patch({ denies: toggled(draft.denies, key, on) })}
              onClear={readOnly ? undefined : () => patch({ grants: new Set(), denies: new Set() })}
            />
            <span className="hint">A role grants only what's ticked; restrictions win over grants. Owners always keep every power.</span>
          </>
        )}
        {tab === "members" && role && <RoleMembersList orgId={orgId} role={role} canAssign={overview.me.canAssign && role.canAssign} onChanged={onSaved} />}
      </div>
    </Dialog>
  );
}
