import crypto from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Browser tests: the real app in real engines (Chromium, Firefox, WebKit, and a phone-sized Chromium) against a throwaway
 * server started from this checkout, with the server's reference client playing the phone. Not a physical-device test.
 */
const API_PORT = 8091;
const WEB_PORT = 5181;
/** `next dev` behind the web server in development mode (scripts/web-server.ts proxies to it). */
const NEXT_DEV_PORT = 5182;
process.env.ORBIT_E2E_API ??= `http://127.0.0.1:${API_PORT}`;
process.env.ORBIT_E2E_DATA ??= fs.mkdtempSync(path.join(os.tmpdir(), "orbit-e2e-"));

/**
 * Calls (e2e/calls.spec.ts) need a LiveKit media server: started for the run when `livekit-server` is installed
 * (Homebrew: `brew install livekit`; or LIVEKIT_SERVER_BIN). Without it the call tests are skipped and say why.
 */
const LIVEKIT_PORT = 7895;
const LIVEKIT_KEY = "orbit-e2e";
const LIVEKIT_SECRET = "orbit-e2e-secret-for-local-testing-only-00001";
const livekitBin = process.env.LIVEKIT_SERVER_BIN ?? (spawnSync("which", ["livekit-server"], { encoding: "utf8" }).stdout.trim() || null);
if (livekitBin) process.env.ORBIT_E2E_LIVEKIT = `ws://127.0.0.1:${LIVEKIT_PORT}`;
const livekitEnv: Record<string, string> = livekitBin
  ? { LIVEKIT_API_KEY: LIVEKIT_KEY, LIVEKIT_API_SECRET: LIVEKIT_SECRET, LIVEKIT_PUBLIC_URL: `ws://127.0.0.1:${LIVEKIT_PORT}`, LIVEKIT_API_URL: `http://127.0.0.1:${LIVEKIT_PORT}` }
  : {};

/**
 * Fake microphones and cameras: Chromium's and Firefox's test devices, WebKit's mock capture devices. Chromium runs as
 * the full browser (channel "chromium"): its headless shell answers every camera or microphone request with
 * NotSupportedError, while the full browser grants or refuses them like a person would (the permissions below).
 */
const media = ["microphone", "camera"];
const chromiumMedia = { channel: "chromium", launchOptions: { args: ["--use-fake-device-for-media-stream"] }, permissions: media };
const firefoxMedia = { launchOptions: { firefoxUserPrefs: { "media.navigator.streams.fake": true, "media.navigator.permission.disabled": true } } };

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure",
    // The first-run introduction is shown once per browser; the tests start past it (it's checked by hand).
    storageState: { cookies: [], origins: [{ origin: `http://127.0.0.1:${WEB_PORT}`, localStorage: [{ name: "meldiq.introSeen", value: "1" }] }] },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, ...chromiumMedia } },
    { name: "firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 }, ...firefoxMedia } },
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 }, permissions: media } },
    { name: "phone-width", use: { ...devices["Pixel 7"], ...chromiumMedia } },
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
        // Presence changes at once here, as in the server's own tests; its settle and grace delays have their own suite.
        PRESENCE_SETTLE_MS: "0",
        PRESENCE_GRACE_MS: "0",
        LOG_LEVEL: "warn",
        RATE_LIMIT_PER_MINUTE: "100000",
        REGISTRATION_PER_ADDRESS_PER_HOUR: "0",
        REGISTRATION_PER_ADDRESS_PER_DAY: "0",
        REGISTRATION_OPEN_PER_DAY: "0",
        NEW_ACCOUNT_LIMIT_DAYS: "0",
        // Trusts the forwarded address from the local test proxy and test phones (each test is its own client address).
        TRUST_PROXY: "loopback",
        // Passkeys (e2e/passkeys.spec.ts): the pages at localhost are a relying party of their own, as web.meldiq.app is.
        PASSKEY_RP_ID: "msg.example.test",
        PASSKEY_WEB_ORIGINS: `http://localhost:${WEB_PORT}`,
        // AI agents reading channels (e2e/agents.spec.ts) hold their keys under the platform's key: a throwaway one here.
        PLATFORM_SECRETS_KEY: crypto.randomBytes(32).toString("hex"),
        ...livekitEnv,
      },
    },
    ...(livekitBin
      ? [
          {
            command: "bash scripts/livekit-dev.sh",
            url: `http://127.0.0.1:${LIVEKIT_PORT}`,
            reuseExistingServer: false,
            timeout: 30_000,
            env: {
              LIVEKIT_SERVER_BIN: livekitBin,
              LIVEKIT_DEV: "0",
              LIVEKIT_LOG_LEVEL: "warn",
              LIVEKIT_PORT: String(LIVEKIT_PORT),
              LIVEKIT_TCP_PORT: "7896",
              LIVEKIT_UDP_PORT: "7897",
              LIVEKIT_API_KEY: LIVEKIT_KEY,
              LIVEKIT_API_SECRET: LIVEKIT_SECRET,
              ORBIT_API_URL: `http://127.0.0.1:${API_PORT}`,
            },
          },
        ]
      : []),
    // ORBIT_E2E_BUILD=1: the production build (what users get: minified, the built /sw.js, the Safari 16.4 target) with
    // production's security headers and CSP (scripts/web-server.ts); otherwise `next dev` behind the same server.
    ...(process.env.ORBIT_E2E_BUILD === "1"
      ? [
          {
            command: `npm run -s build && node scripts/web-server.ts dist ${WEB_PORT}`,
            url: `http://127.0.0.1:${WEB_PORT}`,
            reuseExistingServer: false,
            timeout: 300_000,
            // The test phones link through the pre-email device sign-in, which release builds leave out (auth/testLinking.ts).
            env: { ORBIT_API_URL: `http://127.0.0.1:${API_PORT}`, ORBIT_E2E_FORWARD: "1", NEXT_PUBLIC_MELDIQ_TEST_LINKING: "1" },
          },
        ]
      : [
          {
            command: `npm run -s sw:dev && npx next dev --hostname 127.0.0.1 --port ${NEXT_DEV_PORT}`,
            url: `http://127.0.0.1:${NEXT_DEV_PORT}`,
            reuseExistingServer: false,
            timeout: 120_000,
            env: { ORBIT_API_URL: `http://127.0.0.1:${API_PORT}` },
          },
          {
            command: `node scripts/web-server.ts dist ${WEB_PORT}`,
            url: `http://127.0.0.1:${WEB_PORT}/v1/server-info`,
            reuseExistingServer: false,
            timeout: 60_000,
            env: { ORBIT_API_URL: `http://127.0.0.1:${API_PORT}`, MELDIQ_APP_UPSTREAM: `http://127.0.0.1:${NEXT_DEV_PORT}`, ORBIT_E2E_FORWARD: "1" },
          },
        ]),
  ],
});
