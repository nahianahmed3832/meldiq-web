/**
 * The last build step (npm run build): Next.js's static export in out/ becomes dist/, the folder the release scripts
 * ship (deploy/scripts/build-release.sh). The app's one page is index.html; nginx serves it for every app path
 * (try_files $uri /index.html). The service worker is built next, into the same dist/ (vite.sw.config.ts).
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "out");
const dist = path.join(root, "dist");

if (!fs.existsSync(path.join(out, "index.html"))) {
  console.error('out/index.html is missing: did `next build` run with output: "export"?');
  process.exit(1);
}
fs.rmSync(dist, { recursive: true, force: true });
fs.renameSync(out, dist);
console.log("dist/ is ready");
