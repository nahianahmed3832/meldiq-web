# Profile customization verification — 2 November 2026

Tests use disposable servers/databases and synthetic accounts. Live S3 probes use an isolated synthetic prefix in the existing private bucket. Production account data was not edited by these tests.

## Completed release-preparation checks

| Check | Evidence |
|---|---|
| Web full regression before final Safari/preview refinements | 851 passed, 1 skipped, 0 failed, 852 cases (`/tmp/meldiq-profile-web-full-final.json`). |
| Contract-fixture failure | Integrated actual published social/identity/leaderboard contracts and fixtures, with no gap-allowlist expansion. `test/contract-source.txt` pins the combined backend source; final refresh uses `70eb0272`. |
| Latest focused web recipe/draft/security checks | 7 passed; changed-file ESLint passed. |
| Next production export | Passed before final Safari/preview refinements; final combined build is recorded below when complete. |
| Safari/provider-logo fix | Auth chat verified 36 Chromium/WebKit desktop/mobile checks, including detached opener, wrong-flow messages, explicit cancellation and checked fallback. Five source files verified against its SHA-256 manifest before merging. |
| Backend full run before Atlas integration | 1,879 passed, 31 skipped, 2 failed. One Mongo setup exceeded its resource-constrained hook timeout; one collection test used a cached pre-edit transform. Both affected suites and live S3 were rerun fresh: 45 passed, 0 failed/skipped. This is not represented as a clean single full run. |
| Asset/vector/seed checks | Bounded safe SVG and shape-only Lottie, raster validation/orientation, immutable content addressing, ETag/304, original retention, launch seeding and ownership guards exercised. |
| Production Linux codec image | Sharp compiled in Node 22/Alpine; SVG and moving Lottie generated original, animated WebP, static poster/thumbnail and AVIF variants. |
| Live S3 | Signed exact-byte/checksum upload, encryption, no overwrite, private originals, CORS, all variants, conditional reads and partial-write recovery passed. |
| Backend runtime dependency audit | Zero advisories after patched Zod, Nodemailer and fast-uri updates (`/tmp/meldiq-profile-runtime-audit-patched.json`). |
| Admin build/tests | Production TypeScript/Vite build passed; 27 tests across 6 suites passed. |
| Android production build | assembleRelease, bundleRelease and lintRelease passed. APK/AAB use production `https://msg.meldiq.app` with DEBUG=false. |
| Android test harness correction | Registered the Robolectric Compose host in test code only; all 11 affected host checks completed successfully. Final full release JVM rerun is recorded below when complete. |

## Final combined-release checks

Final source is frozen for verification after Atlas/Redis integration and the patched runtime dependencies. The complete final backend/web/Android reports, artifact digests and live post-cutover receipts will be added here as their checks finish.

No claim is made for a manually completed Google login in Safari after the fix, physical Android rendering/battery/GPU behavior, signed Play publication, paid collectible checkout/refunds or native Windows/macOS applications.
