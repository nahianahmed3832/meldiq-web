import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {createRequire} from "node:module";
import {execFile} from "node:child_process";
import {promisify} from "node:util";

process.umask(0o077);
const execute = promisify(execFile);
const root = path.resolve(import.meta.dirname, "../..");
const server = path.resolve(root, "../meldiq_supabase_migration/server");
const privateRoot = path.join(os.homedir(), ".local/share/meldiq-supabase");
const snapshot = path.resolve(process.argv[2] ?? "");
if (!snapshot.startsWith(`${privateRoot}/atlas-rehearsal-`)) throw new Error("Private Atlas rehearsal directory required");
const manifest = JSON.parse(fs.readFileSync(path.join(snapshot, "manifest.json"), "utf8"));
if (!manifest.realDataSnapshot || manifest.synthetic || manifest.purpose !== "staging-rehearsal" || !/^[a-f0-9-]{36}$/.test(manifest.id)) throw new Error("Real immutable rehearsal manifest required");
const require = createRequire(path.join(server, "package.json"));
const {Pool} = require("pg");
const name = `meldiq_customer_rehearsal_${manifest.id.replaceAll("-", "")}`;
const origin = "postgresql://postgres@127.0.0.1:55432/postgres";
const admin = new Pool({connectionString: origin, max: 1});
const endpoint = new URL(origin); endpoint.pathname = `/${name}`;
const db = new Pool({connectionString: endpoint.href, max: 1});
const env = {...process.env, SUPABASE_DATABASE_URL: endpoint.href, SUPABASE_ENVIRONMENT: "development", SUPABASE_EXPECTED_PROJECT_REF: "local-real-rehearsal"};
delete env.SUPABASE_DB_CA_FILE;
const report = {ok: false, observedAt: new Date().toISOString(), database: name, synthetic: false, sourceSha256: manifest.sourceSha256, catalogSha256: manifest.catalogSha256,
  productionChanged: false, hostedImported: false, allRecordHashesMatch: false};
let phase = "create-owned-local-database";
try {
  const exists = (await admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [name])).rowCount > 0;
  if (exists) {
    const prior = (await db.query("SELECT source_sha256,catalog_sha256 FROM meldiq_private.migration_runs WHERE id=$1", [manifest.id])).rows[0];
    if (prior?.source_sha256 !== manifest.sourceSha256 || prior?.catalog_sha256 !== manifest.catalogSha256) throw new Error("Existing database is not this owned snapshot rehearsal");
    report.resumedOwnedDatabase = true;
  } else {
    await admin.query(`CREATE DATABASE ${name}`);
    phase = "apply-schema";
    await db.query(fs.readFileSync(path.join(root, "scripts/supabase/postgres-bootstrap.sql"), "utf8"));
    for (const file of fs.readdirSync(path.join(root, "supabase/migrations")).filter(file => file.endsWith(".sql")).sort()) {
      await db.query("BEGIN");
      try { await db.query(fs.readFileSync(path.join(root, "supabase/migrations", file), "utf8")); await db.query("COMMIT"); }
      catch (error) { await db.query("ROLLBACK"); throw error; }
    }
  }
  for (const pass of ["initial", "resume"]) {
    phase = `${pass}-import`; const start = performance.now();
    const result = await execute(process.execPath, ["--import", "tsx", "scripts/supabase-import.ts", snapshot, "--real-data-rehearsal"], {cwd: server, env, timeout: 900000, maxBuffer: 2000000});
    fs.writeFileSync(path.join(snapshot, `${pass}-local-import.log`), result.stdout, {mode: 0o600});
    report[`${pass}ImportMilliseconds`] = performance.now() - start;
  }
  phase = "full-reconciliation";
  const destination = path.join(snapshot, "local-reconciliation.json");
  await execute(process.execPath, ["--import", "tsx", "scripts/supabase-reconcile.ts", snapshot, destination, "--real-data-rehearsal"], {cwd: server, env, timeout: 900000, maxBuffer: 2000000});
  const reconciled = JSON.parse(fs.readFileSync(destination, "utf8"));
  if (!reconciled.ok || reconciled.synthetic) throw new Error("Incomplete real-data reconciliation");
  report.tables = reconciled.tables.length;
  report.records = reconciled.tables.reduce((sum, table) => sum + table.source, 0);
  report.databaseBytes = Number((await db.query("SELECT pg_database_size(current_database())::text AS bytes")).rows[0].bytes);
  report.applicationBytes = Number((await db.query("SELECT sum(pg_total_relation_size(c.oid))::text AS bytes FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('meldiq','meldiq_private') AND c.relkind='r'")).rows[0].bytes);
  report.allRecordHashesMatch = true;
  report.ok = true;
} catch (error) {
  report.failedPhase = phase;
  report.errorCode = /^[A-Z0-9_]{5,40}$/.test(error?.code ?? "") ? error.code : "validation_stopped";
  process.exitCode = 1;
} finally {
  await db.end(); await admin.end();
  fs.writeFileSync(path.join(snapshot, "local-validation.json"), JSON.stringify(report, null, 2) + "\n", {mode: 0o600});
  fs.appendFileSync(path.join(snapshot, "local-validation-history.ndjson"), JSON.stringify(report) + "\n", {mode: 0o600});
  fs.writeFileSync(path.join(root, "docs/testing/supabase-real-data-local-results.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
}
