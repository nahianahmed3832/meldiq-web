# Backup and restore guide

Historical Atlas encrypted backups and actual Atlas restore receipts remain preserved in `docs/database-migration`; they do not certify Supabase recovery. No legacy backup/database/bucket was deleted.

## Separate backup scopes

- PostgreSQL application schemas, rows, constraints, migrations, auth ownership/revocation and outbox/checkpoints.
- Supabase Auth users/identities and required provider/session configuration through supported backup/migration procedures; account restoration needs the same verified internal mapping.
- Trusted private backend env/config, encryption/report keys and provider secrets in separate protected escrow.
- S3 objects and bucket/lifecycle/access policies remain AWS responsibility; a database backup holds references, not bytes.
- Device-held keys/offline outboxes remain on devices until acknowledged. Never export plaintext device secrets as a database convenience.

## Procedure

Use a direct supported PostgreSQL connection with certificate/hostname verification and a separately scoped backup role. Record database/server/runtime versions, UTC timestamps and migration checksums. Produce encrypted backups with strong authenticated encryption; escrow the recovery key independently and retain off-host copies. Include row counts/record hashes and provider-event/financial totals without sensitive samples in public reports. Verify archive readability and ciphertext hashes before calling a backup complete.

Restore into an empty unpublished matching environment, rebuild required roles/migrations and compare every row/reference/hash/timestamp/financial total. Verify Auth ownership/recovery, negative RLS, API contracts, S3 signed access, Realtime catch-up and worker idempotency. Disable customer-facing push/payment dispatch while restoring old jobs. Record measured RPO/RTO and failures. Never restore an older snapshot over live post-cutover writes without reconciliation.

Free staging requires explicit operator backups; do not assume daily managed backups or PITR. Production backup retention/PITR and off-host encrypted storage must be selected based on required RPO, region/residency and verified pricing. Target recovery objectives remain uncommitted until measured.

The local synthetic PostgreSQL dump/restore drill is recorded in the migration-test report when executed. Hosted Auth/Realtime restoration and production-scale restore remain separate mandatory gates.

## Executable Frankfurt snapshot and independent local restore

Run from the web repository:

```sh
node scripts/supabase/install-auth-restore-runtime.mjs
node scripts/supabase/backup-restore-staging.mjs --test-auth
```

The runtime installer is restricted to macOS arm64 and pins the official Supabase Auth v2.197.0 archive and SHA-256. It installs a private test executable, with no system service. The harness checks the hosted health version matches before creating one owned synthetic Auth probe. Its random password remains in memory. It bans that source probe on cleanup; it never looks up or changes unrelated Auth users.

The source URL is read only from the known mode600 staging file and pinned to the Frankfurt project/session pooler. pg_dump17 uses verified TLS and an exported read-only repeatable-read snapshot shared with checksum queries. The snapshot includes auth, meldiq, meldiq_private and supabase_migrations. SQL credentials are child environment values, never command arguments. pg_dump streams directly through age into a new mode600 archive; no plaintext dump file is written. Table row counts plus four exact numeric sums of SHA-256 row-hash segments are computed inside PostgreSQL with constant aggregate memory. The encrypted archive is authenticated/decrypted and listed before restore.

Only a freshly created owned `meldiq_restore_hosted_<random>` database on127.0.0.1:55432 is accepted for restoration. An independent pg_restore runs in one transaction and every table checksum/count is compared before Auth writes. Managed Realtime dependencies are inert local contracts: this does not restore a Realtime server or its managed policies. No remote restore or overwrite mode exists. Roles/ACLs, OAuth/SMTP/provider configuration, hosted signing keys, external objects and device-held secrets are separate recovery scopes.

The official Auth `serve` command starts against the restored schema without replaying its already captured managed migrations. Its local connection explicitly sets search_path=auth,extensions, matching the schema lookup normally supplied by the hosted Auth role. The initial default-command attempt failed while replaying old migrations and is retained as failed evidence. The Auth acceptance checks exercise the original probe password and subject, reject a wrong password, verify a new local ES256 JWT, access the user endpoint, rotate refresh tokens and reject refresh after logout. Newly generated local signing keys do not preserve existing hosted token validity. Do not copy hosted private signing keys casually to avoid a relogin.

Archives and row manifests remain under the private local staging support directory. The age identity is under its separate recovery-keys directory with mode600. This protects against accidental Git/log exposure; it is not independent disaster recovery. Escrow the recovery key separately and verify an encrypted off-host recovery copy before production acceptance. Do not put keys/passwords into chat. Public receipts contain aggregate counts, ciphertext hashes, timings and safe status codes only.

Primary references: [Supabase backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [platform to self-hosted recovery scope](https://supabase.com/docs/guides/self-hosting/restore-from-platform), [official Auth serve command](https://github.com/supabase/auth/blob/v2.197.0/cmd/serve_cmd.go), [PostgreSQL17 pg_dump snapshots](https://www.postgresql.org/docs/17/app-pgdump.html).

The final executed snapshot/Auth drill passes:314 tables/1,395 rows reconcile, with original-password/same-subject login, wrong-password rejection, ES256 verification, refresh rotation, logout and denied subsequent refresh. The public receipt retains scope limits and the Node25 TLS shutdown warning. No off-host recovery claim is made.
