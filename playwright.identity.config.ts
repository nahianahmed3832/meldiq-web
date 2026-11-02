import { defineConfig } from "@playwright/test";
import base from "./playwright.rules.config";
const servers = Array.isArray(base.webServer) ? base.webServer : [];
export default defineConfig({
  ...base,
  testMatch: "community-identity.spec.ts",
  expect: { timeout: 20_000 },
  webServer: [servers[0], { ...servers[1], command: `node scripts/web-server.ts ${process.env.ORBIT_E2E_STATIC_DIR ?? "dist"} ${process.env.ORBIT_E2E_WEB_PORT ?? 5181}` }],
});
