# Migration test report

> Current database authority: Frankfurt Supabase PostgreSQL, active since November3 at07:58 UTC. The [final cutover report](../migrations/production-database-cutover-20261103.md) supersedes historical staging checkpoints below. Native Auth/Realtime remain a separate unfinished phase.

November 2, 2026. **Production readiness is blocked. All new hosted records are synthetic; no customer data was imported and no production cutover occurred.**

## Executed verification

| Scope | Result | Evidence and limits |
|---|---|---|
| PostgreSQL17 schema/repositories/security | 95 passed, zero failed | `supabase-postgres-results.json`; isolated loopback databases created/dropped by the harness; all twelve migrations replayed locally |
| Hosted Frankfurt migrations/RLS | Twelve migrations applied; all 286 tables secure; ten pgTAP assertions passed | `staging-migration-test-native-results.json`; official CLI push plus verified-TLS execution of the actual pgTAP SQL |
| Full PostgreSQL API parity (local) | 692 passed, zero failed/skipped | `supabase-api-full-results.json`, 56 test files; isolated PostgreSQL databases, existing API contracts and fake external providers |
| Auth follow-up API/contracts regression | 87 passed, zero failed | `supabase-auth-regression-results.json`; includes generated contracts, accounts, deletion/devices and admin controls on PostgreSQL |
| Legacy collection regression | 12 passed, zero failed | `supabase-collections-regression-results.json`; pins/media/files/threads, privacy, tied cursors and malformed payloads on SQLite/MongoDB |
| Hosted Fastify/PostgreSQL API | Eight checks passed with zero SQLite attempts | `supabase-hosted-api-results.json`; actual Frankfurt restricted runtime login; account verification/device proof, messages/outbox, private preferences, anonymous denial, restart/refresh and logout |
| Staging runtime privilege boundary | Passed | `staging-runtime-role-results.json`; separate LOGIN inherits meldiq_api; no privileged attributes, Auth-user writes or schema creation |
| Hosted Auth/private Realtime | Ten checks passed | `supabase-hosted-smoke-results.json`; real project Auth/JWKS, refresh/logout, owner/foreign/private/public joins, Broadcast, Presence, offline gap recovery and revocation |
| Frozen local data rehearsal | 279 application tables, 1,009 records reconciled | `supabase-rehearsal-results.json`; per-row canonical hashes/counts/timestamp ranges and exact financial fixture total 1250 minor units |
| Hosted frozen data rehearsal | 269-table catalog, 1,009 records imported/resumed/reconciled | `staging-rehearsal-results.json`, `staging-reconciliation.json`; before eight administration tables and later independent smoke fixtures |
| Backup and independent restore | Passed for synthetic local database | Custom pg_dump and pg_restore into another database; all 1,009 records reconciled. The later hosted snapshot/Auth drill is recorded separately below; PITR, complete Supabase-stack restore and production rollback are not certified |
| Web dedicated adapters/bridge | 19 tests passed | `supabase-web-results.json`; encrypted persistent IDB session storage, privileged-key rejection, strict private invalidations/reconnect/race fencing and staged device-link transport |
| Full web suite | 877 passed, one skipped, zero failed | `web-full-results.json`; current adapters are staged, so this is not migrated UI feature parity |
| Legacy backend regressions before pause | 142 plus 39 administration tests passed | Focused account/social/message/S3/billing/auth/frame and latest admin compatibility suites |
| Legacy backend regressions after resume | 77 passed, zero failed | `supabase-legacy-regression-results.json`; files, attachments, preferences, activity, recovery, key backup and encrypted-history suites |
| Android staged Auth and migration transport | 10 Kotlin/JVM tests passed | `supabase-android-transport-results.json`; exact source/tests in an isolated harness. Earlier full app compilation predates the new transport; no physical-device acceptance |
| Builds/static checks | Backend build, web typecheck/lint/production build passed | Backend rebuilt after repository changes; web typecheck and targeted lint repeated after the bridge; no page/UI migration activated |
| Dependency audit | Backend runtime zero; web runtime zero | Web development tools have 11 moderate existing advisories; no forced unrelated major downgrade |

## Repository acceptance exercised

- Atomic message/event outbox, idempotent imported history, read/search/pagination behavior, lease fencing/retry/dead-letter ordering and replay.
- PostgreSQL ownership constraints; direct client denials; backend NOBYPASSRLS; malformed historical payload handling; JWT signature/issuer/audience/session validation; provider logout and local revocation.
- Attachment completion/expiry races, stale cancellation, exact ciphertext bytes and existing multipart IDs, retry state, rollback on failed cleanup, restart durability and parent FK cascades. Deferred SQL triggers preserve cleanup even if the API process never runs a cascade callback.
- Fastify attachment endpoints against PostgreSQL metadata and the existing independent SigV4 S3 test server: signed PUT/GET, membership-protected downloads, exact 1,024,000,000 plaintext-byte multipart boundary, cancellation and orphan cleanup. The later explicit PostgreSQL Fastify composition now covers all domains and has separate API evidence. A real AWS 1 GB transfer remains untested.
- Preference revision CAS under concurrent first writes/updates; live activity and username-hold restart/expiry; relationship pair uniqueness/request counters; sealed report queues/pagination/reopen/retention.
- Opaque encrypted history bytes/tombstones/cursors, atomic multi-batch rollback, per-account concurrent limits and cross-account global quota. Recovery generation replacement, one-use hashes/tickets, expiry/grace and exact sealed key-backup fields remain protected.

Additional resumed evidence: all 173 affected Rows/account/device/invite/social/deletion/message/admin tests passed in one serial run; 24 legacy OAuth tests passed. New coverage includes account transaction isolation/rollback, exact social ownership, durable code/refresh replay revocation, relay acknowledgments/restart IDs, call attendance and state races, private choices/favorites, bot claims/replies, community historical actors, capped point activity/atomic ledgers and decoration moderation. The explicit staging runtime is now exercised locally and against hosted PostgreSQL; production activation and migrated client parity remain unverified.

## Performance evidence and limits

The local repository-only run used 200 requests at concurrency10 with zero errors: p50 17.29 ms, p95 292.36 ms; pool six total/six idle/zero waiting. It is not HTTP or hosted performance. The latest local import took5.46 seconds, resume1.17 seconds, dump1.71 seconds and independent restore5.31 seconds. The earlier hosted 1,009-record import took119.91 seconds and resume112.37 seconds from the operator MacBook. Count queries have since been batched, but that optimization has not been rebenchmarked on a clean hosted target.

The latest private hosted Broadcast receipt was about1.49 seconds from the MacBook. Do not report it as VPS latency, p95, fan-out capacity or a launch SLO. A plain-Postgres managed-table INSERT capture enqueued200 events in1.45 seconds; this is separate from actual hosted delivery.

## Failures and corrections retained

- Initial installed Zod content disagreed with the declared/locked version; clean dependency installation corrected it.
- An initial web storage test exposed a nonpersistent unknown-key path; the new vault uses persistent IDB directly and passes restart tests.
- Hosted PostgreSQL initially lacked the official CA; verified TLS now uses the official certificate, with no insecure fallback. Idle pool errors are handled without logging credentials.
- The first hosted owner-channel join failed before two later successful runs; the original transient cause remains unknown.
- The public-channel negative test initially succeeded even after the dashboard showed public access off. The restriction became effective after staging Realtime was suspended and re-enabled; the final probe explicitly receives CHANNEL_ERROR while private traffic passes. Test history retains the mismatch. Repeat behavioral validation on every new project.
- New file tests initially had an absent FK fixture parent and a nonexistent test-client helper. Both test setup issues were corrected; the final suite passes.
- Official CLI `test db` could not start because Docker/Podman is absent. The same SQL passed ten real hosted pgTAP assertions via pg. The prepared full Supabase-stack GitHub CI job has not run remotely; it is not marked passed.

- A combined regression run observed a Mongo Rows timeout and a PostgreSQL cleanup hook timeout. The isolated reruns and later complete 173-test serial batch passed. Fixture reset was changed from physical TRUNCATE of 284 relations to FK/trigger-enforced row deletion in dependency order.
- Concurrent duplicate pin awards initially hit a second unique index. Pair inserts now use ON CONFLICT DO NOTHING, and the concurrent native tests pass.

## Mandatory work still open

Complete the remaining full API acceptance matrix and production bootstrap; migrate and test account/provider/recovery/device/admin flows; activate Android/web adapters with offline-state preservation; connect push jobs to delivery; prove Free/Plus, payment/webhook/gift/admin/community/call parity against staging. Reconcile real source anomalies, object metadata and provider evidence from a consistent frozen source. Run realistic hosted/VPS load/fan-out/network failure tests, real S3 transfers, LiveKit and FCM/APNs device tests. Rehearse complete Auth/database backup restore and write-frozen rollback. Provision and review the separate production region/project/runtime role, paid costs and full residency path. Only then present a concrete cutover for approval.

The hosted API smoke startup took32.18 seconds and restart26.06 seconds from the MacBook, loading bounded cursor pages under one writer snapshot. This is cold-start evidence, not HTTP p50/p95 or VPS placement evidence. The API smoke uses the preserved v2 account protocol; hosted Supabase Auth/private Realtime are separately exercised. Test fixture helpers that previously used raw SQLite were updated for PostgreSQL; no application fallback guard was relaxed.

The current local repository/security total includes nine opt-in Auth bridge tests: fresh legacy/MFA and certified-device proof, metadata/nonce/rebinding denial, separate provider-session binding, API/socket logout checks, local revocation, account/device/global revocation, password epoch, provider bans/soft deletion, mapped account deletion, and SQL-failure rollback of mapping/binding/challenge together. The first focused seven-test bridge run passed before adding the last provider/deletion cases.

Migration010 corrects a source-audit omission: generated relation/FK/check schemas did not yet preserve the three SQLite audit/price triggers. All are now enforced by PostgreSQL and their exact source hashes are audited. The extended API run also found unported admin health and message-collection SQL; both now use PostgreSQL. A contract-only default test run encountered a local MongoMemoryServer startup timeout under heavy workstation load; the PostgreSQL test mode now skips that unused Mongo process and the 87-test follow-up passes. An earlier stale compiler was terminated after source changed during a prolonged run; the 1 GB bounded rerun exhausted heap; the subsequent complete 2 GB TypeScript build passed.

The real hosted Auth-to-API bridge passes all eleven checks in `supabase-hosted-auth-api-results.json`: actual password sign-in/JWKS, fresh legacy ownership plus signed device link, JWT-backed existing API writes/history/preferences, bound refresh after restart, independent application revocation and provider-only logout of an unexpired JWT. The runtime uses the restricted database login; the synthetic Auth administrator key is used only for its owned fixture users. Zero SQLite fallback attempts. Startup/restart were43.31/33.97 seconds from the MacBook, separate from request latency. The ten hosted private Realtime checks also pass with migration011 device binding enforced; source-mode execution is explicit in their report.

A source review found Android raw GoTrue responses can omit SDK-computed expires_at. The staged decoder now normalizes expires_in, and queued refresh rechecks the expected owner before returning cached tokens. The Android transport and Auth tests now pass all ten checks in an isolated Kotlin/JVM harness; no Android UI or physical-device success is claimed. No ADB device is currently connected.

The latest local p95 increased during heavy concurrent compiler/memory pressure on this MacBook (the earlier run was34.87 ms). Both samples had zero errors; neither estimates hosted HTTP performance or a production SLO.

## Combined hosted Auth/API/Realtime verification

`supabase-hosted-auth-realtime-api-results.json` passes 15 functional checks with the restricted runtime role: real provider JWT and certified legacy/device linking, API-issued grants, denied foreign private topics, actual API message commit, transactional outbox publish and receipts on both private sockets, history/idempotency/preferences, restart/refresh and independent application/provider logout. Zero SQLite attempts. The test claims only its own exact message event, preserving aggregate ordering; it never drains unrelated staging work.

The first combined run failed delivery. The managed `realtime.send` helper catches SQL exceptions as warnings, so the earlier worker could acknowledge an event after its restricted-role insert failed. Migration012 adds only column-scoped backend INSERT privileges and an RLS policy requiring a matching live leased outbox record. The worker now inserts directly and acknowledges in the same transaction, using the persisted event rather than mutable caller fields. Local tests prove restricted-role publishing, denied forged inserts, enqueue-error rollback/retry and push-destination rejection. Hosted delivery then passed. The failed run remains in the history receipt. The initial pgTAP policy-count assertion also failed after adding the intentional backend policy; it now matches the exact three reviewed name/role/command combinations and all ten assertions pass.

The hostile-socket probe is a **confirmed blocker**: after provider logout, the API denied the unexpired JWT, but an already joined independent socket keeping that JWT received a later invalidation. Its authorized control socket also received the event. A fresh-join RLS denial or cooperative client disconnect does not prove eviction. Identifiers/timing are still private information, so ID-only payloads do not close this gate.

The bounded warm history baseline made20 HTTP reads at concurrency2, zero errors: p50 1414.43ms, p95 1549.59ms, max1565.53ms. Ten `SELECT 1` session-pooler round trips measured p50 324.08ms, p95 356.35ms. The committed outbox-to-both-socket receipt took2093.59ms; cold startup/restart were38.90/26.75s. All were measured on the operator MacBook with Frankfurt PostgreSQL; they are not VPS latency, server execution time, load capacity or launch SLOs. No production services changed.

## Read-only source storage verification

`source-storage-readonly-results.json` accounts for482 live source attachment references:447 S3 HEAD objects match exact stored lengths;35 S3 HEAD404 references match readable existing local fallback files, totaling66,188,312bytes. The source count stayed482 through the probe. No object bytes were downloaded, no content hashes were certified, and no object/key/bucket/application record was changed. Preserve the existing attachment volume and `STORAGE_READ_FALLBACK=local`; a fresh empty volume would lose access to those35 files. The source was not frozen, so this does not replace final cutover reconciliation.

## Encrypted hosted database and restored Auth acceptance

`supabase-hosted-backup-restore-results.json` now passes. A read-only exported Frankfurt snapshot captured314 tables and1,395 rows across Auth, application/private schemas and migration history. All row counts and exact SHA-256 segment-sum checks reconciled in a separate local PostgreSQL17.11 database, including27 Auth tables and24 synthetic Auth users. pg_dump streamed directly into age; ciphertext size969,115bytes, authenticated archive readability passed, and no plaintext dump file was written. Dump/encryption took164.33s and local restore0.77s; these timings are not a production RTO.

The matching official Supabase Auth v2.197.0 macOS binary then ran only on loopback against the restored database. The owned synthetic probe's original password returned200 with the same subject, wrong password returned400, a newly generated ES256 signature/issuer/audience verified, the user endpoint accepted the token, refresh rotated, logout removed sessions and later refresh was denied. The source probe was banned after testing and the scratch database was removed. No customer or production records changed.

Failure history is retained: an initial Node25 TLS shutdown error lacked an idle error handler; later complete snapshots authenticate and reconcile while retaining the same shutdown warning code. The first native service attempt replayed migrations over the restored schema; `serve` avoids that replay. Subsequent attempts exposed the required Auth search path. The final explicit local connection uses search_path=auth,extensions, matching the hosted role's schema behavior. Verified TLS was never disabled for hosted access.

This is not full production recovery acceptance. Realtime server/policies, runtime role grants, OAuth/SMTP providers, existing hosted signing-key/token continuity, off-host backup/key escrow, full client recovery and write-frozen rollback remain separate gates. The newly generated local signing key intentionally requires a fresh login; no hosted private signing key was exported.
