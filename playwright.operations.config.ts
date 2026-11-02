import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
const api = Number(process.env.ORBIT_E2E_API_PORT ?? 8091),
  web = Number(process.env.ORBIT_E2E_WEB_PORT ?? 5181);
const servers = Array.isArray(base.webServer) ? base.webServer : [];
const backend = servers[0];
export default defineConfig({
  ...base,
  testMatch: "platform-operations.spec.ts",
  projects: base.projects?.filter((p) => ["chromium", "phone-width"].includes(p.name ?? "")),
  webServer: [
    {
      ...backend,
      command: `node ${process.env.ORBIT_SERVER_DIR}/dist/index.js`,
      env: {
        ...backend.env,
        REGISTRATION_MODE: "open",
        APP_ENV: "development",
        MAIL_TRANSPORT: "file",
        MAIL_FILE_DIR: process.env.ORBIT_E2E_DATA + "/mail",
        STORAGE_BACKEND: "local",
        DATABASE_MODE: "hybrid",
        MONGODB_URI: "",
        MONGODB_DOMAINS: "",
        REDIS_URL: "",
        BILLING_PROVIDER: "sandbox",
        BILLING_SANDBOX_WEBHOOK_SECRET: "browser-operations-sandbox-only-0123456789",
      },
    },
    { command: `node scripts/web-server.ts dist ${web}`, url: `http://127.0.0.1:${web}`, reuseExistingServer: false, env: { ORBIT_API_URL: `http://127.0.0.1:${api}`, ORBIT_E2E_FORWARD: "1" } },
  ],
});
