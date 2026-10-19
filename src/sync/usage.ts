import { z } from "zod";
import type { Engine } from "./engine";

/**
 * Workspace usage (server docs/WORKSPACE_ROLES.md › Usage, `workspace.usage.view`) and its plan and limits (docs/PLANS.md):
 * real counts from the server, nothing estimated. No plans exist yet; server-wide limits, if the operator set any, are
 * shown as they are and no upgrade is offered.
 */
const n = z.number().int().nonnegative();
const zUsage = z.object({
  members: z.object({ total: n, owners: n, admins: n, members: n, guests: n }),
  structure: z.object({ branches: n, departments: n, teams: n, channels: n, archivedChannels: n }),
  files: z.object({ count: n, bytes: n }),
  invitations: z.object({ active: n }),
  roles: z.object({ custom: n }),
  apps: z.object({ installed: n, connectedAccounts: n.default(0), notifications: n.default(0), webhooks: n.default(0) }).passthrough(),
});
export type WorkspaceUsage = z.infer<typeof zUsage>;

const zPlan = z.object({
  plan: z.unknown().nullable(),
  capabilities: z.array(z.object({ key: z.string(), label: z.string(), limit: z.number().nullable(), used: z.number(), available: z.boolean() })).default([]),
});
export type WorkspacePlan = z.infer<typeof zPlan>;

const enc = encodeURIComponent;

export async function workspaceUsage(engine: Engine, orgId: string): Promise<WorkspaceUsage> {
  return engine.api.json("GET", `/v1/orgs/${enc(orgId)}/usage`, zUsage);
}

export async function workspacePlan(engine: Engine, orgId: string): Promise<WorkspacePlan> {
  return engine.api.json("GET", `/v1/orgs/${enc(orgId)}/plan`, zPlan);
}
