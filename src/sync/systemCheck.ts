import { z } from "zod";
import type { Engine } from "./engine";

/**
 * Run Full System Check for a community (server src/modules/workforce/health, API 0.41.0): people with "Manage AI
 * agents" run one action that checks configuration, runtime and safe smoke tests, and read its history. Each item says
 * what was observed; "not_tested" means it couldn't be proved safely, with why. Statuses, counts and ids only.
 */
const enc = encodeURIComponent;

export const CHECK_STATUSES = ["failed", "warning", "not_configured", "not_tested", "healthy"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];
const zStatus = z.enum(["healthy", "warning", "failed", "not_configured", "not_tested"]);

export const zCheckItem = z.object({
  key: z.string(),
  level: z.enum(["configuration", "runtime", "smoke"]),
  title: z.string(),
  status: zStatus,
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  evidence: z.string(),
  at: z.number(),
  impacts: z.array(z.string()),
  cause: z.string().nullable(),
  remediation: z.string().nullable(),
  owner: z.enum(["platform_operator", "community_admin"]).nullable(),
  verified: z.boolean(),
  links: z.object({ jobs: z.array(z.string()).optional(), tasks: z.array(z.string()).optional(), installId: z.string().optional(), triggers: z.array(z.string()).optional() }),
});
export type CheckItem = z.infer<typeof zCheckItem>;

const zCounts = z.object({ healthy: z.number(), warning: z.number(), failed: z.number(), not_configured: z.number(), not_tested: z.number() });
export const zCheckSummary = z.object({
  id: z.string(),
  scope: z.enum(["community", "platform"]),
  requestedBy: z.string(),
  startedAt: z.number(),
  finishedAt: z.number(),
  worst: zStatus,
  summary: zCounts,
});
export type CheckSummary = z.infer<typeof zCheckSummary>;
export const zCheckReport = zCheckSummary.extend({ orgId: z.string().nullable(), items: z.array(zCheckItem) });
export type CheckReport = z.infer<typeof zCheckReport>;

export const STATUS_LABEL: Record<CheckStatus, string> = {
  healthy: "Healthy",
  warning: "Needs attention",
  failed: "Failed",
  not_configured: "Not set up",
  not_tested: "Not tested",
};

export const LEVEL_LABEL: Record<CheckItem["level"], string> = { configuration: "Configuration", runtime: "Running", smoke: "Smoke tests" };

export const runSystemCheck = async (e: Engine, orgId: string) => (await e.api.json("POST", `/v1/orgs/${enc(orgId)}/ai/system-check`, z.object({ report: zCheckReport }))).report;

export const systemChecks = async (e: Engine, orgId: string) =>
  await e.api.json("GET", `/v1/orgs/${enc(orgId)}/ai/system-check`, z.object({ latest: zCheckReport.nullable(), history: z.array(zCheckSummary) }));

export const systemCheckReport = async (e: Engine, orgId: string, checkId: string) =>
  (await e.api.json("GET", `/v1/orgs/${enc(orgId)}/ai/system-check/${enc(checkId)}`, z.object({ report: zCheckReport }))).report;

/** The report as a file to save or share: already sanitized by the server (no content, no secrets). */
export function reportFile(r: CheckReport): { name: string; text: string } {
  const at = new Date(r.startedAt).toISOString().replace(/[:.]/g, "-");
  return { name: `meldiq-system-check-${at}.json`, text: `${JSON.stringify(r, null, 2)}\n` };
}
