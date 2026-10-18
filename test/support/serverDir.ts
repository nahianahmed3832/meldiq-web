import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** This repository's root. */
export const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * The Orbit server's folder: `server/` of the Orbit repository (github.com/nahianahmed3832/griip-mesage), which the
 * integration tests, browser tests and local tools run. ORBIT_SERVER_DIR if set, else a clone next to this repository.
 * The server must include first-frame WebSocket authentication (docs/ORBIT_WEB_ARCHITECTURE.md › G1).
 */
export function serverDir(): string {
  const candidates = [process.env.ORBIT_SERVER_DIR, path.join(WEB_ROOT, "../griip-mesage/server"), path.join(WEB_ROOT, "../griip_message/server"), path.join(WEB_ROOT, "../server")].filter(
    (c): c is string => !!c,
  );
  const found = candidates.find((c) => fs.existsSync(path.join(c, "test/support/griipClient.ts")));
  if (!found) {
    throw new Error(
      `Orbit server not found. Clone github.com/nahianahmed3832/griip-mesage next to this repository and run npm ci in its server/ folder, or set ORBIT_SERVER_DIR to that folder. Looked in: ${candidates.join(", ")}`,
    );
  }
  return path.resolve(found);
}
