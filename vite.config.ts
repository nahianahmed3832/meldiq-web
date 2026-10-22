import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import postcss from "postcss";
import { defineConfig } from "vitest/config";
import { lightDarkFallback } from "./build/lightDarkFallback";

/** The web app's version, kept equal to the Android release it matches (package.json), shown in Settings › About. */
const appVersion = (JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string }).version;

/**
 * The web app talks to the Meldiq (formerly Orbit) API on its own origin (docs/ORBIT_WEB_ARCHITECTURE.md › G2): in development Vite
 * proxies /v1 (REST and the /v1/ws WebSocket) and /v2 (email accounts) to MELDIQ_API_UPSTREAM; in production nginx does
 * the same.
 */
// Where the dev server proxies the API: MELDIQ_API_UPSTREAM, or ORBIT_API_URL (the earlier name, still read).
const api = process.env.MELDIQ_API_UPSTREAM ?? process.env.ORBIT_API_URL ?? "http://127.0.0.1:8080";
// Browser tests only (ORBIT_E2E_FORWARD=1): each test's browser presents its own client address, so the server's
// per-address sign-in limits apply per test rather than to the whole run (playwright.config.ts).
const e2eForward = process.env.ORBIT_E2E_FORWARD === "1";
const forwardTestAddress = e2eForward
  ? {
      configure: (p: { on: (event: "proxyReq", fn: (proxyReq: { setHeader(n: string, v: string): void }, req: { headers: Record<string, string | string[] | undefined> }) => void) => void }) =>
        p.on("proxyReq", (proxyReq, req) => {
          const ip = req.headers["x-orbit-test-ip"];
          if (typeof ip === "string" && /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) proxyReq.setHeader("x-forwarded-for", ip);
        }),
    }
  : {};
const proxy = {
  "/v2": { target: api, ...forwardTestAddress },
  "/v1": { target: api, ws: true, ...forwardTestAddress },
};

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  // Colours for browsers without light-dark() (Safari before 17.5, every iPhone 8): build/lightDarkFallback.ts.
  css: { postcss: { plugins: [lightDarkFallback(postcss)] } },
  // The service worker's source lives under /src/sw/ in development: this lets it control the whole app ("/").
  server: { host: "127.0.0.1", port: 5173, strictPort: true, proxy, headers: { "Service-Worker-Allowed": "/" } },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true, proxy },
  // Oldest supported: Safari/iOS 16.4 (an iPhone 8 runs up to iOS 16.7), docs/MELDIQ_WEB_BROWSERS.md.
  build: { target: ["es2022", "safari16.4"], sourcemap: true },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/support/legacyCurvesSetup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // The interface, and the call code that needs a browser's WebRTC, workers and audio (covered by the browser tests).
      exclude: ["src/**/*.tsx", "src/main.tsx", "src/vite-env.d.ts", "src/call/livekitSession.ts", "src/call/e2eeWorker.ts", "src/call/media.ts", "src/call/ringtone.ts", "src/call/support.ts"],
      reporter: ["text", "html"],
    },
  },
});
