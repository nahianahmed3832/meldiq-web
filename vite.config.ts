import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * The web app talks to the Orbit server on its own origin (docs/ORBIT_WEB_ARCHITECTURE.md › G2): in development Vite
 * proxies /v1 (REST and the /v1/ws WebSocket) to ORBIT_API_URL; in production nginx does the same.
 */
const api = process.env.ORBIT_API_URL ?? "http://127.0.0.1:8080";
// Browser tests only (ORBIT_E2E_FORWARD=1): each test's browser presents its own client address, so the server's
// per-address sign-in limits apply per test rather than to the whole run (playwright.config.ts).
const e2eForward = process.env.ORBIT_E2E_FORWARD === "1";
const proxy = {
  "/v1": {
    target: api,
    ws: true,
    ...(e2eForward
      ? {
          configure: (p: { on: (event: "proxyReq", fn: (proxyReq: { setHeader(n: string, v: string): void }, req: { headers: Record<string, string | string[] | undefined> }) => void) => void }) =>
            p.on("proxyReq", (proxyReq, req) => {
              const ip = req.headers["x-orbit-test-ip"];
              if (typeof ip === "string" && /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) proxyReq.setHeader("x-forwarded-for", ip);
            }),
        }
      : {}),
  },
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
    coverage: { provider: "v8", include: ["src/**/*.ts"], exclude: ["src/**/*.tsx", "src/main.tsx", "src/vite-env.d.ts"], reporter: ["text", "html"] },
  },
});
