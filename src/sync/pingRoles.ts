import { z } from "zod";
import type { Engine } from "./engine";

export const PING_ROLES_FEATURE = "community-ping-roles";
export const PING_ROLE_LIMIT = 20;
export const PING_ROLE_NAME = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} _-]*$/u;
const pingRole = z.object({ id: z.string(), name: z.string() });
const settings = z.object({ rev: z.number().int(), roles: z.array(pingRole), subscribed: z.array(z.string()), canManage: z.boolean() });
export type PingRoleDraft = { id?: string; name: string };

const path = (orgId: string) => `/v1/orgs/${encodeURIComponent(orgId)}/ping-roles`;

export function pingRoles(engine: Engine, orgId: string) {
  return engine.api.json("GET", path(orgId), settings);
}
export async function savePingRoles(engine: Engine, orgId: string, rev: number, roles: PingRoleDraft[]) {
  const response = await engine.api.json("PUT", path(orgId), settings, { body: { rev, roles } });
  await engine.refreshAll();
  return response;
}
export function savePingSelection(engine: Engine, orgId: string, roles: string[]) {
  return engine.api.json("PUT", `${path(orgId)}/me`, settings, { body: { roles } });
}
