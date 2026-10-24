import { z } from "zod";
import type { Engine } from "./engine";

/**
 * The work overview (server src/modules/workforce/workCenter.ts, API 0.41.0): what needs this person, what agents and
 * people are doing, what finished and failed in the last days, and what the agents' work cost. Managers see the
 * community; others their own requests and tasks. Each item names its job, task or approval to open.
 */
const enc = encodeURIComponent;

const zWorkItem = z.object({
  kind: z.enum(["job", "task"]),
  id: z.string(),
  title: z.string(),
  owner: z.object({ kind: z.enum(["agent", "person"]), id: z.string(), name: z.string() }),
  requestedBy: z.object({ id: z.string(), name: z.string() }),
  state: z.string(),
  at: z.number(),
  reason: z.string().nullable(),
  action: z.enum(["approve", "answer", "do", "review", "open"]),
  jobId: z.string().nullable(),
  taskId: z.string().nullable(),
  approvalId: z.string().nullable(),
  dueAt: z.number().nullable(),
  progress: z.number().nullable(),
  deliverables: z.number().nullable(),
  costMicro: z.number().nullable(),
  error: z.string().nullable(),
});
export type WorkItem = z.infer<typeof zWorkItem>;

const zWorkOverview = z.object({
  scope: z.enum(["mine", "all"]),
  attention: z.array(zWorkItem),
  active: z.array(zWorkItem),
  finished: z.array(zWorkItem),
  failed: z.array(zWorkItem),
  totals: z.object({ attention: z.number(), active: z.number(), finished: z.number(), failed: z.number(), requests: z.number(), modelRequests: z.number(), costMicro: z.number() }),
  health: z.object({ id: z.string(), worst: z.enum(["healthy", "warning", "failed", "not_configured", "not_tested"]), at: z.number(), failed: z.number(), warning: z.number() }).nullable(),
  days: z.number(),
});
export type WorkOverview = z.infer<typeof zWorkOverview>;

export const workOverview = async (e: Engine, orgId: string) => await e.api.json("GET", `/v1/orgs/${enc(orgId)}/ai/work`, zWorkOverview);

/** An estimated cost in micro-USD, as dollars: small amounts keep their cents' fractions. */
export function formatCost(micro: number): string {
  if (micro === 0) return "$0";
  const usd = micro / 1_000_000;
  return `$${usd >= 1 ? usd.toFixed(2) : usd >= 0.01 ? usd.toFixed(3) : usd.toFixed(4)}`;
}

export const ACTION_LABEL: Record<WorkItem["action"], string> = { approve: "Review and approve", answer: "Answer", do: "Open the task", review: "Review the work", open: "Open" };
