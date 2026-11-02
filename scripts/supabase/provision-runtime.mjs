// One staging-only machine login. Administrator credentials and the generated password never leave private files.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const root = path.resolve(import.meta.dirname, "../..");
const project = "bkvlxbsnzqkhbifawcww";
const role = "meldiq_staging_runtime";
const privateDir = path.join(os.homedir(), ".local/share/meldiq-supabase");
const target = path.join(privateDir, "staging-runtime.env");
function settings(filename) {
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw new Error("Private credential file must be a regular file with permissions 600");
  return Object.fromEntries(fs.readFileSync(filename, "utf8").split(/\r?\n/).filter(line => line && !line.startsWith("#")).map(line => {
    const at = line.indexOf("=");
    if (at < 1) throw new Error("Invalid private environment format");
    return [line.slice(0, at), line.slice(at + 1)];
  }));
}
const operator = settings(path.join(privateDir, "staging.env"));
if (operator.SUPABASE_ENVIRONMENT !== "staging" || operator.SUPABASE_EXPECTED_PROJECT_REF !== project) throw new Error("Staging identity mismatch");
const endpoint = new URL(operator.SUPABASE_DATABASE_URL);
if (endpoint.hostname !== "aws-1-eu-central-1.pooler.supabase.com" || endpoint.port !== "5432" ||
    decodeURIComponent(endpoint.username) !== `postgres.${project}` || endpoint.pathname !== "/postgres" || endpoint.search) throw new Error("Unexpected staging operator connection");
const require = createRequire(path.join(process.env.MELDIQ_SERVER_DIR ?? path.resolve(root, "../meldiq_supabase_migration/server"), "package.json"));
const {Pool} = require("pg");
const options = {max: 1, connectionTimeoutMillis: 10000, statement_timeout: 20000,
  ssl: {rejectUnauthorized: true, ca: fs.readFileSync(operator.SUPABASE_DB_CA_FILE, "utf8")}};
const admin = new Pool({...options, connectionString: endpoint.href});
admin.on("error", () => {});
let runtime;
const report = {observedAt: new Date().toISOString(), projectRef: project, role, productionChanged: false};
try {
  if (fs.existsSync(target)) {
    const saved = settings(target);
    if (saved.SUPABASE_ENVIRONMENT !== "staging" || saved.SUPABASE_EXPECTED_PROJECT_REF !== project) throw new Error("Existing runtime file belongs to another environment");
    runtime = new URL(saved.SUPABASE_DATABASE_URL);
    if (runtime.hostname !== endpoint.hostname || runtime.port !== "5432" || runtime.pathname !== "/postgres" || runtime.search ||
        decodeURIComponent(runtime.username) !== `${role}.${project}` || !runtime.password) throw new Error("Existing runtime connection mismatch");
    report.created = false;
  } else {
    const exists = await admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role]);
    if (exists.rowCount) throw new Error("Runtime role already exists without its private file; recover its credentials explicitly");
    const password = crypto.randomBytes(48).toString("hex");
    runtime = new URL(endpoint);
    runtime.username = `${role}.${project}`;
    runtime.password = password;
    // Write the credential before committing its role, so a process interruption cannot lose the only copy.
    fs.writeFileSync(target, `SUPABASE_ENVIRONMENT=staging\nSUPABASE_EXPECTED_PROJECT_REF=${project}\nSUPABASE_DATABASE_URL=${runtime.href}\nSUPABASE_DB_CA_FILE=${operator.SUPABASE_DB_CA_FILE}\n`, {mode: 0o600, flag: "wx"});
    const client = await admin.connect();
    try {
      await client.query("BEGIN");
      // PostgreSQL DDL does not accept password parameters; format server-side from a transaction-local setting.
      await client.query("SELECT set_config('meldiq.provision_password', $1, true)", [password]);
      await client.query(`DO $$ BEGIN EXECUTE format('CREATE ROLE ${role} LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 6 PASSWORD %L', current_setting('meldiq.provision_password')); END $$`);
      await client.query(`GRANT meldiq_api TO ${role}`);
      await client.query(`ALTER ROLE ${role} SET search_path = pg_catalog, meldiq`);
      await client.query("COMMIT");
      report.created = true;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      fs.unlinkSync(target);
      throw error;
    } finally {client.release();}
  }
  const db = new Pool({...options, connectionString: runtime.href});
  db.on("error", () => {});
  try {
    const result = await db.query(`SELECT current_user AS role, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolreplication,
      pg_has_role(current_user,'meldiq_api','USAGE') AS api,
      has_table_privilege(current_user,(SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth' AND c.relname='users'),'INSERT,UPDATE,DELETE') AS auth_write,
      has_schema_privilege(current_user,'meldiq','CREATE') AS schema_create
      FROM pg_roles WHERE rolname=current_user`);
    const r = result.rows[0];
    if (!r || r.role !== role || !r.api || r.rolsuper || r.rolbypassrls || r.rolcreaterole || r.rolcreatedb || r.rolreplication || r.auth_write || r.schema_create) throw new Error("Runtime privilege boundary failed");
    await db.query("SELECT id FROM meldiq.users LIMIT 1");
    report.restrictedLoginVerified = true;
    report.authWritesDenied = true;
    report.schemaCreationDenied = true;
    report.ok = true;
  } finally {await db.end();}
} catch (error) {
  report.ok = false;
  report.errorCode = /^[A-Z0-9_]{5,40}$/.test(error?.code ?? "") ? error.code : "operation_failed";
  process.exitCode = 1;
} finally {
  await admin.end().catch(() => {});
  fs.writeFileSync(path.join(root, "docs/testing/staging-runtime-role-results.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
}
