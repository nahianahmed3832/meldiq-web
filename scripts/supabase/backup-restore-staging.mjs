import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import net from "node:net";
import { createClient } from "@supabase/supabase-js";

// The only remote operation is a read-only snapshot. Restore is restricted to a newly owned loopback DB.
const root = path.resolve(import.meta.dirname, "../..");
const privateRoot = path.join(os.homedir(), ".local/share/meldiq-supabase");
const filename = path.join(privateRoot, "staging.env");
const info = fs.lstatSync(filename);
if (!info.isFile() || info.isSymbolicLink() || info.mode & 0o077) throw new Error("Private staging settings required");
const settings = Object.fromEntries(
  fs
    .readFileSync(filename, "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const at = line.indexOf("=");
      if (at < 1) throw new Error("Invalid settings format");
      return [line.slice(0, at), line.slice(at + 1)];
    }),
);
const project = "bkvlxbsnzqkhbifawcww";
const source = new URL(settings.SUPABASE_DATABASE_URL);
if (
  settings.SUPABASE_ENVIRONMENT !== "staging" ||
  settings.SUPABASE_EXPECTED_PROJECT_REF !== project ||
  source.hostname !== "aws-1-eu-central-1.pooler.supabase.com" ||
  source.port !== "5432" ||
  source.pathname !== "/postgres" ||
  source.search ||
  decodeURIComponent(source.username) !== `postgres.${project}`
)
  throw new Error("Only the known Frankfurt staging source is accepted");
const pgBin = "/opt/homebrew/opt/postgresql@17/bin";
const pgDump = path.join(pgBin, "pg_dump"),
  pgRestore = path.join(pgBin, "pg_restore");
const version = spawnSync(pgDump, ["--version"], { encoding: "utf8" });
if (version.status !== 0 || !/^pg_dump \(PostgreSQL\) 17\./.test(version.stdout)) throw new Error("PostgreSQL 17 tools required");
const server = process.env.MELDIQ_SERVER_DIR ?? path.resolve(root, "../meldiq_supabase_migration/server");
const { Client } = createRequire(path.join(server, "package.json"))("pg");
const remote = new Client({
  connectionString: source.href,
  ssl: { rejectUnauthorized: true, ca: fs.readFileSync(settings.SUPABASE_DB_CA_FILE, "utf8") },
  connectionTimeoutMillis: 10_000,
  statement_timeout: 30_000,
  application_name: "meldiq-staging-backup-readonly",
});
const localConfig = { host: "127.0.0.1", port: 55432, database: "postgres", user: "postgres", connectionTimeoutMillis: 5_000 };
const local = new Client(localConfig);
const resumeDirectory = process.argv.find((arg) => arg.startsWith("--resume="))?.slice(9);
if (resumeDirectory && (path.dirname(resumeDirectory) !== privateRoot || !/^hosted-backup-[0-9a-f]{16}$/.test(path.basename(resumeDirectory))))
  throw new Error("Only a private owned backup directory may be resumed");
const run = resumeDirectory ? path.basename(resumeDirectory).slice("hosted-backup-".length) : crypto.randomBytes(8).toString("hex");
const restoreName = `meldiq_restore_hosted_${run}`;
const directory = path.join(privateRoot, `hosted-backup-${run}`);
const keysDirectory = path.join(privateRoot, "recovery-keys");
const keyFile = path.join(keysDirectory, "staging-age-identity.txt");
const archive = path.join(directory, "database.dump.age");
const schemas = ["auth", "meldiq", "meldiq_private", "supabase_migrations"];
const testAuth = process.argv.includes("--test-auth");
const reconcileSource = process.argv.find((arg) => arg.startsWith("--reconcile-source="))?.slice("--reconcile-source=".length);
if (process.argv.slice(2).some((arg) => arg !== "--test-auth" && !arg.startsWith("--resume=") && !arg.startsWith("--reconcile-source=")) || (resumeDirectory && testAuth))
  throw new Error("Use --test-auth for a fresh Auth test or --resume for stored-row recovery");
const authRuntime = path.join(privateRoot, "auth-runtime-v2.197.0");
const authArchiveSha256 = "3fb7998e7061e2c14f3f9555b1d94d447358c965395728e0d81eac82e0e5868b";
const authAdmin = testAuth && createClient(`https://${project}.supabase.co`, settings.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
let probe, authProcess;
const report = {
  observedAt: new Date().toISOString(),
  projectRef: project,
  productionChanged: false,
  remoteSqlWrites: 0,
  scopes: schemas,
  plaintextArchiveWritten: false,
  authPasswordSessionRestoreTested: false,
  fullSupabaseStackRestoreTested: false,
  offHostRecoveryCopyVerified: false,
  syntheticAuthUsersCreated: 0,
  phase: "setup",
  ok: false,
};
let resumedReceipt;
if (resumeDirectory) {
  resumedReceipt = JSON.parse(fs.readFileSync(path.join(directory, "receipt.json"), "utf8"));
  if (resumedReceipt.projectRef !== project || !/^[0-9a-f]{64}$/.test(resumedReceipt.ciphertextSha256) || !fs.existsSync(path.join(directory, "source-manifest.json")))
    throw new Error("Completed encrypted dump and source fingerprints required");
  Object.assign(report, resumedReceipt, { ok: false, phase: "resume-archive-verification", resumedAt: new Date().toISOString(), previousErrorCode: resumedReceipt.errorCode });
  delete report.errorCode;
}
let restore,
  localCreated = false,
  sourceTransaction = false;
const socketErrors = [];
function captureSocketError(client) {
  client.on("error", (error) => {
    socketErrors.push(/^[A-Z0-9_]{5,80}$/.test(error?.code ?? "") ? error.code : "connection_error");
  });
}
captureSocketError(remote);
captureSocketError(local);
function assert(condition) {
  if (!condition) throw new Error("Backup/restore verification failed");
}
function secureDirectory(name) {
  if (!fs.existsSync(name)) fs.mkdirSync(name, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(name);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.mode & 0o077) throw new Error("Private backup directory required");
}
function identifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error("Unexpected database identifier");
  return `"${value}"`;
}
// No shell, URL arguments, inherited database configuration or raw child diagnostics.
const commandEnv = { PATH: process.env.PATH, LANG: "C", PGCONNECT_TIMEOUT: "10", PGAPPNAME: "meldiq-staging-backup" };
function child(command, args, env = {}, options = {}) {
  const process = spawn(command, args, { env: { ...commandEnv, ...env }, stdio: ["pipe", "pipe", "pipe"], ...options });
  process.stderr.resume();
  const done = new Promise((resolve, reject) => {
    process.once("error", () => reject(new Error("Backup tool could not start")));
    process.once("close", (code) => (code === 0 ? resolve() : reject(new Error("Backup tool failed"))));
  });
  done.catch(() => undefined);
  return { process, done };
}
async function tableManifest(client) {
  const tables = (
    await client.query(
      `SELECT n.nspname AS schema,c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=ANY($1::text[]) AND c.relkind IN ('r','p') AND NOT c.relispartition ORDER BY n.nspname,c.relname`,
      [schemas],
    )
  ).rows;
  const manifest = [];
  for (let offset = 0; offset < tables.length; offset += 8) {
    const batch = tables.slice(offset, offset + 8);
    // Four exact 64-bit signed sums of SHA-256 row hashes, plus counts. Constant aggregate memory; no row contents leave PostgreSQL.
    const results = await client.query(
      batch
        .map((table) => {
          const row = "encode(sha256(convert_to(row_to_json(t)::text,'UTF8')),'hex')";
          return `SELECT count(*)::text AS count, ${[0, 1, 2, 3].map((part) => `coalesce(sum(('x'||substr(${row},${part * 16 + 1},16))::bit(64)::bigint::numeric),0)::text AS s${part}`).join(",")}
        FROM ${identifier(table.schema)}.${identifier(table.name)} t`;
        })
        .join(";"),
    );
    const list = Array.isArray(results) ? results : [results];
    for (const [i, result] of list.entries()) {
      const value = result.rows[0];
      manifest.push({ ...batch[i], count: value.count, rowChecksum: crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex") });
    }
  }
  return manifest;
}
async function testRestoredAuth() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const keys = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const privateJwk = { ...keys.privateKey.export({ format: "jwk" }), kid: crypto.randomUUID(), alg: "ES256", use: "sig", key_ops: ["sign", "verify"] };
  // The archive already includes the exact managed Auth schema/history. The official serve command does not replay migrations over that snapshot.
  const service = child(
    path.join(authRuntime, "auth"),
    ["serve"],
    {
      GOTRUE_DB_DATABASE_URL: `postgresql://postgres@127.0.0.1:55432/${restoreName}?sslmode=disable&options=-c%20search_path%3Dauth%2Cextensions`,
      GOTRUE_DB_NAMESPACE: "auth",
      GOTRUE_DB_DRIVER: "postgres",
      GOTRUE_API_HOST: "127.0.0.1",
      GOTRUE_API_PORT: String(port),
      API_EXTERNAL_URL: origin,
      GOTRUE_SITE_URL: origin,
      GOTRUE_JWT_SECRET: crypto.randomBytes(48).toString("base64url"),
      GOTRUE_JWT_KEYS: JSON.stringify([privateJwk]),
      GOTRUE_JWT_ISSUER: origin,
      GOTRUE_JWT_EXP: "300",
      GOTRUE_JWT_AUD: "authenticated",
      GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
      GOTRUE_JWT_ADMIN_ROLES: "service_role",
      GOTRUE_DISABLE_SIGNUP: "true",
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
      GOTRUE_EXTERNAL_PHONE_ENABLED: "false",
      GOTRUE_DB_MAX_POOL_SIZE: "2",
      GOTRUE_DB_CLEANUP_ENABLED: "false",
      GOTRUE_DB_ADVISOR_ENABLED: "false",
      GOTRUE_DB_MIGRATIONS_PATH: path.join(authRuntime, "migrations"),
      GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED: "true",
      LOG_LEVEL: "fatal",
      GOTRUE_LOG_LEVEL: "fatal",
      GOTRUE_TRACING_ENABLED: "false",
      GOTRUE_METRICS_ENABLED: "false",
    },
    { cwd: directory },
  );
  authProcess = service;
  service.process.stdin.end();
  service.process.stdout.resume();
  const deadline = performance.now() + 30_000;
  let healthy = false;
  while (performance.now() < deadline && service.process.exitCode === null) {
    try {
      const response = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        assert((await response.json()).version === "v2.197.0");
        healthy = true;
        break;
      }
    } catch {
      /* bounded readiness probe */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  report.authProcessExitCode = service.process.exitCode;
  assert(healthy);
  report.authHealthPassed = true;
  const post = (route, body, token) =>
    fetch(`${origin}${route}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
  report.phase = "restored-auth-wrong-password";
  const wrong = await post("/token?grant_type=password", { email: probe.email, password: crypto.randomBytes(24).toString("base64url") });
  report.authWrongPasswordHttpStatus = wrong.status;
  assert(wrong.status === 400);
  report.phase = "restored-auth-password-login";
  const login = await post("/token?grant_type=password", { email: probe.email, password: probe.password });
  report.authLoginHttpStatus = login.status;
  assert(login.ok);
  const session = await login.json();
  assert(session.user?.id === probe.id && session.access_token && session.refresh_token);
  const [headerText, payloadText, signatureText] = session.access_token.split(".");
  const header = JSON.parse(Buffer.from(headerText, "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(payloadText, "base64url").toString("utf8"));
  assert(header.alg === "ES256" && header.kid === privateJwk.kid && payload.sub === probe.id && payload.iss === origin && payload.aud === "authenticated");
  assert(crypto.verify("sha256", Buffer.from(`${headerText}.${payloadText}`), { key: keys.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signatureText, "base64url")));
  assert((await fetch(`${origin}/user`, { headers: { authorization: `Bearer ${session.access_token}` }, signal: AbortSignal.timeout(10_000) })).ok);
  report.phase = "restored-auth-refresh-logout";
  const refresh = await post("/token?grant_type=refresh_token", { refresh_token: session.refresh_token });
  assert(refresh.ok);
  const refreshed = await refresh.json();
  assert(refreshed.user.id === probe.id && refreshed.refresh_token !== session.refresh_token);
  assert((await post("/logout?scope=global", undefined, refreshed.access_token)).ok);
  assert(!(await post("/token?grant_type=refresh_token", { refresh_token: refreshed.refresh_token })).ok);
  assert((await restore.query("SELECT count(*)::integer AS count FROM auth.sessions WHERE user_id=$1", [probe.id])).rows[0].count === 0);
  report.restoredAuth = {
    version: "v2.197.0",
    officialArchiveSha256: authArchiveSha256,
    loopbackOnly: true,
    matchingHostedVersion: true,
    officialCommand: "serve",
    restoredManagedMigrationsReplayed: false,
    wrongPasswordDenied: true,
    originalPasswordSameSubject: true,
    asymmetricJwtVerified: true,
    userEndpointAccepted: true,
    refreshRotated: true,
    logoutRemovedSessions: true,
    refreshAfterLogoutDenied: true,
    newIsolatedSigningKey: true,
    smtpOAuthAndRealtimeNotTested: true,
  };
  report.authPasswordSessionRestoreTested = true;
}
try {
  secureDirectory(privateRoot);
  secureDirectory(keysDirectory);
  if (!fs.existsSync(keyFile)) {
    const generated = spawnSync("age-keygen", ["-o", keyFile], { env: commandEnv, encoding: "utf8" });
    assert(generated.status === 0);
  }
  const keyStat = fs.lstatSync(keyFile);
  assert(keyStat.isFile() && !keyStat.isSymbolicLink() && !(keyStat.mode & 0o077));
  const recipient = spawnSync("age-keygen", ["-y", keyFile], { env: commandEnv, encoding: "utf8" });
  assert(recipient.status === 0 && /^age1[0-9a-z]+\s*$/.test(recipient.stdout));
  if (resumeDirectory) secureDirectory(directory);
  else fs.mkdirSync(directory, { mode: 0o700 }); // refuses reuse of a previous backup directory
  if (testAuth) {
    assert(settings.SUPABASE_SECRET_KEY?.startsWith("sb_secret_"));
    const archiveHash = crypto.createHash("sha256");
    for await (const data of fs.createReadStream(path.join(authRuntime, "auth-v2.197.0-darwin-arm64.tar.gz"))) archiveHash.update(data);
    assert(archiveHash.digest("hex") === authArchiveSha256);
    const binaryVersion = spawnSync(path.join(authRuntime, "auth"), ["version"], { env: commandEnv, encoding: "utf8" });
    assert(binaryVersion.status === 0 && binaryVersion.stdout.trim() === "v2.197.0");
    const health = await fetch(`https://${project}.supabase.co/auth/v1/health`, { headers: { apikey: "sb_publishable_DSnteWCwZ3WumfEgQYWGyg_HhOQr5_f" }, signal: AbortSignal.timeout(10_000) });
    assert(health.ok && (await health.json()).version === "v2.197.0");
    const email = `restore-${run}@example.invalid`,
      password = crypto.randomBytes(36).toString("base64url");
    const created = await authAdmin.auth.admin.createUser({ email, password, email_confirm: true });
    assert(!created.error && created.data.user);
    probe = { id: created.data.user.id, email, password }; // test credentials stay in memory only
    report.syntheticAuthUsersCreated = 1;
  }
  await local.connect();
  let expected;
  if (resumeDirectory) {
    expected = JSON.parse(fs.readFileSync(path.join(directory, "source-manifest.json"), "utf8")).tables;
  } else {
    await remote.connect();
    await remote.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    sourceTransaction = true;
    await remote.query("SET LOCAL timezone='UTC'; SET LOCAL extra_float_digits=3; SET LOCAL idle_in_transaction_session_timeout='10min'");
    const snapshot = (await remote.query("SELECT pg_export_snapshot() AS id,current_setting('server_version') AS version")).rows[0];
    assert(/^17\./.test(snapshot.version));
    assert(/^[0-9A-F-]+$/i.test(snapshot.id));
    report.sourceVersion = snapshot.version;
    report.dumpVersion = version.stdout.trim();
    report.phase = "encrypted-dump";
    const started = performance.now();
    const dump = child(pgDump, ["--format=custom", "--no-owner", "--no-acl", "--strict-names", "--lock-wait-timeout=5s", `--snapshot=${snapshot.id}`, ...schemas.map((name) => `--schema=${name}`)], {
      PGHOST: source.hostname,
      PGPORT: source.port,
      PGDATABASE: "postgres",
      PGUSER: decodeURIComponent(source.username),
      PGPASSWORD: decodeURIComponent(source.password),
      PGSSLMODE: "verify-full",
      PGSSLROOTCERT: settings.SUPABASE_DB_CA_FILE,
      PGOPTIONS: "-c timezone=UTC -c extra_float_digits=3",
    });
    dump.process.stdin.end();
    const encryption = child("age", ["-r", recipient.stdout.trim()]);
    const destination = fs.createWriteStream(archive, { flags: "wx", mode: 0o600 });
    try {
      await Promise.all([pipeline(dump.process.stdout, encryption.process.stdin), pipeline(encryption.process.stdout, destination), dump.done, encryption.done]);
    } finally {
      dump.process.kill();
      encryption.process.kill();
    }
    report.dumpAndEncryptionMs = Math.round(performance.now() - started);
    report.phase = "source-snapshot-checksums";
    expected = await tableManifest(remote);
    fs.writeFileSync(path.join(directory, "source-manifest.json"), JSON.stringify({ snapshot: snapshot.id, tables: expected }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    await remote.query("COMMIT");
    sourceTransaction = false;
  }
  const ciphertextHash = crypto.createHash("sha256");
  for await (const data of fs.createReadStream(archive)) ciphertextHash.update(data);
  const archiveHash = ciphertextHash.digest("hex");
  if (resumedReceipt) assert(archiveHash === resumedReceipt.ciphertextSha256);
  report.ciphertextSha256 = archiveHash;
  report.encryptedBytes = fs.statSync(archive).size;
  report.phase = "archive-authentication-and-list";
  // pg_restore --list exits after its TOC, before a large data section has been consumed. First authenticate
  // the ENTIRE encrypted archive independently; a successful TOC listing does not establish this on its own.
  const authentication = child("age", ["-d", "-i", keyFile, archive]);
  authentication.process.stdout.resume();
  await authentication.done;
  report.entireEncryptedArchiveAuthenticated = true;
  const decrypt = child("age", ["-d", "-i", keyFile, archive]);
  const listing = child(pgRestore, ["--list"]);
  let list = "";
  listing.process.stdout.on("data", (data) => {
    list += data;
    if (list.length > 2_000_000) listing.process.kill();
  });
  const feeding = pipeline(decrypt.process.stdout, listing.process.stdin);
  feeding.catch(() => undefined);
  try {
    await listing.done;
    decrypt.process.kill();
    // TOC consumption may produce EPIPE/early-close. Full age authentication passed above, and the subsequent
    // pg_restore consumes all table data and must reconcile against the original exported-snapshot hashes.
    await Promise.allSettled([feeding, decrypt.done]);
  } finally {
    decrypt.process.kill();
    listing.process.kill();
  }
  assert(schemas.every((schema) => list.includes(`SCHEMA - ${schema} `)));
  assert(list.includes("TABLE DATA auth users ") && list.includes("TABLE DATA auth identities ") && list.includes("TABLE DATA meldiq_private auth_links "));
  report.archiveAuthenticatedAndReadable = true;
  report.phase = "independent-loopback-restore";
  assert(/^meldiq_restore_hosted_[0-9a-f]{16}$/.test(restoreName));
  await local.query(`CREATE DATABASE ${identifier(restoreName)} TEMPLATE template0`);
  localCreated = true;
  restore = new Client({ ...localConfig, database: restoreName });
  captureSocketError(restore);
  await restore.connect();
  // Plain PostgreSQL has no Realtime server. Its dependencies are inert harness contracts, explicitly excluded from the acceptance claim.
  await restore.query(`CREATE SCHEMA realtime; CREATE TABLE realtime.messages(id uuid DEFAULT gen_random_uuid(),extension text,payload jsonb,event text,topic text,private boolean);
    CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('realtime.topic',true) $$;
    CREATE FUNCTION realtime.send(jsonb,text,text,boolean DEFAULT true) RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END $$;
    CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions; CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;`);
  const restoreStarted = performance.now();
  const plaintext = child("age", ["-d", "-i", keyFile, archive]);
  const restoring = child(pgRestore, ["--no-owner", "--no-acl", "--exit-on-error", "--single-transaction", `--dbname=${restoreName}`], {
    PGHOST: "127.0.0.1",
    PGPORT: "55432",
    PGUSER: "postgres",
    PGSSLMODE: "disable",
  });
  restoring.process.stdout.resume();
  try {
    await Promise.all([pipeline(plaintext.process.stdout, restoring.process.stdin), plaintext.done, restoring.done]);
  } finally {
    plaintext.process.kill();
    restoring.process.kill();
  }
  report.restoreMs = Math.round(performance.now() - restoreStarted);
  report.phase = "restored-row-reconciliation";
  await restore.query("SET timezone='UTC'; SET extra_float_digits=3");
  const actual = await tableManifest(restore);
  const restoredManifest = path.join(directory, "restored-manifest.json");
  const restoredText = JSON.stringify({ tables: actual }, null, 2) + "\n";
  if (resumeDirectory && fs.existsSync(restoredManifest)) assert(fs.readFileSync(restoredManifest, "utf8") === restoredText);
  else fs.writeFileSync(restoredManifest, restoredText, { flag: "wx", mode: 0o600 });
  assert(JSON.stringify(expected) === JSON.stringify(actual));
  report.reconciledTables = actual.length;
  report.reconciledRows = actual.reduce((total, table) => total + Number(table.count), 0);
  report.authTables = actual.filter((table) => table.schema === "auth").length;
  report.authUsers = Number(actual.find((table) => table.schema === "auth" && table.name === "users").count);
  report.passwordHashesAndIdentitiesIncludedInExactRowChecks = true;
  report.policyScope = "Stored Auth/application/migration rows and definitions only; no Auth/Realtime service or production role grants restored";
  if (reconcileSource) {
    report.phase = "full-restored-source-comparison";
    const { reconcileRestoredSource } = await import(pathToFileURL(path.resolve(server, "../deploy/database-migration/reconcile-restored-source.mjs")).href);
    report.sourceManifestSha256 = crypto.createHash("sha256").update(JSON.stringify(expected)).digest("hex");
    report.sourceReconciliation = await reconcileRestoredSource({
      snapshot: reconcileSource,
      database: restoreName,
      directory,
      sourceManifestSha256: report.sourceManifestSha256,
      ciphertextSha256: report.ciphertextSha256,
    });
  }
  if (testAuth) {
    report.phase = "restored-auth-startup";
    await testRestoredAuth();
    report.policyScope = "Exact database row reconciliation plus matching-version local Auth login/refresh/logout; no Realtime, OAuth, SMTP or production role-grant acceptance";
  }
  report.phase = "complete";
  report.ok = true;
} catch (error) {
  report.errorCode = /^[A-Z0-9_]{5,40}$/.test(error?.code ?? "") ? error.code : "operation_failed";
  process.exitCode = 1;
} finally {
  if (authProcess) {
    authProcess.process.kill("SIGTERM");
    const timer = setTimeout(() => authProcess.process.kill("SIGKILL"), 5_000);
    await authProcess.done.catch(() => undefined);
    clearTimeout(timer);
  }
  if (probe) {
    const banned = await authAdmin.auth.admin.updateUserById(probe.id, { ban_duration: "876000h" }).catch(() => ({ error: true }));
    report.syntheticSourceProbeBanned = !banned.error;
    if (banned.error) {
      report.ok = false;
      process.exitCode = 1;
    }
  }
  if (sourceTransaction) await remote.query("ROLLBACK").catch(() => undefined);
  await remote.end().catch(() => undefined);
  await restore?.end().catch(() => undefined);
  if (localCreated) {
    try {
      await local.query(`DROP DATABASE ${identifier(restoreName)} WITH (FORCE)`);
      report.ownedScratchDatabaseRemoved = true;
    } catch {
      report.ownedScratchDatabaseRemoved = false;
      report.ok = false;
      process.exitCode = 1;
    }
  }
  await local.end().catch(() => undefined);
  report.completedAt = new Date().toISOString();
  if (socketErrors.length) report.connectionErrorCodes = [...new Set(socketErrors)];
  const receiptFile = path.join(root, "docs/testing/supabase-hosted-backup-restore-results.json");
  const historyFile = path.join(root, "docs/testing/supabase-hosted-backup-restore-history.json");
  const history = fs.existsSync(historyFile) ? JSON.parse(fs.readFileSync(historyFile, "utf8")) : fs.existsSync(receiptFile) ? [JSON.parse(fs.readFileSync(receiptFile, "utf8"))] : [];
  fs.writeFileSync(historyFile, JSON.stringify([...history, report].slice(-50), null, 2) + "\n");
  fs.writeFileSync(receiptFile, JSON.stringify(report, null, 2) + "\n");
  if (fs.existsSync(directory))
    fs.writeFileSync(path.join(directory, resumeDirectory ? `resume-receipt-${Date.now()}.json` : "receipt.json"), JSON.stringify(report, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify(report));
}
