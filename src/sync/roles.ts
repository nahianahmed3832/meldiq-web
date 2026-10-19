import { z } from "zod";
import type { Engine } from "./engine";

/**
 * Custom workspace roles (server docs/WORKSPACE_ROLES.md, API 0.6+): a role grants exactly the permissions it lists and
 * may restrict some; owners always hold everything. The catalog, templates and what this person may do come from the
 * server; every change is checked there again (anti-escalation rules), and refusals carry the reason to show.
 */
const zPermission = z.object({
  key: z.string(),
  category: z.string(),
  label: z.string(),
  description: z.string(),
  admin: z.boolean().default(false),
  ownerOnly: z.boolean().default(false),
  guestAllowed: z.boolean().default(false),
  restrictable: z.boolean().default(false),
});
export type PermissionDef = z.infer<typeof zPermission>;

const zTemplate = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  permissions: z.array(z.string()),
  denies: z.array(z.string()).default([]),
});
export type RoleTemplate = z.infer<typeof zTemplate>;

export const zRole = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  permissions: z.array(z.string()),
  denies: z.array(z.string()).default([]),
  rev: z.number(),
  memberCount: z.number().default(0),
  archived: z.boolean().default(false),
  canEdit: z.boolean().default(false),
  canAssign: z.boolean().default(false),
});
export type Role = z.infer<typeof zRole>;

const zRoles = z.object({
  catalog: z.array(zPermission),
  templates: z.array(zTemplate).default([]),
  baseRoles: z.array(z.object({ key: z.string(), name: z.string(), permissions: z.array(z.string()), memberCount: z.number().default(0) })).default([]),
  roles: z.array(zRole),
  limits: z.object({ activeRoles: z.number(), rolesPerMember: z.number(), nameMax: z.number(), descriptionMax: z.number() }).partial().default({}),
  me: z.object({ base: z.string(), permissions: z.array(z.string()), canManage: z.boolean(), canAssign: z.boolean(), canDelegate: z.boolean() }),
});
export type RolesOverview = z.infer<typeof zRoles>;

const zRoleOut = z.object({ role: zRole });
const zRoleMembers = z.object({ members: z.array(z.object({ id: z.string(), username: z.string(), displayName: z.string(), orgRole: z.string(), assignedAt: z.number() })) });
export type RoleMember = z.infer<typeof zRoleMembers>["members"][number];

const enc = encodeURIComponent;

export async function rolesOverview(engine: Engine, orgId: string, includeArchived = false): Promise<RolesOverview> {
  return engine.api.json("GET", `/v1/orgs/${enc(orgId)}/roles${includeArchived ? "?includeArchived=true" : ""}`, zRoles);
}

export interface RoleFields {
  name?: string;
  description?: string | null;
  color?: string | null;
  permissions?: string[];
  denies?: string[];
}

export async function createRole(engine: Engine, orgId: string, fields: RoleFields & { template?: string }): Promise<Role> {
  return (await engine.api.json("POST", `/v1/orgs/${enc(orgId)}/roles`, zRoleOut, { body: fields })).role;
}

/** A change based on the role's revision: if someone else changed it first the server answers 409 (role_stale). */
export async function updateRole(engine: Engine, role: Pick<Role, "id" | "rev">, fields: RoleFields & { archived?: boolean }): Promise<Role> {
  return (await engine.api.json("PATCH", `/v1/roles/${enc(role.id)}`, zRoleOut, { body: { baseRev: role.rev, ...fields } })).role;
}

/** Only an archived role can be deleted. */
export async function deleteRole(engine: Engine, roleId: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/roles/${enc(roleId)}`);
}

export async function roleMembers(engine: Engine, roleId: string): Promise<RoleMember[]> {
  return (await engine.api.json("GET", `/v1/roles/${enc(roleId)}/members`, zRoleMembers)).members;
}

export async function assignRole(engine: Engine, roleId: string, userId: string): Promise<void> {
  await engine.api.call("PUT", `/v1/roles/${enc(roleId)}/members/${enc(userId)}`, { body: {} });
}

export async function unassignRole(engine: Engine, roleId: string, userId: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/roles/${enc(roleId)}/members/${enc(userId)}`);
}

/** Hands the workspace to another member (owners only), after typing its exact name; the previous owner becomes an admin. */
export async function transferOwnership(engine: Engine, orgId: string, userId: string, confirmName: string): Promise<void> {
  await engine.api.call("POST", `/v1/orgs/${enc(orgId)}/ownership`, { body: { userId, confirmName } });
}

const zAudit = z.object({
  entries: z.array(
    z.object({ id: z.number(), at: z.number(), action: z.string(), actorId: z.string().nullable(), actorName: z.string().nullable(), target: z.string().nullable(), detail: z.string().nullable() }),
  ),
  nextBefore: z.number().nullable(),
});
export type AuditPage = z.infer<typeof zAudit>;

export async function auditLog(engine: Engine, orgId: string, before?: number | null, action?: string): Promise<AuditPage> {
  const q = new URLSearchParams({ limit: "50" });
  if (before) q.set("before", String(before));
  if (action) q.set("action", action);
  return engine.api.json("GET", `/v1/orgs/${enc(orgId)}/audit?${q}`, zAudit);
}

/** Which permissions are offered in the editor: what the person holds, never owner-only ones, admin ones only with delegate. */
export function grantable(p: PermissionDef, me: RolesOverview["me"]): boolean {
  if (p.ownerOnly) return false;
  if (p.admin && !me.canDelegate) return false;
  return me.base === "OWNER" || me.permissions.includes(p.key);
}
