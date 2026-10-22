import { readFileSync } from "node:fs";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** The web app's version, kept equal to the Android release it matches (package.json), shown in Settings › About. */
const version = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

/**
 * Meldiq Web on Next.js (ADR 0008; docs/MELDIQ_WEB_NEXTJS.md). A static export: nginx serves the files as before, with
 * the same strict Content-Security-Policy (`script-src 'self'`). That's why it uses the Pages Router: its pages carry
 * their data as a JSON block that is never run, where the App Router's pages need inline scripts. Every screen is a
 * client component; the server-side build renders only the empty shell and the launch screen, never a message or key.
 *
 * In development `next dev` proxies /v1 (REST and the /v1/ws WebSocket) and /v2 to MELDIQ_API_UPSTREAM and answers
 * every app path with the page; in production nginx does the same.
 * @param {string} phase
 * @returns {import("next").NextConfig}
 */
export default function config(phase) {
  const api = process.env.MELDIQ_API_UPSTREAM ?? process.env.ORBIT_API_URL ?? "http://127.0.0.1:8080";
  return {
    output: "export",
    reactStrictMode: false, // the client root has its own <StrictMode> (src/client/Root.tsx)
    poweredByHeader: false,
    productionBrowserSourceMaps: true,
    images: { unoptimized: true },
    env: { MELDIQ_APP_VERSION: version },
    // Types are checked by `tsc -b` (npm run typecheck), with the project's own settings.
    typescript: { ignoreBuildErrors: true, tsconfigPath: "tsconfig.next.json" },
    ...(phase === PHASE_DEVELOPMENT_SERVER
      ? {
          // As nginx does in production: the API on the same origin, and every other path the app's one page.
          async rewrites() {
            return {
              beforeFiles: [
                { source: "/v1/:path*", destination: `${api}/v1/:path*` },
                { source: "/v2/:path*", destination: `${api}/v2/:path*` },
              ],
              afterFiles: [],
              fallback: [{ source: "/:path*", destination: "/" }],
            };
          },
        }
      : {}),
  };
}
