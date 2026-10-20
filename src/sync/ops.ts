import { z } from "zod";
import { ApiError } from "../api/client";
import type { Engine } from "./engine";

/**
 * Service health for platform administrators (server docs/OPERATIONS.md, android round 7 slice C1 ServiceHealthScreen):
 * what the server measures about itself. Only measured values; anything it can't measure comes as `available: false`
 * with the reason. No content, ids, addresses or secrets are in it. Read-only, fetched when the page opens or on Refresh.
 */
const n = z.number();
const measured = <T extends z.ZodRawShape>(shape: T) => z.union([z.object({ available: z.literal(true), ...shape }), z.object({ available: z.literal(false), reason: z.string() })]);

const zHealth = z.object({
  version: z.string(),
  generatedAt: n,
  uptimeSeconds: n,
  checks: z.object({
    database: measured({ ok: z.boolean(), sizeBytes: n }),
    mongodb: measured({ ok: z.boolean() }),
    livekit: measured({ configured: z.boolean() }),
    storage: measured({ backend: z.string(), reachable: z.boolean(), errorKind: z.string().optional() }),
  }),
  process: z.object({ rssBytes: n, heapUsedBytes: n, eventLoopDelayP99Ms: n.nullable() }),
  realtime: z.object({ onlineDevices: n }),
  queues: z.object({
    delivery: z.object({ items: n, oldestAgeSeconds: n.nullable() }),
    reminders: z.object({ overdueUndelivered: n, retrying: n }),
    integrations: measured({ jobsQueued: n, jobsDead: n, deliveriesFailed24h: n }),
  }),
  metrics: z.object({
    window: z.object({ minutes: n, requests: n, serverErrors: n, errorRate: n.nullable(), p95Ms: n.nullable() }),
    routes: z.array(z.object({ route: z.string(), count: n, clientErrors: n, serverErrors: n, avgMs: n, p95Ms: n.nullable(), maxMs: n })),
    jobs: z.array(z.object({ name: z.string(), runs: n, failures: n, lastDurationMs: n.nullable(), lastErrorKind: z.string().nullable() })),
    providers: z.array(z.object({ name: z.string(), ok: n, failed: n, lastErrorKind: z.string().nullable() })),
  }),
  warnings: z.array(z.string()),
});
export type Health = z.infer<typeof zHealth>;

/** Whether this account is a platform administrator (the server's PLATFORM_ADMIN_USER_IDS); never a workspace role. */
export async function isPlatformAdmin(engine: Engine): Promise<boolean> {
  return (await engine.api.json("GET", "/v1/platform/me", z.object({ platformAdmin: z.boolean() }))).platformAdmin;
}

export async function serviceHealth(engine: Engine): Promise<Health> {
  try {
    return (await engine.api.json("GET", "/v1/admin/health", z.object({ health: zHealth }))).health;
  } catch (e) {
    // Servers before round 7 have no health report.
    if (e instanceof ApiError && e.status === 404) throw new ApiError(404, "not_supported", "This server doesn't report its health yet: it needs a Meldiq API with operations reporting.");
    throw e;
  }
}

/** Requests worth a look: any server error, or a 95th percentile of a second or more (android: at most 8). */
export function busyRoutes(h: Health): Health["metrics"]["routes"] {
  return h.metrics.routes.filter((r) => r.serverErrors > 0 || (r.p95Ms ?? Number.MAX_SAFE_INTEGER) >= 1000).slice(0, 8);
}

/** "45 s", "12 min", "3 h", "2 days" (android ServiceHealthScreen.age). */
export function ageText(seconds: number): string {
  if (seconds < 120) return `${seconds} s`;
  if (seconds < 7200) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 172_800) return `${Math.floor(seconds / 3600)} h`;
  return `${Math.floor(seconds / 86_400)} days`;
}
