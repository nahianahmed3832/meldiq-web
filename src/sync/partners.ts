import { z } from "zod";
import type { Engine } from "./engine";
const checklist = z.object({ guidelines: z.boolean(), moderation: z.boolean(), safety: z.boolean(), activity: z.boolean() });
export const zPartnerApplication = z.object({
  orgId: z.string(),
  statement: z.string(),
  checklist,
  status: z.enum(["submitted", "approved", "declined"]),
  rev: z.number(),
  submittedAt: z.number(),
  reviewedAt: z.number().nullable(),
  reviewNote: z.string().nullable(),
});
export type PartnerApplication = z.infer<typeof zPartnerApplication>;
export type PartnerChecklist = z.infer<typeof checklist>;
const response = z.object({ application: zPartnerApplication.nullable() });
export async function partnerApplication(engine: Engine, orgId: string) {
  return (await engine.api.json("GET", `/v1/orgs/${encodeURIComponent(orgId)}/partner-application`, response)).application;
}
export async function submitPartnerApplication(engine: Engine, orgId: string, baseRev: number, statement: string, checklist: PartnerChecklist) {
  return (await engine.api.json("PUT", `/v1/orgs/${encodeURIComponent(orgId)}/partner-application`, response, { body: { baseRev, statement, checklist } })).application;
}

export const PARTNER_ELIGIBILITY_FEATURE = "partner-eligibility";
const eligibility = z.object({
  eligible: z.boolean(),
  activeSparks: z.number(),
  members: z.number(),
  hasRules: z.boolean(),
  activeMods: z.number(),
  verification: z.string(),
  ageDays: z.number(),
  cleanStanding: z.boolean(),
});
export type PartnerEligibility = z.infer<typeof eligibility>;
export function partnerEligibility(engine: Engine, orgId: string) {
  return engine.api.json("GET", `/v1/orgs/${encodeURIComponent(orgId)}/partner-eligibility`, eligibility);
}
