import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
const servers = Array.isArray(base.webServer) ? base.webServer : [];
export default defineConfig({
  ...base,
  testMatch: "rules-channel.spec.ts",
  projects: base.projects?.filter((p) => ["chromium", "webkit"].includes(p.name ?? "")),
  webServer: [
    {
      ...servers[0],
      command: `node ${process.env.ORBIT_SERVER_DIR}/dist/index.js`,
      env: {
        ...servers[0].env,
        REGISTRATION_MODE: "open",
        APP_ENV: "development",
        MAIL_TRANSPORT: "file",
        MAIL_FILE_DIR: process.env.ORBIT_E2E_DATA + "/mail",
        STORAGE_BACKEND: "local",
        DATABASE_MODE: "hybrid",
        MONGODB_URI: "",
        MONGODB_DOMAINS: "",
        REDIS_URL: "",
      },
    },
    {
      command: `node scripts/web-server.ts dist ${process.env.ORBIT_E2E_WEB_PORT ?? 5181}`,
      url: `http://127.0.0.1:${process.env.ORBIT_E2E_WEB_PORT ?? 5181}`,
      reuseExistingServer: false,
      env: { ORBIT_API_URL: `http://127.0.0.1:${process.env.ORBIT_E2E_API_PORT ?? 8091}`, ORBIT_E2E_FORWARD: "1" },
    },
  ],
});
