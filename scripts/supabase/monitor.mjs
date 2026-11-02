import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(import.meta.dirname, "../..");
const settings = Object.fromEntries(
  fs
    .readFileSync(path.join(os.homedir(), ".local/share/meldiq-supabase/staging.env"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at), line.slice(at + 1)];
    }),
);
if (settings.SUPABASE_ENVIRONMENT !== "staging" || settings.SUPABASE_EXPECTED_PROJECT_REF !== "bkvlxbsnzqkhbifawcww") throw new Error("Staging identity required");
const require = createRequire(path.resolve(root, "../meldiq_supabase_migration/server/package.json"));
const { Pool } = require("pg");
const db = new Pool({
  connectionString: settings.SUPABASE_DATABASE_URL,
  max: 1,
  ssl: { rejectUnauthorized: true, ca: fs.readFileSync(settings.SUPABASE_DB_CA_FILE, "utf8") },
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});
db.on("error", () => {});
try {
  const database = (
    await db.query(`SELECT pg_database_size(current_database())::text AS bytes,
    (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database())::text AS connections,
    current_setting('max_connections') AS connection_limit`)
  ).rows[0];
  const outbox = (
    await db.query(`SELECT count(*) FILTER(WHERE dead_at IS NOT NULL AND delivered_at IS NULL)::text AS dead,
    coalesce(extract(epoch FROM now()-min(created_at) FILTER(WHERE delivered_at IS NULL)),0)::text AS oldest_seconds
    FROM meldiq_private.outbox`)
  ).rows[0];
  const budget = Number(process.env.MELDIQ_DB_BUDGET_BYTES ?? 256 * 1024 * 1024);
  if (!Number.isSafeInteger(budget) || budget <= 0) throw new Error("Invalid database budget");
  const migration = (await db.query("SELECT count(*)::text AS batches, coalesce(sum(record_count),0)::text AS records FROM meldiq_private.migration_batches")).rows[0];
  console.log(`meldiq_migration_completed_batches ${migration.batches}`);
  console.log(`meldiq_migration_checkpoint_records ${migration.records}`);
  console.log(`meldiq_database_bytes ${database.bytes}`);
  console.log(`meldiq_database_connections ${database.connections}`);
  console.log(`meldiq_outbox_dead ${outbox.dead}`);
  console.log(`meldiq_outbox_oldest_seconds ${outbox.oldest_seconds}`);
  console.log(`meldiq_usage_ratio{resource="database_budget"} ${Number(database.bytes) / budget}`);
  console.log(`meldiq_usage_ratio{resource="connections"} ${Number(database.connections) / Number(database.connection_limit)}`);
  // Provider usage must be supplied by a trusted metering feed. Missing data is never represented as zero usage.
  const usageFile = process.env.MELDIQ_MONTHLY_USAGE_FILE;
  console.log(`meldiq_usage_feed_present ${usageFile ? 1 : 0}`);
  if (usageFile) {
    const usage = JSON.parse(fs.readFileSync(usageFile, "utf8"));
    for (const resource of ["realtime_messages", "auth_mau", "egress_bytes"]) {
      const item = usage[resource];
      if (!item || !Number.isFinite(item.used) || !Number.isFinite(item.limit) || item.used < 0 || item.limit <= 0) throw new Error("Incomplete metering feed");
      console.log(`meldiq_usage_ratio{resource="${resource}"} ${item.used / item.limit}`);
    }
  }
} catch {
  console.error("Staging monitoring failed; no credentials or raw query errors logged");
  process.exitCode = 1;
} finally {
  await db.end();
}
