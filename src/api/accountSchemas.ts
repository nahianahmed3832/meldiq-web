import { z } from "zod";

/**
 * Orbit 2.0 account API answers (server/src/accounts, docs/ORBIT_2_ARCHITECTURE §6). Validated like every other server
 * answer; unknown fields are dropped.
 */

export const zAccountIdentity = z.object({ userId: z.string(), username: z.string(), identityKey: z.string() });

export const zAccountView = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  createdAt: z.number(),
  legacyLinkedAt: z.number().nullable(),
  selectedWorkspaceId: z.string().nullable(),
  identity: zAccountIdentity.nullable(),
});
export type AccountView = z.infer<typeof zAccountView>;

export const zAccountSession = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.number(),
  refreshToken: z.string(),
  refreshTokenExpiresAt: z.number(),
  session: z.object({ id: z.string(), deviceId: z.string().nullable(), createdAt: z.number() }),
  account: zAccountView,
});
export type AccountSessionGrant = z.infer<typeof zAccountSession>;

export const zAccountMe = z.object({ account: zAccountView, session: z.object({ id: z.string(), deviceId: z.string().nullable(), createdAt: z.number() }) });

export const zEnrollResult = z.object({ userId: z.string(), deviceId: z.string(), username: z.string(), result: z.enum(["identity", "device", "existing"]) });
export type EnrollResult = z.infer<typeof zEnrollResult>;

export const zSessionList = z.object({
  sessions: z.array(z.object({ id: z.string(), label: z.string().nullable(), deviceId: z.string().nullable(), createdAt: z.number(), lastUsedAt: z.number().nullable(), current: z.boolean() })),
});
export type AccountSessionRow = z.infer<typeof zSessionList>["sessions"][number];

export const zWorkspaceV2 = z.object({
  id: z.string(),
  kind: z.enum(["personal", "organization"]),
  name: z.string(),
  role: z.string().nullable().optional(),
  slug: z.string().nullable().optional(),
});
export const zWorkspacesV2 = z.object({ workspaces: z.array(zWorkspaceV2), selectedWorkspaceId: z.string().nullable() });

export const zAccepted = z.object({}).passthrough();
export const zOk = z.object({ ok: z.literal(true) });
export const zVerified = z.object({ verified: z.literal(true) });
export const zSelected = z.object({ selectedWorkspaceId: z.string().nullable() });
