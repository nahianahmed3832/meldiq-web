import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Browser tests: the real app in real engines (Chromium, Firefox, WebKit, and a phone-sized Chromium) against a throwaway
 * server started from this checkout, with the server's reference client playing the phone. Not a physical-device test.
 */
const API_PORT = 8091;
const WEB_PORT = 5181;
process.env.ORBIT_E2E_API ??= `http://127.0.0.1:${API_PORT}`;
process.env.ORBIT_E2E_DATA ??= fs.mkdtempSync(path.join(os.tmpdir(), "orbit-e2e-"));

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${WEB_PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 } } },
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } },
    { name: "phone-width", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "bash scripts/local-server.sh",
      url: `http://127.0.0.1:${API_PORT}/healthz`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: String(API_PORT),
        HOST: "127.0.0.1",
        DATA_DIR: process.env.ORBIT_E2E_DATA,
        LOG_LEVEL: "warn",
        RATE_LIMIT_PER_MINUTE: "100000",
        REGISTRATION_PER_ADDRESS_PER_HOUR: "0",
        REGISTRATION_PER_ADDRESS_PER_DAY: "0",
        REGISTRATION_OPEN_PER_DAY: "0",
        NEW_ACCOUNT_LIMIT_DAYS: "0",
        // Trusts the forwarded address from the local test proxy and test phones (each test is its own client address).
        TRUST_PROXY: "loopback",
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { ORBIT_API_URL: `http://127.0.0.1:${API_PORT}`, ORBIT_E2E_FORWARD: "1" },
    },
  ],
});
