# Profile customization release

The owner authorized completion, cloud validation and production deployment on 2 November 2026. This release is coordinated with the authentication and MongoDB migration chats under `/run/lock/meldiq-production-release.lock`.

## Candidate and deployment gate

Backend candidate `70eb0272`, version 0.75.0, integrates the actual 0.74.0 authentication source and Atlas/Redis migration code through `207c3958`. Migration `085_social_auth.sql` is unchanged; `086_profile_collectibles.sql` adds five identity collections. MongoDB schema version is 5. The database migration chat first cuts over on its rehearsed 0.74/schema4 image with all 16 Atlas domains and Redis. After its stability/backup handoff, the separate 0.75 profile rollout creates/verifies the five empty collections and advances schema 5 before any feature data or client publication. No profile data is written during the database authority switch.

The combined web source lives in `/private/tmp/meldiq-profile-web-release`. It includes the SHA-256-verified Safari popup/official provider-logo fix. Existing passkey sign-in, production runtime configuration and Google/Discord providers are preserved. The deployment must compare the live symlink again immediately before publication.

## Cloud validation

The existing private `griipbuddy-orbit-media-sg` bucket in `ap-southeast-1` is retained. All four public-access blocks are enabled, versioning is enabled, and encryption is AES256. Minimal browser CORS now permits the existing web/admin origins and signed upload headers. Approved-origin preflight passed; an unapproved origin returned 403.

A synthetic isolated-prefix test exercised real S3 signed uploads: checksum tampering was rejected, valid bytes were accepted with encryption, a second PUT was rejected, unsigned reads were denied, safe SVG produced all five variants, ETag/304 worked, and partial writes could be retried only when byte count and SHA-256 matched. Test keys were cleaned without touching user data. The existing production Cloudflare static path returned HIT twice (Age 10293) and ETag 304 on 1 November at 20:28 UTC. Deployed runtime credentials and new profile-asset Cloudflare HIT/304 remain final post-cutover checks.

## Release procedure

1. Freeze the combined source and regenerate schema/contracts; verify release builds and regression results. Prepare portable JavaScript and a tagged image recipe off-host; heavy compilation and regression stay off the production VPS. Final-only image assembly waits for the migration handoff and a bounded memory reserve.
2. The migration chat owns the all-16-domain Atlas/Redis cutover on its rehearsed 0.74/schema4 runtime. After a stable handoff and restore-verified backup, the 0.75 profile rollout verifies all existing authority markers and the five new empty collections/validators/indexes. Preserve the 384 MiB Node heap and 768 MiB container cap. Never open a persistent SQLite database in Atlas mode.
3. Deploy the updated API and maintenance CLI together. The old `storage-orphans --delete` does not recognize collectible references. After cutover, seed original Blue Horizon artwork with `collectibles-seed-artwork` in a separate one-shot operator container using the deployed image/environment/network/volume configuration, its own memory cap and no published ports. Do not execute this full-mirror CLI inside the live API cgroup: `openCliRows` loads another read model, which would share the API memory budget. The command uses only in-memory SQLite in Atlas mode and preserves administrator overrides and existing ownership.
4. Verify the deployed S3 adapter with a disposable key, then check public `.webp` asset delivery through Cloudflare, cache status and ETag/304. Never cache inventory, customization, grants or administrative responses.
5. Atomically publish the combined web and admin static artifacts while retaining runtime config, existing nginx security headers and social callback handling. Exclude admin source maps. Run nginx validation and public health/read-only regression checks.
6. Record exact image/source digests, client symlinks, tests and live receipts here. Retain release artifacts and encrypted migration backups.

## Recovery and remaining release boundaries

Once Atlas accepts writes, any API fallback must retain all 16 Atlas domains and use the migration chat's verified compatible image. Do not restore the former SQLite authority or roll back by dropping new collections. Client symlinks can be restored independently while preserving ownership records and approved assets. Coordinate recovery under the shared lock.

Android production APK/AAB, lint and JVM checks use the existing application. Upload signing and Play publication follow the owner's manual release process; no signing keys are accessed or application-store release performed. No physical-device GPU/battery measurements are claimed. Paid collectible purchase stays disabled; premium/event items use audited grants. Full localization and large-catalog load measurement remain follow-up work.

## Predeployment host incident

Before the profile API or client switch, capped image compilation and a separate capped migration regression overlapped with the existing workloads and exhausted host memory headroom. Available memory fell from approximately 3 GiB to 205 MiB; new SSH banner exchanges and public TLS/API health probes timed out. Local validation clients were canceled and targeted requests to stop only the disposable build/test containers were issued. No profile deployment, database authority promotion or runtime configuration replacement occurred. The migration chat recovered guest/API access at 20:05:46 UTC, reported 3.84 GiB available memory, and verified public health 200/431 ms plus the original API and eight authority markers. Console unlock is no longer required for this incident. Sustained health and SQLite integrity verification precede any further rollout. No automatic cutover is queued. Resume server validation only after health is stable and reserve sufficient memory for production while running one temporary workload at a time.
