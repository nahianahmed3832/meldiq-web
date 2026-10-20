import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** This repository's root. */
export const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * The Meldiq server's folder: `server/` of the server repository (github.com/nahianahmed3832/meldiq), which the
 * integration tests, browser tests and local tools run. ORBIT_SERVER_DIR if set, else a clone next to this repository.
 * The server must include first-frame WebSocket authentication (docs/ORBIT_WEB_ARCHITECTURE.md › G1).
 *
 * The folder must have every dependency of its package.json installed. A neighbouring checkout that hasn't is usually an
 * old one: rather than fail later on a missing package (or test against old server code), this names the folder.
 */
export function serverDir(): string {
  const fromEnv = process.env.ORBIT_SERVER_DIR;
  const candidates = [fromEnv, path.join(WEB_ROOT, "../griip-mesage/server"), path.join(WEB_ROOT, "../griip_message/server"), path.join(WEB_ROOT, "../server")].filter((c): c is string => !!c);
  const found = candidates.find((c) => fs.existsSync(path.join(c, "test/support/griipClient.ts")));
  if (!found) {
    throw new Error(
      `Meldiq server not found. These are integration tests (npm run test:integration): clone github.com/nahianahmed3832/meldiq next to this repository and run npm ci in its server/ folder, or set ORBIT_SERVER_DIR to that folder. Looked in: ${candidates.join(", ")}`,
    );
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(found, "package.json"), "utf8")) as { dependencies?: Record<string, string> };
  const missing = Object.keys(pkg.dependencies ?? {}).filter((d) => !fs.existsSync(path.join(found, "node_modules", d, "package.json")));
  if (missing.length) {
    throw new Error(
      `The Meldiq server at ${path.resolve(found)}${found === fromEnv ? " (ORBIT_SERVER_DIR)" : ""} is missing ${missing.join(", ")} in node_modules: it's probably an old checkout. Run npm ci there, or point ORBIT_SERVER_DIR at an up-to-date server/ folder.`,
    );
  }
  return path.resolve(found);
}
