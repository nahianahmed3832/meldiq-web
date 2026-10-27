import { z } from "zod";
import { ApiError } from "../api/client";
import type { Engine } from "./engine";

/**
 * Workspace usage (server docs/WORKSPACE_ROLES.md › Usage, `workspace.usage.view`) and its plan and limits (docs/PLANS.md):
 * real counts from the server, nothing estimated. No plans exist yet; server-wide limits, if the operator set any, are
 * shown as they are and no upgrade is offered.
 */
const n = z.number().int().nonnegative();
const zUsage = z.object({
  members: z.object({ total: n, owners: n, admins: n, members: n, guests: n }),
  /** Branches, departments and teams are zero on community servers (they became roles and categories); categories since then. */
  structure: z.object({ branches: n.default(0), departments: n.default(0), teams: n.default(0), categories: n.optional(), channels: n, archivedChannels: n }),
  files: z.object({ count: n, bytes: n }),
  invitations: z.object({ active: n }),
  roles: z.object({ custom: n }),
  /** Apps were removed with the community rebuild (API 0.12): community servers leave this out. */
  apps: z
    .object({ installed: n, connectedAccounts: n.default(0), notifications: n.default(0), webhooks: n.default(0) })
    .passthrough()
    .optional(),
  /** Round 7 (docs/USAGE_AND_PLANS.md): what the server measured per UTC day; counts and sizes only. */
  metered: z
    .object({
      days: n,
      metrics: z.array(z.object({ metric: z.string(), label: z.string(), kind: z.string(), total: z.number(), daily: z.array(z.object({ day: z.string(), value: z.number() })).default([]) })),
    })
    .optional(),
});
export type WorkspaceUsage = z.infer<typeof zUsage>;

const zPlan = z.object({
  plan: z.unknown().nullable(),
  capabilities: z.array(z.object({ key: z.string(), label: z.string(), limit: z.number().nullable(), used: z.number(), available: z.boolean(), source: z.string().default("server") })).default([]),
});
export type WorkspacePlan = z.infer<typeof zPlan>;

const enc = encodeURIComponent;

export async function workspaceUsage(engine: Engine, orgId: string): Promise<WorkspaceUsage> {
  return engine.api.json("GET", `/v1/orgs/${enc(orgId)}/usage`, zUsage);
}

export async function workspacePlan(engine: Engine, orgId: string): Promise<WorkspacePlan> {
  return engine.api.json("GET", `/v1/orgs/${enc(orgId)}/plan`, zPlan);
}

/** The limits a platform admin may set per workspace, as the server names them (it refuses unknown ones). */
export const LIMIT_LABEL: Record<string, string> = {
  members: "Members (including guests)",
  "storage.bytes": "Stored file bytes",
  workflows: "Workflows",
  documents: "Documents",
  groups: "User groups",
  api_keys: "Active API keys",
  "webhooks.outgoing": "Outgoing webhooks",
  "integrations.installed": "Installed apps",
  "integrations.webhooks": "Incoming webhooks",
  "integrations.notifications": "App notifications in channels",
  "roles.custom": "Custom roles",
};

/** Sizes are bytes; everything else is a count. */
export const isBytes = (key: string): boolean => key.endsWith("bytes");

// ───────────── Platform administrators (round 7 C7; the server checks every call) ─────────────

const zAdminUsage = z.object({
  days: n,
  workspaces: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      createdAt: z.number(),
      usage: z.record(z.string(), z.number()),
      limits: z.array(z.object({ key: z.string(), limit: z.number() })),
    }),
  ),
});
export type AdminUsage = z.infer<typeof zAdminUsage>;

/** Every workspace with its measured totals over [days] and its own limits: counts only, no content or names of members. */
export async function adminUsage(engine: Engine, days: number): Promise<AdminUsage> {
  try {
    return await engine.api.json("GET", `/v1/admin/usage?days=${days}`, zAdminUsage);
  } catch (e) {
    // Servers before round 7 measure no usage (and advertise no feature for it).
    if (e instanceof ApiError && e.status === 404) throw new ApiError(404, "not_supported", "This server doesn't measure workspace usage yet: it needs a Meldiq API with usage metering.");
    throw e;
  }
}
/** A workspace's own limits (platform admins only; audited). null clears one, so the server-wide limit applies again. */
export async function setWorkspaceLimits(engine: Engine, orgId: string, limits: Record<string, number | null>): Promise<{ key: string; limit: number }[]> {
  return (await engine.api.json("PUT", `/v1/admin/orgs/${enc(orgId)}/limits`, z.object({ limits: z.array(z.object({ key: z.string(), limit: z.number() })) }), { body: { limits } })).limits;
}
