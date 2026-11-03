# Frankfurt database cutover, November 3, 2026

Supabase PostgreSQL is the live application database. Authority committed at **07:58:37 UTC**, and the public API was verified at **07:58:50 UTC**. The selected Frankfurt project is `bkvlxbsnzqkhbifawcww` (`eu-central-1`), previously named Meldiq Staging. Atlas and the former SQLite files are retained for recovery and do not serve as alternative application authorities.

This completes the approved database compatibility phase. Existing account/device authentication and Fastify HTTP/WebSocket contracts remain active. Unified Supabase Auth and managed Realtime have not been activated. The separate Stockholm social-sign-in project remains in place.

## Data and integrity

The final frozen Atlas capture contains 690,414 documents in 275 collections. Its active application subset contains **675,918 records across 282 typed tables**: 27 accounts, 67 users, 129 devices, 196 conversations, 12 organizations, 526 attachment references and two billing plan versions. Legacy migration/conflict/meta archives remain in the authenticated encrypted source backup.

Source fingerprint: `4cd5d42dfe14499fa26cdc0fb5b8eb6f56a487e79ab32a32d0702bd3ecf94ba1`; snapshot `d5b0d94d-e341-4294-8597-141feacd1a93`.

All source file checksums, every application row hash, timestamp ranges, financial totals and counter floors reconciled on an independently restored PostgreSQL snapshot. The final delta inserted 3,633 rows, updated 52 and deleted 7,307. Before activation, all 289 live protected-table fingerprints matched that verified backup, including after the real API started held. All 15 schema migrations are applied; the hosted RLS checks passed without anonymous/authenticated raw application-table access.

At the source freeze, all 526 attachment references were accessible: 491 S3 object sizes matched, with 35 readable local fallbacks. The database transition did not move object contents. A separate authorized media migration subsequently updated media delivery; its latest release was preserved when applying the database pool fix.

## Release and verification

The initial accepted runtime was f2f7c6c3. The active pool-fix image is **3ea76ff9**, image ID `sha256:f8856b01157e9a5efb448bc331da3683b59a6110ad6252c3f258704e1326e30c`. It preserves the exact b7bffce7 media release, changing only the database client module. Canonical deployment comparison preserved all other integration settings, mounts and services. The original source-bound acceptance and durable authority receipts were kept.

Reconnect bursts initially exposed five-second pool checkout failures. The correction allows 15 seconds for bounded pool checkout while physical connection establishment still stops after five seconds. The production pool is capped at six. All 123 dedicated PostgreSQL tests pass, including a real six-second queue wait and an unresponsive socket test. Typechecking, 21 affected media tests and 40 architecture/federation/publication checks pass. The source follow-up2dae0d27 routes the retention constant through the files module's public API without changing its value or behavior. It is a source-layout correction for the next API publication; the running artifact remains3ea76ff9.

The exact runtime and prior media image passed an unpublished synthetic PostgreSQL canary with a simulated 168 ms database round trip: 20 messages at concurrency eight, zero errors, p95 4,161 ms, 20 WebSocket deliveries, idempotent retry, both retained sessions and all committed messages after application rollback, plus one new post-rollback message. This is a bounded two-client check, not a large-user capacity certification. Physical-device, live payment-provider and full native Auth/Realtime acceptance are not claimed.

Post-update checks show PostgreSQL, Redis and LiveKit healthy with no API container restarts. The earlier PostgreSQL pool errors did not recur in the observed updated container. Eleven Redis command timeouts occurred together at08:58:56 UTC after restart; no additional errors were observed through09:10 UTC. This event is retained in the record rather than presented as a clean error-free interval.

## Recovery and operations

The pre-activation encrypted database archive independently restored all 317 stored tables/677,209 rows and matched the complete frozen application source. The first production backup also restored and matched all 317 tables. The newer production bundle at **20261103T090738Z** independently restored **317 tables/677,180 rows** and authenticated **14 encrypted payloads**, including the authority/acceptance receipts, canonical configuration, actual effective API environment, push service account, reports key and local media. The effective environment preserves settings supplied through additional media env files. Stored-row/schema recovery is verified; full Auth/Realtime/OAuth/SMTP service recovery and production-role recreation are excluded.

The complete encrypted Atlas source is verified on the Mac and VPS. A re-encrypted copy uses the existing VPS recovery identity, which is independently mirrored on the Mac; its compressed plaintext fingerprint matches the original capture. No plaintext dump was written. No legacy database or source bucket was deleted by this database migration.

The existing daily encrypted-backup timer now dispatches to PostgreSQL. The hourly Mac mirror remains installed; it requires the Mac and SSH host to be reachable. The old staging mutation helpers are fenced by production environment settings. Further native Auth/Realtime experiments require a separate synthetic staging environment.

After PostgreSQL accepts writes, **never restart Atlas as the application authority**. Use the validated prior PostgreSQL media image b7bffce7 (`sha256:7adf52744c507df0dcaecc3532123b32ab699e3535cc8166c923d332745d2bb5`) on the same PostgreSQL database and retained data volume. Its immutable recovery tag is recorded in the private image receipt. Older database-only rollback images lack the newer media behavior and are superseded. No reverse transfer of new production writes to Atlas has been implemented.

Before future API releases, acquire the shared release lock, inspect the actual live image and effective canonical deployment, preserve concurrent feature changes, update only the API with `--no-deps`, and keep its CA, acceptance, authority receipt, integrations and volume. Do not regenerate the old full-stack template or remove retained Redis services. An API-only rollback keeps PostgreSQL authoritative.

## Maintenance and remaining scope

Two pre-activation windows safely returned to Atlas: approximately38 minutes for a legacy social-sign-in startup guard, then approximately20 minutes when remote full-row transfer was too slow. PostgreSQL did not serve customer writes in either attempt. The successful final database window lasted **23 minutes44 seconds**, including final source transfer, reconciliation, recovery verification and held startup. The later pool correction used a separate brief API restart without another data transfer or authority change. Storage-task maintenance is recorded separately.

Native Supabase Auth/Realtime activation remains blocked by its separate identity/client acceptance and connected-channel revocation work. No paid plan or billing change was enabled by this database phase. Full platform production readiness is not declared by this report.

Aggregate evidence: [cutover receipt](../testing/supabase-production-database-cutover.json), [retained-data canary](../testing/supabase-vps-compatibility-load-rollback.json), and [production-settings preflight](../testing/supabase-production-settings-preflight.json).
