import type { Server } from "./live";

/** Features the test server advertises (round 7 suites skip themselves on servers without theirs). */
export async function serverFeatures(server: Server): Promise<string[]> {
  const info = (await (await fetch(`${server.baseUrl}/v1/server-info`)).json()) as { features?: string[] };
  return info.features ?? [];
}

/** Makes [userId] a platform administrator on an in-process test server (as the server's own tests do). */
export function makePlatformAdmin(server: Server, userId: string): void {
  (server.ctx as unknown as { config: { integrations: { platformAdmins: Set<string> } } }).config.integrations.platformAdmins.add(userId);
}
