import { z } from "zod";
import { ApiError } from "../api/client";

const doc = z.object({ revision: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/), url: z.string().max(2048) });
const zRegistrationPolicy = z
  .object({ minimumAge: z.literal(13), terms: doc, privacy: doc })
  .refine((p) => (["terms", "privacy"] as const).every((kind) => p[kind].url === `https://meldiq.app/legal/${kind}/${encodeURIComponent(p[kind].revision)}`));
export const zRegistrationPolicyResponse = z.object({ policy: zRegistrationPolicy.nullable() });
export type RegistrationPolicy = z.infer<typeof zRegistrationPolicy>;

export function acceptRegistrationPolicy(policy: RegistrationPolicy) {
  return { termsRevision: policy.terms.revision, privacyRevision: policy.privacy.revision, ageAtLeast13: true, termsAccepted: true, privacyAcknowledged: true } as const;
}
export type RegistrationAcceptance = ReturnType<typeof acceptRegistrationPolicy>;

export function requestedRegistrationPolicy(error: unknown): RegistrationPolicy | null {
  if (!(error instanceof ApiError) || error.status !== 409 || error.code !== "conflict") return null;
  const result = z.object({ requirement: z.literal("signup_policy"), policy: zRegistrationPolicy }).safeParse(error.details);
  return result.success ? result.data.policy : null;
}
