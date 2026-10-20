import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "../src/api/client";
import type { Engine } from "../src/sync/engine";
import { isPlatformAdmin, serviceHealth } from "../src/sync/ops";
import { makePlatformAdmin, serverFeatures } from "./support/features";
import { linkBrowser, type Phone, type Server, startServer } from "./support/live";

/** Service health (android round 7 C1): platform administrators only; measured values or "not measured". */
let server: Server;
let admin: Phone;
let member: Phone;
let adminWeb: Engine;
let memberWeb: Engine;
let round7 = false;

beforeAll(async () => {
  server = await startServer();
  round7 = (await serverFeatures(server)).includes("search");
  admin = await server.client("ops", "Ops");
  member = await server.client("mia", "Mia");
  makePlatformAdmin(server, admin.userId);
  adminWeb = (await linkBrowser(server, admin)).engine;
  memberWeb = (await linkBrowser(server, member)).engine;
});
afterAll(async () => {
  adminWeb?.stop();
  memberWeb?.stop();
  await server?.close();
});

describe("service health", () => {
  it("only platform administrators see it; the report holds measured values and says what isn't measured", async (t) => {
    expect(await isPlatformAdmin(adminWeb)).toBe(true);
    expect(await isPlatformAdmin(memberWeb)).toBe(false);
    if (!round7) {
      // Servers before round 7: an explained refusal, not a broken page.
      const e = await serviceHealth(adminWeb).catch((x: unknown) => x);
      expect((e as ApiError).message).toMatch(/doesn't report its health/);
      return t.skip();
    }
    const h = await serviceHealth(adminWeb);
    expect(h.checks.database).toMatchObject({ available: true, ok: true });
    expect(h.checks.mongodb).toMatchObject({ available: false });
    expect(h.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(h.metrics.window.requests).toBeGreaterThan(0);
    // Nothing personal: routes are templates, never paths with ids.
    expect(JSON.stringify(h)).not.toContain(admin.userId);
    const refused = await serviceHealth(memberWeb).catch((x: unknown) => x);
    expect(refused).toBeInstanceOf(ApiError);
    expect((refused as ApiError).status).toBe(403);
  });
});
