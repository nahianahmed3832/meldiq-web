import { z } from "zod";
import type { Engine } from "./engine";

/** The most people one request adds (the server's limit). */
export const MAX_ADD = 20;

export type AddOutcome = "added" | "already_member" | "not_available";

const zResult = z.object({
  results: z.array(z.object({ userId: z.string(), outcome: z.enum(["added", "already_member", "not_available"]) })).max(MAX_ADD),
});

/** Adds existing accounts to a community directly (POST /v1/orgs/:orgId/members, servers from 2026-10-26). */
export async function addMembers(engine: Engine, orgId: string, userIds: string[]): Promise<{ userId: string; outcome: AddOutcome }[]> {
  const body = { userIds: [...new Set(userIds)].slice(0, MAX_ADD) };
  return (await engine.api.json("POST", `/v1/orgs/${encodeURIComponent(orgId)}/members`, zResult, { body })).results;
}
