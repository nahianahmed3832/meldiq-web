# Profile customization release

The owner authorized completion, cloud validation and production deployment on 2 November 2026. This release is coordinated with the authentication and MongoDB migration chats under `/run/lock/meldiq-production-release.lock`.

## Candidate and deployment gate

Backend candidate `70eb0272`, version 0.75.0, integrates the actual 0.74.0 authentication source and Atlas/Redis migration code through `207c3958`. Migration `085_social_auth.sql` is unchanged; `086_profile_collectibles.sql` adds five identity collections. MongoDB schema version is 5. These collections remain empty until the database migration chat finishes verification and the single coordinated API cutover.

The combined web source lives in `/private/tmp/meldiq-profile-web-release`. It includes the SHA-256-verified Safari popup/official provider-logo fix. Existing passkey sign-in, production runtime configuration and Google/Discord providers are preserved. The deployment must compare the live symlink again immediately before publication.

## Cloud validation

The existing private `griipbuddy-orbit-media-sg` bucket in `ap-southeast-1` is retained. All four public-access blocks are enabled, versioning is enabled, and encryption is AES256. Minimal browser CORS now permits the existing web/admin origins and signed upload headers. Approved-origin preflight passed; an unapproved origin returned 403.

A synthetic isolated-prefix test exercised real S3 signed uploads: checksum tampering was rejected, valid bytes were accepted with encryption, a second PUT was rejected, unsigned reads were denied, safe SVG produced all five variants, ETag/304 worked, and partial writes could be retried only when byte count and SHA-256 matched. Test keys were cleaned without touching user data. The deployed runtime credentials and actual Cloudflare cache hit remain final post-cutover checks.

## Release procedure

1. Freeze the combined source and regenerate schema/contracts; verify release builds and regression results. Stage a new tagged image without recreating production services during the online copy.
2. The migration chat owns the single all-16-domain Atlas/Redis cutover and verifies the five empty collections, validators, indexes and authority markers. Preserve the 384 MiB Node heap and 768 MiB container cap. Never open a persistent SQLite database in Atlas mode.
3. Deploy the updated API and maintenance CLI together. The old `storage-orphans --delete` does not recognize collectible references. After cutover, seed original Blue Horizon artwork with `collectibles-seed-artwork`; the command preserves administrator overrides and existing ownership.
4. Verify the deployed S3 adapter with a disposable key, then check public `.webp` asset delivery through Cloudflare, cache status and ETag/304. Never cache inventory, customization, grants or administrative responses.
5. Atomically publish the combined web and admin static artifacts while retaining runtime config, existing nginx security headers and social callback handling. Exclude admin source maps. Run nginx validation and public health/read-only regression checks.
6. Record exact image/source digests, client symlinks, tests and live receipts here. Retain release artifacts and encrypted migration backups.

## Recovery and remaining release boundaries

Once Atlas accepts writes, any API fallback must retain all 16 Atlas domains and use the migration chat's verified compatible image. Do not restore the former SQLite authority or roll back by dropping new collections. Client symlinks can be restored independently while preserving ownership records and approved assets. Coordinate recovery under the shared lock.

Android production APK/AAB, lint and JVM checks use the existing application. Upload signing and Play publication follow the owner's manual release process; no signing keys are accessed or application-store release performed. No physical-device GPU/battery measurements are claimed. Paid collectible purchase stays disabled; premium/event items use audited grants. Full localization and large-catalog load measurement remain follow-up work.
