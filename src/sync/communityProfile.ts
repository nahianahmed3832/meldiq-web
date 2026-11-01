import { z } from "zod";
import type { Engine } from "./engine";
export const zCommunityProfile = z
  .object({
    aboutMe: z.string().max(300).nullable(),
    pronouns: z.string().max(40).nullable(),
    theme: z
      .array(z.string().regex(/^#[a-fA-F0-9]{6}$/))
      .min(1)
      .max(2)
      .nullable(),
  })
  .strict();
export type CommunityProfile = z.infer<typeof zCommunityProfile>;
const zView = z.object({ orgId: z.string(), userId: z.string(), rev: z.number(), own: z.boolean(), profile: zCommunityProfile.partial() });
export const emptyCommunityProfile: CommunityProfile = { aboutMe: null, pronouns: null, theme: null };
const path = (orgId: string, userId: string) => `/v1/orgs/${encodeURIComponent(orgId)}/members/${encodeURIComponent(userId)}/profile`;
export const communityProfile = (engine: Engine, orgId: string, userId: string) => engine.api.json("GET", path(orgId, userId), zView);
export const saveCommunityProfile = (engine: Engine, orgId: string, userId: string, baseRev: number, profile: CommunityProfile) =>
  engine.api.json("PUT", path(orgId, userId), zView, { body: { baseRev, profile } });
