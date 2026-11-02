# Deployment guide

**Not production ready.** Staging project exists separately in Frankfurt; production has not been moved from Atlas. The isolated backend worktree starts at the verified current release, and any newer production feature release must be rebased before deployment.

## Staging

1. Install exact dependencies in web and isolated backend. Run schema guards, local PostgreSQL/RLS/Auth/outbox/import tests, web tests and builds.
2. Configure private staging env with hidden terminal prompt. Verify the dashboard project reference/Frankfurt region. Obtain the official database CA; require verified TLS.
3. Use official CLI2.122.0 through `node scripts/supabase/staging.mjs plan`, review exact pending migrations, then `apply`. The script pins the staging project and refuses production's existing social-auth project. It checks every table's RLS and client grants after application. Use `types` for official generated SDK types when the CLI's type-generation dependencies are available.
4. Configure Auth redirect URLs and synthetic test users only; privately configure provider credentials and SMTP as required. Disable public Realtime access and verify exact policies before subscription tests. Keep Supabase Storage unused.
5. Run frozen synthetic export/import/reconciliation, native store parity, payment/webhook synthetic tests, FCM/APNs test devices, S3 authorization/large-file tests, LiveKit call tests, Android/web/admin acceptance, concurrency/failure/reconnect/load tests and a clean restore drill.
6. Capture evidence, version/hash/config manifests, costs, quotas and rollback rehearsal. Staging is not accepted solely because SQL applied.

## Production release prerequisites

Complete all25 acceptance criteria. Resolve all native-only stores, account/provider/password recovery, device binding, admin step-up and current payment feature compatibility. Prepare a separate Frankfurt production project and production-like staging measurements. Audit end-to-end residency including Hostinger/S3/backups. Provision runtime roles, bounded session/direct pools, CA verification, monitoring and encrypted off-host backups. OAuth callbacks/CORS must use exact production domains and no broad wildcard redirects.

## Final activation

Present the exact release, migration/reconciliation/restore results, window and write-frozen rollback configuration for explicit approval. Acquire the current shared production release lock; preserve actual current Compose/env/ingress targets and memory reserve. Do not reuse historical lock PIDs or older images as compatible payment fallbacks. Enter maintenance across all API origins, freeze legacy application writes, capture/verify final backups, sync and reconcile, switch reviewed API/client configuration, smoke-test while writes remain frozen, then permit writes only after all gates pass. Preserve S3 object keys and LiveKit service continuity. Do not delete legacy databases, backups, volumes or buckets.

After new writes begin, follow the rollback plan's repair-forward/post-cutover reconciliation rules; a connection-string reversal is not safe. Keep clients recoverable and never revoke all old login paths until migrated users can recover securely.

## CDN and latency

Cache content-hashed static assets globally with immutable lifetimes. Serve config.json, OAuth/account/session/private messaging/billing/admin routes and signed URL creation with no-store. Do not apply Cache Everything to the API or shared-cache private attachments. A CDN cannot remove Frankfurt DB round trips from an Asia-hosted Fastify process; measure transaction/query/API p50/p95 and evaluate EU backend placement before production.

## Existing file fallback discovered by read-only audit

The live source has482 attachment references. S3 HEAD metadata matches447 exact lengths;35 older references are backed by the already configured local read fallback, with matching lengths and existing uploader/conversation rows. Preserve the current Hostinger attachment data volume and STORAGE_READ_FALLBACK=local during any database-only cutover. Starting the API with a fresh empty volume would break those35 references despite a correct PostgreSQL import. No object was moved or uploaded by this audit. Any later consolidation of those files into S3 needs its own reviewed non-overwrite copy/verification plan; no bucket/key rename or Supabase Storage copy is implied. Full content hashes/transfers and frozen-source reconciliation remain separate acceptance.

The combined hosted receipt records a release-blocking cached-channel revocation leak. Keep the PostgreSQL/Supabase composition opt-in and outside production until reliable already-connected authorization is demonstrated. Migration012 fixes a separate delivery-loss bug by making managed-table enqueue errors abort acknowledgment; deploying that correction does not resolve cached revocation. The measured warm MacBook/Frankfurt HTTP p95 of1.55s is not VPS performance. Measure the final API/database placement before approving launch latency.
