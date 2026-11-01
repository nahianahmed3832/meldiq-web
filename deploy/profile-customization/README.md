# Profile release artifacts

Deployment is incomplete. Read `release-state.json` and `docs/profile-customization/DEPLOYMENT.md` before resuming. The migration chat owns host recovery and the database authority switch under `/run/lock/meldiq-production-release.lock`.

- Backend source: `70eb0272` on `codex/profile-customization-system`, in `/Volumes/code_files/meldiq_android/.claude/worktrees/profile-customization-system`. Staged source is `/opt/griip-internal-messaging/releases/profile-0.75.0-70eb0272`; the image build was interrupted and is not certified ready.
- Portable backend compilation: `api-precompiled-candidate.json` records the source/toolchain and checksums. `artifacts/api-precompiled-70eb0272.tar.gz` derives the same Node22/Alpine image stages but copies verified JavaScript instead of compiling on the VPS. Its Linux image/import smoke check remains pending.
- Web source/artifact manifest: `web-candidate.json`. Source `76660f3` includes the verified Safari/provider-logo fix and preserves passkey sign-in. `artifacts/web-profile-customization.bundle` preserves the isolated Git branch; `web-profile-customization.patch` is the reviewable diff over the deployed web base. The production static export is `artifacts/web-76660f3.tar.gz`.
- Backend patch: `../../server-patches/0010-profile-collectibles.patch`, checked against baseline `207c3958` without changing the real Git index.
- Android unsigned APK/AAB and mapping: `/Volumes/code_files/meldiq_android/android/profile-customization-release`, with hashes and JVM/build receipt. Signing/Play publication has not occurred.

After recovery and the coordinated all-16-domain Atlas cutover, seed original artwork with the updated API's `collectibles-seed-artwork` CLI in a separate capped one-shot operator container, preserving its exact runtime configuration. Do not run the full-mirror CLI inside the live API container's memory cgroup. Keep the five new identity collections empty until the migration chat completes its comparison. Do not restore SQLite authority after Atlas accepts writes.

`probe-runtime-s3.mjs` is a prepared post-cutover check for the deployed API's own storage credentials. Pipe it to `docker exec -i griip-internal-messaging-api-1 node --input-type=module`. It uses one random synthetic key, verifies signed size/checksum/no-overwrite, private reads, CORS and encryption, and removes its current object. Existing bucket versioning/retention is respected. It prints no credentials or signed URLs.

`probe-cdn.mjs` checks a registered public artwork poster, repeated Cloudflare delivery and conditional 304. Run it with `https://web.meldiq.app` and the approved asset hash returned by artwork seeding. No deployed runtime/CDN result has been recorded yet.

Before publishing clients, reconcile the concurrent administrator upgrade: its current UI sends a `{ item, reason }` save envelope and paginated search while this candidate's administrator contract takes a flat item and returns the full launch catalog. Do not publish that UI against this API without integrating and testing the paired changes. Preserve the latest live runtime config and nginx auth/security settings at the client switch.
