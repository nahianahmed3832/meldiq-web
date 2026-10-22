import { defineConfig } from "vite";

/**
 * The service worker (src/sw/sw.ts) as one classic script at the site's root, /sw.js, so it can control the whole app
 * and runs in every browser that has service workers (module workers aren't everywhere). Built after the app, into the
 * same dist/ (npm run build). Development serves the source as a module instead (src/app/webPush.ts).
 */
export default defineConfig({
  build: {
    target: "es2022",
    sourcemap: true,
    emptyOutDir: false,
    copyPublicDir: false,
    lib: { entry: "src/sw/sw.ts", formats: ["iife"], name: "meldiqServiceWorker", fileName: () => "sw.js" },
  },
});
