# Messages, Later and multiple tabs — release readiness, 11 November 2026

The candidate is reproducible and locally verified against the intended API, but **is not ready for production**. Required full localization and formatting gates still fail on inherited debt. Physical iOS/Android keyboard qualification is unavailable. New translations are implemented and automatically checked; qualified language review remains pending. No production deployment, production-data write, backend upgrade or dependency upgrade was performed.

This report supersedes the release claims in the [historical refresh report](WEB_REFRESH_2026-11-11.md) and the earlier test counts in [Multiple browser tabs](../MULTI_TAB.md).

## Candidate and reconstruction

| Item | Exact value |
| --- | --- |
| Frontend base | `68108747dbb57d193a2be242cf6148c275a7c717` |
| Tested code candidate | `daf70d5e3b41ddfc04e012519b39b8fc667e8f8a` |
| Tested complete code tree | `87ffadc50d307ab0c4d5b534e2404aeeb3cd8eeb` |
| Branch | `codex/web-refresh-release-20261111` |
| Integration worktree | `/Volumes/code_files/meldiq_web_release_readiness_20261111` |
| Independently reconstructed build worktree | `/Volumes/code_files/meldiq_web_release_verify_20261111` |
| Previous production build ID | `ml6QfuxEmtaayIlYfbFdW` |
| Candidate production build ID | `kwy5JIg3ctDKrxSpSwP8t` |
| Intended API | `b4bb6cff391325737fe33a7a4149b28ffaff4bf6`, API `0.76.1` |

The original checkout was on `floating-redesign` at `9ded695a192b893fe375e09004b286deed950646`, with 926 modified/untracked entries at the start of this continuation. It was preserved. The release base comes from the retained successful November 9 pricing publish receipt, its manifest and the matching public build ID observed on November 11. It is not inferred from the dirty checkout's HEAD. The API revision comes from the successful Spark purchase API activation receipt; the subsequent web publisher preserved that API. Public `server-info` confirms version/capabilities, not the exact server commit independently.

The attributable code commits are:

1. `48a5d7d`: integrate the 15-file Messages/Later refresh on the verified production base.
2. `96cae5c`: integrate the separately requested multiple-tab support.
3. `daf70d5`: complete the 18 refresh translations plus the multi-tab draft warning; make navigation fixtures deterministic; add localization and production PWA qualification.

Both historical focused patches were first applied **forward** to their retained pre-edit files in scratch directories. Their resulting changes were merged into the clean production base. FriendsView required a manual merge that preserves newer request-note input/display and failed-submit behavior. LocalStore required a manual merge that adds tab invalidation without importing the original dirty checkout's unrelated durable-outbox extension. Newer numeric routes, onboarding, community selection, accessibility structure and release features were preserved. No extra backend patch, database migration or package change is a prerequisite.

The resulting three-commit patch series was then applied using `git am` in a second fresh worktree starting at the documented base. Its **entire tree equaled the candidate tree** before checking out the original candidate commit and building it. This is independent forward reconstruction, not a reverse patch check. See [integration decisions](release-readiness-2026-11-11/integration-reconstruction.json) and [forward proof](release-readiness-2026-11-11/forward-reconstruction.json).

## Changes and route contract

The refresh keeps the existing Friends/Messages and Later architecture: start/resume conversations, accessible tabs and recovery, Saved collection controls, per-account browser view restoration, and clear persistence failures. Multiple tabs share one device connection, retain independent navigation/drafts, coordinate token renewal and account deletion, and hand off delivery when the owning tab closes. The candidate has no exclusive-use screen blocking a second tab.

The historical dirty-tree DMs test expected `/home`; the verified release base already expected `/lobby`. The test now explicitly configures lobby enabled and disabled cases. An enabled first-visit lobby opens `/lobby`; with it disabled, the first joined, non-archived text channel is chosen by category position, channel position and ID. A visited channel is remembered on return. Tests assert the exact canonical numeric URL, conversation/lobby content, sidebar heading and selected community; DMs has no selected community. The initial fixture sorted only by channel position; that fixture error was corrected. Application routing was unchanged.

The refresh journey's legacy `/dms/c/:id` expectations were updated to the existing canonical `/dms/<decimal-id>` paths. Existing desktop-only DMs skips remain on Firefox, WebKit and phone projects because the original suite is explicitly desktop Chromium and the phone rail is hidden.

## Intended backend and local differences

The browser journeys ran against an isolated checkout of API `b4bb6cff`, using **disposable PostgreSQL in `DATABASE_MODE=supabase`**, with the candidate's bootstrap SQL and 39 migrations. Required Saved/collections, history, community lobby and account capabilities were available; no convenient newer API was substituted. The bootstrap supplies local Supabase SQL role/auth/realtime contracts. It does not qualify hosted Supabase Auth or Realtime. Delivery used the existing WebSocket path; Redis was disabled in development. Mail went to disposable files, registration was open for generated accounts, and proxy trust was loopback only. All real web account, authorization and crypto setup paths stayed active.

The intended API's current message path is server-stored delivery. Tests verify readable peer receipt through the actual reference protocol client; they do not claim end-to-end encryption of that server-stored path. Existing legacy envelope encryption/decryption and key persistence remain covered by the full unit/vector suite. No encryption or authorization bypass was added.

Browser tests use local HTTP/WS with production CSP/security headers adjusted for localhost. Hosted TLS, Redis, provider email, OAuth providers, push delivery and Supabase service behavior remain outside this local qualification. Runtime: Node `25.8.0`, npm `11.11.0`, PostgreSQL `17.11`; repository CI pins Node `22.22.3`. Remote CI was not invoked. See [backend evidence](release-readiness-2026-11-11/backend-combination.json).

## Verification on the candidate

| Gate / suite | Actual result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `NEXT_PUBLIC_MELDIQ_TEST_LINKING=0 npm run build` | Passed on the reconstructed candidate; optimized Next static export and production worker; 479 export files; no source maps or runtime config included |
| `npm test -- --maxWorkers=2` | 156 files passed; 1,023 tests passed, 1 intentional legacy-curves skip |
| `npm run i18n:validate` | Passed: 0 structural errors, 0 hardcoded candidates |
| `node scripts/i18n/check-refresh.mjs …` | Passed: all 18 refresh keys and the one multi-tab key in all 28 locales |
| `npm run icons:check` and icon catalog tests | Passed: 33 licensed SVGs, 37 generated files verified; 14 tests passed |
| `npm run format:check` | **Failed**: 24 files. Every one also fails at the verified base; no new failing file. No broad formatting cleanup performed |
| `npm run i18n:check` | **Failed**: each of 26 locales still lacks 77 older keys; 2,002 older missing entries in total. Full release policy unchanged |
| Targeted formatting / `git diff --check` | 33/35 changed code/config files pass formatting; 2 retain base formatting failures. No newly failing file; cumulative whitespace check passes |
| Refresh, all five browser projects | 30 passed |
| Multiple accounts, all five projects | 10 passed |
| Cross-device and multiple tabs, all five projects | 15 passed, including five simultaneous tabs in each browser project |
| DMs contract | 2 passed; 8 intentional platform skips |
| German/Arabic/Urdu layouts, all five projects | 15 passed |
| Production service-worker suite, desktop Chromium | 2 passed, 0 failed, 54.2 seconds |

The five projects are Chromium, Firefox, WebKit, Pixel 7 viewport and iPhone 13 viewport. Installed browser versions are Chromium `156.0.8078.4`, Firefox `157.0`, WebKit `27.2`. Phone names describe emulation, not physical hardware. The final combined browser run completed with **72 passed, 0 failed, 8 intentional skips** in 18.8 minutes; the separate production suite adds 2 passes. See [per-case results](release-readiness-2026-11-11/browser-results.json).

The first unbounded local unit run timed out in a catalog audit while competing with browser work (1 failed, 1,022 passed, 1 skipped). The complete suite passed with two workers and unchanged assertions/timeouts. Build output retains existing HPKE pure-comment and browser crypto externalization warnings. Development emits the expected static-export rewrite warning and explicit service-worker-blocked messages in interception contexts. The first concurrent PWA harness launch hit the already-running optional LiveKit port; the PWA run disabled that unused call fixture and completed normally. No call qualification is claimed here.

The refresh tests retain network/storage failure injection and test collection rejection, duplicate-submit protection, deleted collection recovery, removed conversation access, reload/Back persistence, keyboard focus, themes/contrast and Friends search recovery. The separate worker suite does not intercept requests or unregister workers.

### Normal PWA and actual upgrade

The real preceding production export was verified against **all 480 manifest hashes**, then preserved in the output package. The PWA fixture copies both exports, preserves old immutable `_next/static` and `locales` assets with collision checks, uses identical runtime configuration, and atomically switches a server-side `current` symlink at the same origin.

The fresh/returning test signs up through email verification, encryption setup and welcome, confirms the retired test-linking choice is absent, and asserts the registered `/sw.js` is active and controls the page. It sends/receives real messages, saves through the message menu, creates/assigns/renames a collection, and restores filters after reload and Back. Offline collection failure retains the entered name for retry. Offline sending shows Sending; reconnection yields exactly one peer receipt and one server message row. An offline cached return displays that account's conversation. A second account gets its own Saved view; switching restores separate filters; logging out the first deletes its IndexedDB database while the second remains signed in after reload. API, config and query URLs do not enter the worker caches.

The upgrade test starts with build `ml6QfuxEmtaayIlYfbFdW`, a real account, saved message, collection and populated worker cache. It switches only the server release link, exercises the existing update notice and Reload, and verifies build `kwy5JIg3ctDKrxSpSwP8t`. The browser context, origin, session marker, account databases and cache names persist. There is **no cache clearing, worker unregistering or replacement profile**. The saved item and collection remain usable; the candidate's new filters restore after Back/reload. The predecessor did not implement persistent Later filters, so no invented old filter-migration guarantee is asserted. There were no page errors or failing immutable asset responses. See [PWA results](release-readiness-2026-11-11/pwa-results.json), [predecessor hashes](release-readiness-2026-11-11/previous-build-verification.json) and [candidate manifest](release-readiness-2026-11-11/candidate-build.json).

## Localization, visuals and physical devices

The source has **6,531** keys, not the historical count. Before translation, English/Bengali were complete and each other locale lacked **96** keys: the 18 refresh keys, one multi-tab warning and 77 older entries. This task added **494** translations (19 × 26), preserving variables, ICU plurals, region-specific variants and fallback policy. English/Bengali remain complete; the other catalogs now have 6,454 translated keys each (98.82%), zero untranslated-copy flags and 77 older missing keys. The exact scoped key list and per-locale counts are in [before coverage](release-readiness-2026-11-11/localization-before.json) and [after coverage](release-readiness-2026-11-11/localization-after.json).

German long copy, Arabic and Urdu RTL were rendered across desktop and narrow projects. Tests check no horizontal overflow, fitting controls, empty-name validation, collection creation/rename and direction. Screenshots were inspected, including 320×480 dialogs and phone-width Later. Existing labels such as Collections/New collection still fall back to English from the older backlog. Native-language review has **not** occurred and remains pending; structural checks and visual inspection are not linguistic certification.

Physical device access: Android reported no attached device. The known iPhone 16 was unavailable; its OS/browser could not be read. No physical software keyboard or installed PWA observations are claimed. Use the [ready-to-run physical checklist](release-readiness-2026-11-11/PHYSICAL_KEYBOARD_CHECKLIST.md), which includes setup, exact route forms, steps, expected outcomes and result fields for iOS Safari, Android Chrome and installed PWA modes.

## Reproduction and artifacts

The durable output folder is `/Users/nahian/Documents/Codex/2026-11-11/outputs/meldiq-release-readiness-20261111`. It contains the focused patch series, a Git bundle, sanitized evidence/report, and both public export archives. No account databases, email files, tokens, recovery keys or traces are included. `candidate-verification-export.tar.gz` is a **verification artifact, not an approved production release**. Follow [REPRODUCE.md](release-readiness-2026-11-11/REPRODUCE.md) for source reconstruction, disposable database setup, exact browser commands and teardown. The final documentation commit adds evidence only; the tested application/source commit above remains the build provenance.

## Deployment and rollback — instructions only

The actual required gates are in `.github/workflows/ci.yml` and `deploy/scripts/build-release.sh`: strict localization, icon integrity, typecheck, lint, full formatting, units and production build. This candidate fails strict localization and full formatting; it must not be represented as approved by that workflow. Resolve those inherited gates in a separately reviewed change and complete the pending release qualifications before deployment. Rerun affected checks and produce a fresh manifest for any changed source.

Once qualified and separately authorized, build from a clean committed checkout with `NEXT_PUBLIC_MELDIQ_TEST_LINKING=0 bash deploy/scripts/build-release.sh`. Verify the emitted SHA-256 and that the export excludes runtime config and source maps. The existing hosted topology uses a web-only atomic publisher: acquire `/run/lock/meldiq-production-release.lock` and `/opt/meldiq-web/.deploy.lock`; verify the currently active symlink, build/HTML, API health/version, runtime config, static overlays, OAuth callback and container nginx configuration before writing. Re-read live state at deployment time; the recorded November 9/11 predecessor is not a future authorization or stale-state override.

Install into a new `/opt/meldiq-web/releases/<qualified-release>` directory, verify every manifest hash, copy the existing runtime config, retain previous content-hashed `_next/static` and `locales` files with collision checks, preserve the deployed static overlays/callback, then atomically replace `/opt/meldiq-web/current`. Verify served build/hash, worker/cache headers, required capabilities and API health; confirm API, config, callback and nginx remain unchanged. `/healthz` on the **web** origin is an HTML fallback; use the actual API health endpoint (`msg.meldiq.app/healthz` in the retained publisher). If an upstream CDN is present, verify its current configuration and mutable HTML/worker freshness as part of the separately authorized deployment; this task did not establish a distribution-specific invalidation command. Immutable assets retain their cache policy. This task did not change any hosting configuration.

Rollback under the same locks by atomically restoring the recorded previous release symlink, retaining the candidate's immutable assets in the rollback target so already-open candidate tabs can still load their chunks. Verify previous HTML/build, worker and unchanged API/config/callback; preserve both release directories until acceptance. The repository's generic `rollback.sh <release>` documents named release selection, but the hosted installation's edge is containerized (`meldiq-prod-edge`); follow its existing atomic publisher topology rather than assuming host `systemctl nginx` owns it. No backend/database rollback is introduced by this frontend-only change.

## Readiness matrix

| Workstream | Status | Evidence / remaining dependency |
| --- | --- | --- |
| A — Reproducible integration | Verified | Verified base, separately attributable commits, independent forward application and exact tree equality |
| B — Intended API journey | Verified locally | API `b4bb6cff`, disposable PostgreSQL/Supabase mode; real auth, messaging, Saved, collections, removed access and account boundaries. Hosted-service differences above remain unqualified |
| C — DMs navigation contract | Verified | Exact lobby/default/remembered channel assertions; documented intentional platform skips |
| D — Worker-controlled release and update | Verified locally | 2 production Chromium cases; verified predecessor, same origin/profile/storage, offline retry and account deletion |
| E — Physical keyboard | Blocked | Reachable physical iPhone and Android, with recorded OS/browser/build and completed checklist |
| F — New-string localization | Implemented but review pending | 18 refresh + 1 multi-tab key in all 28 locales; structural/render checks pass; qualified language review pending |
| Required full formatting | Failed | 24 inherited failing files, independently reproduced at base; [baseline evidence](release-readiness-2026-11-11/format-baseline.json) |
| Required full localization | Failed | 77 older missing keys × 26 locales; fallback/validation policy unchanged |
| Production deployment | Not applicable to this task | Explicitly outside authorized scope; no production write performed |

Returning-user research, field performance monitoring, wider onboarding/provider and notification qualification, and full product accessibility review remain follow-ups. No measured UX, retention, production performance or complete accessibility gains are claimed.
