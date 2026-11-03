# Target backend architecture

Decision confirmed November 2, 2026: Supabase PostgreSQL/Auth/private Realtime are the target; Hostinger Fastify, S3, LiveKit and necessary Redis remain. **This is the target, not a statement of completed cutover.**

## Environments and region

User selected a separate staging project, then Frankfurt for production. The created staging project is `bkvlxbsnzqkhbifawcww` / Meldiq Staging, confirmed healthy in `eu-central-1` in the signed-in dashboard. The existing `sgowwdmnavcsofzlgggm` project remains the production social-login provider and must not receive experimental schema or account changes. Production's new project reference is not invented; provisioning is pending.

The launch audience includes EU, US, South/Southeast/East Asia. The existing VPS public IP geolocates to Kuala Lumpur (an indication, not verified Hostinger datacenter inventory). Keeping that API in Asia while moving its DB to Frankfurt adds cross-region round trips. The deployment plan must evaluate keeping the Hostinger VPS service in an EU location or another reviewed placement strategy; no VPS move is authorized by the region preference alone. Measure before choosing production capacity. Frankfurt was selected to support the intended EU residency posture, not because a global latency comparison has passed. Database location alone does not establish GDPR compliance: S3, processing, logs, backups, subprocessors and access/transfer safeguards must be covered.

## Request and trust boundaries

Clients obtain Supabase Auth access/refresh sessions. Fastify verifies fixed-project JWKS, signature, algorithm, issuer, authenticated audience/role, exp/iat, subject/session and a verified internal ownership mapping. Device enrollment/proof, account suspension, community authorization and platform-admin step-up remain independent checks. JWT metadata never grants entitlements or admin rights. Credentials and tokens are never logged.

API/business authorization remains Fastify. Existing `/v1`, `/v2`, `/admin/v1` are preserved. PostgreSQL's `meldiq` schema holds existing normalized entities; `meldiq_private` holds migration checkpoints, auth mapping, delivery outbox and temporary authorization leases. Client database privileges are intentionally denied in this first release. This keeps existing detailed profile/history/privacy/role rules at their current server boundary until equivalent direct-read RLS is separately implemented and tested. No broad client CRUD grants are used to make migration easier.

## Repository strategy

The schema generator reads the actual release's applied SQLite schema in memory, preserving 254 core table shapes, 2,309 typed columns (including eight additive administration tables), indexes, 158 FKs and 162 checks. Core entities are not copied into generic JSONB documents. Existing flexible event payloads and serialized legacy settings remain their established formats; the outbox uses JSONB for a small invalidation envelope. Financial minor-unit integers are bigint, with safe-number rejection at the TypeScript boundary; aggregates use decimal strings.

`MeldiqPostgres` owns bounded TLS-verified pools and transaction context. `PostgresRows` preserves the synchronous repository contract temporarily with a single writer enforced through a database session advisory lock. It still has whole-domain memory cost and is not a horizontal-scaling solution. Asynchronous `PostgresMessageStore` queries indexed relations directly and atomically records delivery work. Native Mongo/DocumentStore implementations now have PostgreSQL repositories and the explicit staging composition selects them. Creator/linked-account factories receive that same database. The compatibility SQLite handle is memory-only and every SQL operation on it throws; no persistent fallback exists. Production activation and unified Supabase Auth/client rollout remain gated. The staged runtime uses a separate restricted login; operator credentials never serve API requests.

## Delivery and supporting services

Committed events and outbox jobs are one transaction. Realtime workers broadcast IDs/invalidation events on private topics; clients fetch authorized history after each notification/reconnect. Push workers consume separate durable jobs with deduplication. Presence/typing are ephemeral, authorized separately, and never become permanent message records. Outbox retries/dead letters survive restarts; a failed older event blocks later events for that aggregate/destination until recovery.

S3 remains binary authority; file IDs, object-key derivation, multipart, checksum/size verification, download authorization and cleanup retain their current service. No Supabase Storage buckets are created. LiveKit stays responsible for calls and screenshare. Redis remains TTL cache/distributed rate limits/coordination; PostgreSQL is the only future persistent application authority. Client vaults and offline outboxes remain secure device state.

## CDN decision

Use the existing edge/CDN for content-hashed JS/CSS/fonts and public immutable assets. Cache public media only where existing authorization permits it. Private API responses, tokens, OAuth callbacks, subscriptions, admin records and signed URL issuance stay `private, no-store`; a shared cache must never bypass membership checks. S3 private content needs an explicitly reviewed authorized CDN design before shared caching. A CDN reduces asset latency, not PostgreSQL write or Auth/Realtime primary-region latency. Do not add cross-region personal-data replicas merely for speed without reviewing the residency promise.

## Gates before activation

All native stores, account recovery/provider ownership, device binding, push, payments, admin and feature parity must pass staging before changing production authority. No permanent dual writes. No production switch until full reconciliation, restore and write-frozen rollback rehearsals pass and the user approves the exact release.

## Observed existing binary storage

A read-only November2 source audit observes S3 region ap-southeast-1 and an existing local read fallback. Of482 source attachments,447 S3 objects match exact byte lengths;35 are present in the existing local fallback with matching sizes and valid conversation/uploader links. This is a pre-existing compatibility path, not a new primary store. Preserve its volume/configuration. Source S3, Hostinger and backups need the complete residency review even though the staging database is Frankfurt. The audit downloaded no S3 object bytes and changed no application records, object keys, buckets or policies.


## November3 rehearsal checkpoint

Production remains Atlas-authoritative with the same Hostinger API/S3/Redis/LiveKit services. The authorized Frankfurt staging rehearsal now holds282 typed application tables/677,617 records from a read-only275-collection snapshot. Complete row/timestamp/financial/counter reconciliation and a317-table/678,057-row encrypted PostgreSQL restore pass. Native customer Supabase Auth activation and production Realtime remain gated; no traffic cutover occurred. See `docs/migrations/staging-real-data-rehearsal-20261103.md` and `docs/migrations/execution-status.md` for current evidence and remaining acceptance gates.
