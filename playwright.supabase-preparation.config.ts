import { defineConfig } from "@playwright/test";
import base from "./playwright.identity.config";
const servers = Array.isArray(base.webServer) ? base.webServer : [];
export default defineConfig({
  ...base,
  testMatch: "supabase-preparation.spec.ts",
  use: { ...base.use, serviceWorkers: "block" },
  webServer: [servers[0], { ...servers[1], env: { ...servers[1].env, MELDIQ_SUPABASE_PREVIEW: "1" } }],
});
