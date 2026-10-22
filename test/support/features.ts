import type { Server } from "./live";

/** Features the test server advertises (round 7 suites skip themselves on servers without theirs). */
export async function serverFeatures(server: Server): Promise<string[]> {
  const info = (await (await fetch(`${server.baseUrl}/v1/server-info`)).json()) as { features?: string[] };
  return info.features ?? [];
}

type AdminConfig = { platformAdmins?: Set<string>; integrations?: { platformAdmins: Set<string> } };

/**
 * Makes [userId] a platform administrator on an in-process test server (as the server's own tests do). The list moved
 * from the integrations settings to the top of the config when integrations were retired (API 0.12).
 */
export function makePlatformAdmin(server: Server, userId: string): void {
  const config = (server.ctx as unknown as { config: AdminConfig }).config;
  (config.platformAdmins ?? config.integrations?.platformAdmins)?.add(userId);
}
