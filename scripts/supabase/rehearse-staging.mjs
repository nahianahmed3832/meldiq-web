import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
const root = path.resolve(import.meta.dirname, "../..");
const settings = Object.fromEntries(fs.readFileSync(path.join(os.homedir(), ".local/share/meldiq-supabase/staging.env"), "utf8").split(/\r?\n/).filter(line => line.includes("=")).map(line => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1)]; }));
if (settings.SUPABASE_ENVIRONMENT !== "staging" || settings.SUPABASE_EXPECTED_PROJECT_REF !== "bkvlxbsnzqkhbifawcww") throw new Error("Only the explicitly selected staging project is allowed");
const previous = JSON.parse(fs.readFileSync(path.join(root, "docs/testing/supabase-rehearsal-results.json"), "utf8"));
if (!previous.ok || !previous.synthetic || !previous.privateDirectory.startsWith(path.join(os.homedir(), ".local/share/meldiq-supabase/rehearsal-"))) throw new Error("A successful private synthetic rehearsal is required");
const snapshot = path.join(previous.privateDirectory, "snapshot");
const server = process.env.MELDIQ_SERVER_DIR ?? path.resolve(root, "../meldiq_supabase_migration/server");
const env = { ...process.env, ...Object.fromEntries(["SUPABASE_DATABASE_URL", "SUPABASE_ENVIRONMENT", "SUPABASE_EXPECTED_PROJECT_REF", "SUPABASE_DB_CA_FILE"].map(key => [key, settings[key]])) };
const report = { observedAt: new Date().toISOString(), synthetic: true, projectRef: settings.SUPABASE_EXPECTED_PROJECT_REF, productionChanged: false };
try {
  for (const pass of ["initial", "resume"]) {
    const start = performance.now();
    await execute(process.execPath, ["--import", "tsx", "scripts/supabase-import.ts", snapshot], { cwd: server, env, maxBuffer: 2_000_000, timeout: 180_000 });
    report[`${pass}ImportMilliseconds`] = performance.now() - start;
  }
  const destination = path.join(root, "docs/testing/staging-reconciliation.json");
  await execute(process.execPath, ["--import", "tsx", "scripts/supabase-reconcile.ts", snapshot, destination], { cwd: server, env, maxBuffer: 2_000_000, timeout: 180_000 });
  const reconciled = JSON.parse(fs.readFileSync(destination, "utf8"));
  report.tables = reconciled.tables.length;
  report.records = reconciled.tables.reduce((total, table) => total + table.source, 0);
  report.ok = reconciled.ok;
} catch {
  report.ok = false;
  report.failure = "Staging synthetic import/reconciliation stopped. Inspect protected snapshot error codes; no customer source was used.";
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(root, "docs/testing/staging-rehearsal-results.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
}
