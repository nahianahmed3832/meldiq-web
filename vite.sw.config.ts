import { defineConfig } from "vite";

/**
 * The service worker (src/sw/sw.ts) as one classic script at the site's root, /sw.js, so it can control the whole app
 * and runs in every browser that has service workers (module workers aren't everywhere). Built after the app, into the
 * same dist/ (npm run build); `npm run dev` builds it into public/ (src/application/webPush.ts registers /sw.js).
 */
export default defineConfig(({ mode }) => ({
  // Library builds leave process.env alone; the worker shares modules that read NODE_ENV (src/application/env.ts).
  define: { "process.env.NODE_ENV": JSON.stringify(mode === "development" ? "development" : "production") },
  build: {
    target: ["es2022", "safari16.4"],
    sourcemap: true,
    emptyOutDir: false,
    copyPublicDir: false,
    lib: { entry: "src/sw/sw.ts", formats: ["iife"], name: "meldiqServiceWorker", fileName: () => "sw.js" },
  },
}));
