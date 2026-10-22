import { defineConfig } from "vitest/config";

/**
 * Unit and live-server tests (Vitest). The app itself is built by Next.js (next.config.mjs) and the service worker by
 * vite.sw.config.ts.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/support/legacyCurvesSetup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.tsx", "src/**/*.d.ts", "src/call/livekitSession.ts", "src/call/e2eeWorker.ts", "src/call/media.ts", "src/call/ringtone.ts", "src/call/support.ts"],
      reporter: ["text", "html"],
    },
  },
});
