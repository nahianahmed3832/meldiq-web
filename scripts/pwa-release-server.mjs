/** Local-only release fixture. Verify the real predecessor, retain immutable assets, and serve an atomic current link. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

const fixture = process.env.ORBIT_E2E_RELEASE_FIXTURE;
const previous = process.env.ORBIT_E2E_PREVIOUS_DIST;
const manifestFile = process.env.ORBIT_E2E_PREVIOUS_MANIFEST;
if (!fixture || !previous || !manifestFile) throw new Error("Provide the release fixture, verified previous export and its release manifest.");
const digest = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
for (const [file, hash] of Object.entries(manifest.files)) {
  const source = path.resolve(previous, file);
  if (!source.startsWith(path.resolve(previous) + path.sep) || digest(source) !== hash) throw new Error(`Previous export verification failed: ${file}`);
}
for (const [name, source] of [
  ["previous", previous],
  ["candidate", path.resolve("dist")],
]) {
  const target = path.join(fixture, name);
  if (fs.existsSync(target)) throw new Error("Release fixture must be a new disposable directory.");
  fs.cpSync(source, target, { recursive: true });
  // Same-origin API and no external push services. Runtime config stays identical through the local upgrade.
  fs.writeFileSync(path.join(target, "config.json"), JSON.stringify({ apiBase: "", wsUrl: null, publicUrl: null, environment: "production", firebase: null }));
}
for (const directory of ["_next/static", "locales"]) {
  const source = path.join(previous, directory);
  const target = path.join(fixture, "candidate", directory);
  fs.cpSync(source, target, {
    recursive: true,
    force: false,
    filter: (from, to) => {
      if (from.endsWith(".map")) return false;
      if (fs.statSync(from).isFile() && fs.existsSync(to) && digest(from) !== digest(to)) throw new Error("Immutable release asset collision");
      return true;
    },
  });
}
fs.symlinkSync(path.join(fixture, "candidate"), path.join(fixture, "current"), "dir");
fs.writeFileSync(path.join(fixture, "verified.json"), JSON.stringify({ previousBuildId: manifest.buildId, previousSource: manifest.sourceCommit, verifiedFiles: Object.keys(manifest.files).length }));
const server = spawn(process.execPath, ["scripts/web-server.ts", path.join(fixture, "current"), String(process.env.ORBIT_E2E_WEB_PORT ?? 5181)], { stdio: "inherit", env: process.env });
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 1));
