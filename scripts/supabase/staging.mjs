import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../..");
const expected = "bkvlxbsnzqkhbifawcww";
const filename = path.join(os.homedir(), ".local/share/meldiq-supabase/staging.env");
const statusFile = path.join(root, "docs/testing/staging-migration-results.json");
const phase = process.argv[2] ?? "check";
if (!["check", "plan", "apply", "types", "test", "test-native"].includes(phase)) throw new Error("Use check, plan, apply, types or test");
const settings = Object.fromEntries(
  fs
    .readFileSync(filename, "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const split = line.indexOf("=");
      return [line.slice(0, split), line.slice(split + 1)];
    }),
);
if ((fs.statSync(filename).mode & 0o077) !== 0) throw new Error("Staging credential file must have permissions 600");
if (settings.SUPABASE_ENVIRONMENT !== "staging" || settings.SUPABASE_EXPECTED_PROJECT_REF !== expected) throw new Error("Incorrect staging identity");
if (!settings.SUPABASE_DATABASE_URL) throw new Error("Run configure-staging.py and enter the staging password first");
const url = new URL(settings.SUPABASE_DATABASE_URL);
if (
  !(url.hostname === `db.${expected}.supabase.co` || (url.hostname === "aws-1-eu-central-1.pooler.supabase.com" && decodeURIComponent(url.username) === `postgres.${expected}`)) ||
  url.port !== "5432" ||
  url.pathname !== "/postgres" ||
  url.search
)
  throw new Error("Unrecognized staging connection template");
const server = process.env.MELDIQ_SERVER_DIR ?? path.resolve(root, "../meldiq_supabase_migration/server");
const require = createRequire(path.join(server, "package.json"));
const { Pool } = require("pg");
const db = new Pool({
  connectionString: url.href,
  max: 1,
  connectionTimeoutMillis: 10_000,
  ssl: { rejectUnauthorized: true, ca: fs.readFileSync(settings.SUPABASE_DB_CA_FILE, "utf8") },
  statement_timeout: 20_000,
});
const report = { observedAt: new Date().toISOString(), projectRef: expected, region: "eu-central-1", phase, productionChanged: false };
const cliUrl = new URL(url);
cliUrl.searchParams.set("sslmode", "verify-full");
cliUrl.searchParams.set("sslrootcert", settings.SUPABASE_DB_CA_FILE);
let idleError = null;
db.on("error", (error) => {
  idleError = /^[A-Z0-9_]{5,60}$/.test(error.code ?? "") ? error.code : "connection_failed";
});
const scrub = (value) => value.replaceAll(cliUrl.href, "[REDACTED_DATABASE_URL]").replaceAll(url.href, "[REDACTED_DATABASE_URL]").replaceAll(decodeURIComponent(url.password), "[REDACTED]");
function cli(args) {
  const result = spawnSync("npx", ["--yes", "supabase@2.122.0", ...args, "--db-url", cliUrl.href], {
    cwd: root,
    encoding: "utf8",
    timeout: 180_000,
    env: { ...process.env, SUPABASE_DB_PASSWORD: decodeURIComponent(url.password), PGSSLMODE: "verify-full", PGSSLROOTCERT: settings.SUPABASE_DB_CA_FILE },
  });
  const output = scrub(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  if (phase !== "types") process.stdout.write(output);
  if (result.status !== 0) throw new Error(`Supabase CLI failed in ${phase}; exit ${result.status ?? "timeout"}`);
  return scrub(result.stdout ?? "");
}
try {
  const version = (await db.query("SELECT current_database() AS database, current_setting('server_version') AS version")).rows[0];
  report.connection = { ok: true, ...version };
  if (phase === "plan") cli(["db", "push", "--dry-run", "--include-all"]);
  if (phase === "test") cli(["test", "db"]);
  if (phase === "test-native") {
    const results = await db.query(fs.readFileSync(path.join(root, "supabase/tests/rls.test.sql"), "utf8"));
    const tap = results.flatMap((result) => (result.rows ?? []).flatMap((row) => Object.values(row))).filter((value) => typeof value === "string");
    process.stdout.write(tap.join("\n") + "\n");
    if (tap.some((line) => /^(not ok|# Looks like)/.test(line)) || tap.filter((line) => /^ok \d/.test(line)).length !== 10) throw new Error("Hosted pgTAP assertions failed");
    report.pgTapAssertions = 10;
  }

  if (phase === "apply") cli(["db", "push", "--include-all", "--yes"]);
  if (phase === "types") {
    const output = cli(["gen", "types", "typescript", "--schema", "meldiq,meldiq_private"]);
    // CLI diagnostics go to stderr; use a dedicated artifact only after validating the output is TypeScript.
    if (!output.includes("export type Database")) throw new Error("Type generation did not produce Database types");
    fs.writeFileSync(path.join(root, "supabase/generated/supabase.types.ts"), output.slice(output.indexOf("export type")));
  }
  const tables = await db.query(`SELECT n.nspname AS schema,c.relname AS name,c.relrowsecurity AS rls,c.relforcerowsecurity AS force_rls,
    has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS client_access
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('meldiq','meldiq_private') AND c.relkind='r' ORDER BY n.nspname,c.relname`);
  report.tables = tables.rows.length;
  report.securedTables = tables.rows.filter((t) => t.rls && t.force_rls && !t.client_access).length;
  if (phase === "apply" && (report.tables !== 289 || report.securedTables !== 289)) throw new Error("Hosted table-security verification failed");
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.errorCode = typeof error?.code === "string" && /^[A-Z0-9_]{5,40}$/.test(error.code) ? error.code : "operation_failed";
  console.error(JSON.stringify({ ok: false, code: report.errorCode, phase }));
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {
    idleError = "connection_shutdown_failed";
  });
  if (idleError) report.shutdownWarning = idleError;
  fs.writeFileSync(statusFile, JSON.stringify(report, null, 2) + "\n");
  fs.writeFileSync(path.join(root, `docs/testing/staging-migration-${phase}-results.json`), JSON.stringify(report, null, 2) + "\n");
}
