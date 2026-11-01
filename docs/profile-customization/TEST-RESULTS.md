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

- Combined web regression: **852 passed, 1 skipped, zero failed** (853 cases). The fixture reader accepts both the current `oneOf` discriminated-union schema and earlier `anyOf` output. No validation gap was allowlisted.
- Final web source `76660f3`: production TypeScript/Next static export/service worker build **passed**. A later focused run of profile previews, contracts and realtime frames passed **42 checks**.
- Final browser flows: **4 passed** across Chromium desktop and phone width, including a 360×740 viewport, 80-character display name, reduced motion, free claim/favorite/equip/reset, locked premium items and a separate protocol client observing canonical saved style.
- Android: `assembleRelease`, `bundleRelease`, `lintRelease`, and the full release JVM run **passed**: **987 passed, 10 skipped, zero failed/error** across 187 suites. APK/AAB are unsigned, non-debuggable and target the production API. Artifact SHA-256 values are in `verification/android-release/receipt.json`.
- Combined backend `70eb0272`: schema/contracts generation, TypeScript and emitted JavaScript build **passed**. Compilation used 1536 MiB after a 1 GiB attempt exhausted its compiler heap. The full local run finished with **1,916 passed, 20 skipped, one failed** across 1,937 cases. The single fake-S3 temporary-error retry failure did not reproduce: a fresh full storage suite passed **18/18**, followed by **3/3** isolated repeats of that case, with unchanged code. Its cause is unproven; the original report retains the failure. Fresh real-S3 checks passed **2/2** on synthetic keys. A subsequent clean full confirmation on unchanged `70eb0272` passed **1,917 cases, 20 skipped, zero failures** (1,937 total). The profile suite explicitly runs both SQLite and all 16 MongoDB domains. See `verification/backend-summary.json` and both unmodified full reports.
- The final API image build and production rollout are incomplete. Overlapping capped validation workloads exhausted VPS memory headroom before any profile deployment or database authority switch. Build/test clients were canceled; SSH and public health checks timed out. The migration chat recovered the guest/API at 20:05:46 UTC, with public health 200/431 ms and 3.84 GiB available memory. It is verifying sustained health and SQLite integrity. Recovery no longer needs a console unlock. No post-cutover S3 runtime/CDN cache-hit evidence is claimed.

No claim is made for a manually completed Google login in Safari after the fix, physical Android rendering/battery/GPU behavior, signed Play publication, paid collectible checkout/refunds or native Windows/macOS applications.

## Released-reader compatibility

The deployed web profile reader was frozen byte-for-byte from `426ad2b` and its SHA-256 matches the actual social-auth production source. It decodes the new captured profile response, preserves legacy frame/accent/font fields and ignores the optional collectible metadata. The complete web suite with that regression passed **853 cases, 1 skipped, zero failed** (854 total).

A historical Android seven-field `ProfileStyleDto` from `c111376c` also decodes the new captured profile using `GriipJson`; its unknown-key configuration is byte-identical to the current configuration. The complete release JVM suite now passed **988 cases, 10 skipped, zero failures/errors** (998 total). Release APK/AAB/lint remain successful; runtime source/artifact bytes were unchanged by these test-only additions. See LEGACY-CLIENT-COMPATIBILITY.md for the scope and limits.
