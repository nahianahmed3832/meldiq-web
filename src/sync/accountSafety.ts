import { z } from "zod";
import type { ApiClient } from "../api/client";

/**
 * Account safety (API 0.46.0, meldiq docs/ACCOUNT_SAFETY.md): two-step sign-in, changing the email, account standing
 * and bug reports. The server checks everything again; this only calls it and reads its answers.
 */

export const zTotpStatus = z.object({ available: z.boolean(), enabled: z.boolean(), enabledAt: z.number().nullable(), backupCodesLeft: z.number() });
export type TotpStatus = z.infer<typeof zTotpStatus>;

export const STANDING_LEVELS = ["good", "limited", "very_limited", "suspended"] as const;
export type StandingLevel = (typeof STANDING_LEVELS)[number];
export const zStanding = z.object({
  level: z.enum(STANDING_LEVELS).catch("good"),
  warnings: z.array(z.object({ id: z.string(), reason: z.string(), createdAt: z.number(), expiresAt: z.number() })),
});
export type Standing = z.infer<typeof zStanding>;

export const BUG_STATUS_LABEL: Record<string, string> = { open: "Open", confirmed: "Confirmed", fixed: "Fixed", not_a_bug: "Not a bug", duplicate: "Duplicate" };
export const zBugReport = z.object({
  id: z.string(),
  summary: z.string(),
  details: z.string(),
  page: z.string().nullable(),
  status: z.string(),
  staffNote: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type BugReport = z.infer<typeof zBugReport>;

export class AccountSafetyApi {
  constructor(private readonly api: ApiClient) {}

  totpStatus(): Promise<TotpStatus> {
    return this.api.json("GET", "/v2/account/totp", zTotpStatus);
  }
  totpSetup(password: string): Promise<{ secret: string; uri: string }> {
    return this.api.json("POST", "/v2/account/totp/setup", z.object({ secret: z.string(), uri: z.string() }), { body: { password } });
  }
  totpEnable(code: string): Promise<{ backupCodes: string[] }> {
    return this.api.json("POST", "/v2/account/totp/enable", z.object({ backupCodes: z.array(z.string()) }), { body: { code } });
  }
  async totpDisable(password: string, code: string): Promise<void> {
    await this.api.call("POST", "/v2/account/totp/disable", { body: { password, code } });
  }
  emailChangeStart(password: string, newEmail: string): Promise<{ email: string; expiresAt: number }> {
    return this.api.json("POST", "/v2/account/email", z.object({ email: z.string(), expiresAt: z.number() }), { body: { password, newEmail } });
  }
  emailChangeConfirm(code: string): Promise<{ email: string }> {
    return this.api.json("POST", "/v2/account/email/confirm", z.object({ email: z.string() }), { body: { code } });
  }
  standing(): Promise<Standing> {
    return this.api.json("GET", "/v2/account/standing", zStanding);
  }
  bugReports(): Promise<{ reports: BugReport[]; bugHunter: boolean }> {
    return this.api.json("GET", "/v1/bug-reports", z.object({ reports: z.array(zBugReport), bugHunter: z.boolean() }));
  }
  reportBug(summary: string, details: string, page: string, client: string): Promise<{ report: BugReport }> {
    return this.api.json("POST", "/v1/bug-reports", z.object({ report: zBugReport }), { body: { summary, details, page, client } });
  }
}

/** "n***@gmail.com": the first letter and the domain, as the reference's email row shows it until Reveal. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***${email.slice(at)}`;
}
