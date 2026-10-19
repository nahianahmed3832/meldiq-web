import { z } from "zod";
import { zMember } from "../api/schemas";
import type { Engine } from "./engine";

/**
 * Branches and teams after they're made (android ScopeAdminViews): renaming, and who belongs with which role. Branch
 * roles are manager or member; team roles are lead or member. The server checks every change (authz canManageBranch,
 * canManageTeam) and audits it; the browser only offers what `canManage` says is allowed.
 */
export type ScopeKind = "branch" | "team";
export type ScopeRole = "MANAGER" | "LEAD" | "MEMBER";

export const leadRole = (kind: ScopeKind): ScopeRole => (kind === "branch" ? "MANAGER" : "LEAD");

const enc = encodeURIComponent;
const path = (kind: ScopeKind, id: string) => `/v1/${kind === "branch" ? "branches" : "teams"}/${enc(id)}`;

const zScopeMember = zMember.extend({ role: z.string().nullable().optional() });
export type ScopeMember = z.infer<typeof zScopeMember>;

export async function renameScope(engine: Engine, kind: ScopeKind, id: string, change: { name: string; location?: string | null }): Promise<void> {
  const body = kind === "branch" ? change : { name: change.name };
  await engine.api.call("PATCH", path(kind, id), { body });
}

export async function scopeMembers(engine: Engine, kind: ScopeKind, id: string): Promise<ScopeMember[]> {
  return (await engine.api.json("GET", `${path(kind, id)}/members`, z.object({ members: z.array(zScopeMember) }))).members;
}

/** Adds someone or changes their role; null removes them. */
export async function setScopeMember(engine: Engine, kind: ScopeKind, id: string, userId: string, role: ScopeRole | null): Promise<void> {
  if (role === null) await engine.api.call("DELETE", `${path(kind, id)}/members/${enc(userId)}`);
  else await engine.api.call("PUT", `${path(kind, id)}/members/${enc(userId)}`, { body: { role } });
}

// ───────────── departments: groups of one branch's teams, managed by the branch's managers ─────────────

export async function createDepartment(engine: Engine, branchId: string, name: string): Promise<void> {
  await engine.api.call("POST", `/v1/branches/${enc(branchId)}/departments`, { body: { name } });
}

export async function renameDepartment(engine: Engine, id: string, name: string): Promise<void> {
  await engine.api.call("PATCH", `/v1/departments/${enc(id)}`, { body: { name } });
}

/** Its teams stay in the branch, ungrouped. */
export async function deleteDepartment(engine: Engine, id: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/departments/${enc(id)}`);
}

export async function setTeamDepartment(engine: Engine, teamId: string, departmentId: string | null): Promise<void> {
  await engine.api.call("PATCH", `/v1/teams/${enc(teamId)}`, { body: { departmentId } });
}
