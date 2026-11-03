import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { once } from "node:events";

process.umask(0o077);
const root = path.resolve(import.meta.dirname, "../.."),
  server = path.resolve(root, "../meldiq_supabase_migration/server");
const privateRoot = path.join(os.homedir(), ".local/share/meldiq-supabase");
const snapshot = path.resolve(process.argv[2] ?? "");
const local = process.argv.includes("--local");
const backup = process.argv.find((arg) => arg.startsWith("--backup="))?.slice(9);
if (!snapshot.startsWith(`${privateRoot}/atlas-rehearsal-`)) throw new Error("Private real-data snapshot required");
const manifest = JSON.parse(fs.readFileSync(path.join(snapshot, "manifest.json"), "utf8"));
const settings = local
  ? {}
  : Object.fromEntries(
      fs
        .readFileSync(path.join(privateRoot, "staging.env"), "utf8")
        .split(/\r?\n/)
        .filter((line) => line.includes("="))
        .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
    );
const name = `meldiq_copy_rehearsal_${crypto.randomBytes(8).toString("hex")}`;
const endpoint = local ? `postgresql://postgres@127.0.0.1:55432/${name}` : settings.SUPABASE_DATABASE_URL;
const env = {
  PATH: process.env.PATH,
  HOME: os.homedir(),
  ...settings,
  SUPABASE_DATABASE_URL: endpoint,
  SUPABASE_ENVIRONMENT: local ? "development" : "staging",
  SUPABASE_EXPECTED_PROJECT_REF: local ? "local-real-copy" : "bkvlxbsnzqkhbifawcww",
};
const require = createRequire(path.join(server, "package.json"));
const { Pool } = require("pg");
const report = {
  ok: false,
  observedAt: new Date().toISOString(),
  projectRef: local ? null : "bkvlxbsnzqkhbifawcww",
  local,
  productionChanged: false,
  sourceSha256: manifest.sourceSha256,
  catalogSha256: manifest.catalogSha256,
};
const invoke = async (script, args, label) => {
  const log = fs.createWriteStream(path.join(snapshot, `${local ? "local" : "hosted"}-${label}.log`), { flags: "a", mode: 0o600 });
  const child = spawn(process.execPath, ["--import", "tsx", `scripts/${script}`, ...args], { cwd: server, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  const [code] = await once(child, "close");
  log.end();
  if (code !== 0) throw new Error("Rehearsal subprocess stopped");
};
let db;
try {
  if (local) {
    const admin = new Pool({ connectionString: "postgresql://postgres@127.0.0.1:55432/postgres", max: 1 });
    try {
      await admin.query(`CREATE DATABASE ${name}`);
    } finally {
      await admin.end();
    }
    db = new Pool({ connectionString: endpoint, max: 1 });
    await db.query(fs.readFileSync(path.join(root, "scripts/supabase/postgres-bootstrap.sql"), "utf8"));
    for (const file of fs
      .readdirSync(path.join(root, "supabase/migrations"))
      .filter((file) => file.endsWith(".sql"))
      .sort())
      await db.query(fs.readFileSync(path.join(root, "supabase/migrations", file), "utf8"));
    report.ownedDatabase = name;
  } else {
    const proof = JSON.parse(fs.readFileSync(path.join(snapshot, "local-copy-validation.json"), "utf8"));
    if (!proof.ok || proof.sourceSha256 !== manifest.sourceSha256 || proof.catalogSha256 !== manifest.catalogSha256) throw new Error("Exact local COPY validation required");
    const sizing = JSON.parse(fs.readFileSync(path.join(snapshot, "local-validation.json"), "utf8"));
    if (!sizing.ok || sizing.sourceSha256 !== manifest.sourceSha256 || !Number.isSafeInteger(sizing.applicationBytes)) throw new Error("Exact local storage measurement required");
    db = new Pool({
      connectionString: endpoint,
      max: 1,
      ssl: { rejectUnauthorized: true, ca: fs.readFileSync(settings.SUPABASE_DB_CA_FILE, "utf8") },
      connectionTimeoutMillis: 10000,
      statement_timeout: 10000,
    });
    db.on("error", () => undefined);
    report.databaseBytesBefore = Number((await db.query("SELECT pg_database_size(current_database())::text AS bytes")).rows[0].bytes);
    report.conservativeProjectedDatabaseBytes = report.databaseBytesBefore + Math.ceil(sizing.applicationBytes * 1.5);
    if (report.conservativeProjectedDatabaseBytes > Math.floor(512 * 1024 * 1024 * 0.7)) throw new Error("Rehearsal would exceed the reviewed free-plan storage headroom");
  }
  report.phase = "atomic-copy";
  const start = performance.now();
  await invoke("supabase-copy-rehearsal.ts", [snapshot, ...(backup ? [backup] : [])], "copy");
  report.copyMilliseconds = performance.now() - start;
  report.phase = "full-reconciliation";
  const result = path.join(snapshot, local ? "local-copy-reconciliation.json" : "hosted-reconciliation.json");
  await invoke("supabase-reconcile.ts", [snapshot, result, "--real-data-rehearsal"], "copy-reconciliation");
  const reconciled = JSON.parse(fs.readFileSync(result, "utf8"));
  if (!reconciled.ok || reconciled.synthetic) throw new Error("Incomplete reconciliation");
  report.tables = reconciled.tables.length;
  report.records = reconciled.tables.reduce((sum, table) => sum + table.source, 0);
  report.allRecordHashesMatch = true;
  report.timestampRangesAndFinancialTotalsMatch = true;
  report.sourceCounterFloorsPreserved = true;
  report.phase = "resume-validation";
  await invoke("supabase-copy-rehearsal.ts", [snapshot, ...(backup ? [backup] : [])], "copy-resume");
  report.exactRunResumePassed = true;
  report.ok = true;
  report.phase = "complete";
  if (!local) {
    const run = (await db.query("SELECT source_sha256,catalog_sha256 FROM meldiq_private.migration_runs WHERE id=$1", [manifest.id])).rows[0];
    if (run?.source_sha256 !== manifest.sourceSha256 || run?.catalog_sha256 !== manifest.catalogSha256 || !/^[a-f0-9-]{36}$/.test(manifest.id))
      throw new Error("Cannot mark an unverified customer rehearsal");
    await db.query(`COMMENT ON SCHEMA meldiq IS 'Meldiq customer-data rehearsal: ${manifest.id}; Atlas remains live'`);
    report.syntheticFixtureOperationsProtected = true;
  }
} catch {
  report.ok = false;
  report.errorCode = "rehearsal_stopped";
  process.exitCode = 1;
} finally {
  await db?.end();
  report.completedAt = new Date().toISOString();
  fs.writeFileSync(path.join(snapshot, local ? "local-copy-validation.json" : "hosted-validation.json"), JSON.stringify(report, null, 2) + "\n");
  fs.writeFileSync(path.join(root, local ? "docs/testing/supabase-real-data-local-copy-results.json" : "docs/testing/supabase-real-data-hosted-results.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
}
