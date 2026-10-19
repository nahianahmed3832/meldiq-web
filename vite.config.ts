import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

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
  server: { host: "127.0.0.1", port: 5173, strictPort: true, proxy },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true, proxy },
  build: { target: "es2022", sourcemap: true },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
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
