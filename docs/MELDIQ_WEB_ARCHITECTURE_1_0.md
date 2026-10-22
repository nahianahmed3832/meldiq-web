# Meldiq Web: Architecture 1.0 migration (2026-10-22/23)

The web part of the approved Architecture 1.0 plan (meldiq_android `docs/architecture/ARCHITECTURE_1_0_PLAN.md` §7.1,
ADR 0008): canonical contracts, retired integrations removed, and the move to Next.js. Branch `nextjs-migration`
(from `contract-fixtures`, from `main` = production 0.5.0-beta-b327e82). **Nothing here is deployed or pushed.**

## 1. Baseline (before any change: `contract-fixtures` 96ab083 = production + the contract test)

| Check | Result |
|---|---|
| Typecheck (`tsc -b`) | clean |
| Unit (`npm test`) | 58 files, 366 passed, 1 skipped (the native-only key storage test under the fallback) |
| Unit + live against API 0.26.0 | 90 files, 524 passed, 22 skipped, 0 failed |
| Browser (Playwright, Vite dev build) | **11 spec files, 24 tests × 4 projects = 96** (the plan's "47" is an older count). 79 passed, 14 skipped (by design per engine), 3 failed: the Chromium video call (known intermittent), Firefox deafen (timing), Firefox legacy-Safari (the test opened `manifest.webmanifest`, which Firefox downloads) |

Inventory at the baseline: 289 source files, 40.9k lines. React 19 + Vite 7, a hash router (`src/app/router.ts`), a
custom store (`useSyncExternalStore`), the engine (`src/sync/engine.ts`: sync, outbox, receiver, calls, history),
IndexedDB (`src/store`, idb), WebCrypto plus the Safari-16 curve fallback, LiveKit with an E2EE worker, a classic
service worker (`/sw.js`, FCM wake-ups, no caching), static files behind nginx with `script-src 'self'`, and the
release scripts in `deploy/scripts` (build, install, rollback, verify).

## 2. What changed

| Phase | Commit(s) | Summary |
|---|---|---|
| B: contracts | 96ab083, 2facba8 | Golden fixtures copied to `test/contract-fixtures` (now API 0.27.0, read from the server checkout's committed HEAD) with a drift check; every web call decoded with its exact schema; frames; errors; strict pass |
| D: retired integrations | 17f938c | AI, inbox, documents, workflows, apps/webhooks, API keys, groups, branches/teams, templates, `inbox.*`/`integration.event` gone: 99 calls to routes the server removed in API 0.12 (evidence: meldiq_android `docs/COMMUNITY_REBUILD_2026-10-21.md` §3 and `retiredData.ts`). Every remaining web call has a server route |
| B: realtime and enums | a30f384 | `src/realtime/frames.ts` (read, typed parse, typed client frames); placeholders instead of ack-and-drop for unreadable queue items and unknown message types; `openEnum` for server enums (unknown stays "unknown") |
| C: Next.js | 74db5eb, 8014861, 2c3ee5b, c94b765, c56df02 | `src/app` → `src/application`; Next.js 16.3.8 Pages Router static export; path routes with old hash links kept; build, dev and verify scripts; browser tests for paths. Details: `docs/MELDIQ_WEB_NEXTJS.md` |
| E: security | 1f68c86 | Recent searches are forgotten at sign-out |

Not changed: the engine, the encryption protocol and its implementation, IndexedDB schemas, key storage, the release
process, the nginx security headers.

## 3. Decisions

- **Generated types:** the zod schemas stay the web's models: they validate every answer at run time anyway, and the
  contract test proves each one decodes the server's real answers (and reports any value a fallback replaced). Types
  generated from `openapi.json` would duplicate them without adding a check.
- **Next.js:** Pages Router, static export, nginx unchanged; reasons and the spike in `docs/MELDIQ_WEB_NEXTJS.md` §2–3.
- **Retired features:** removed, not revived; the server no longer has them (their tables are kept server-side for
  `admin retired-data`). No new AI feature was added.

## 4. Security review (this migration)

| Area | Finding |
|---|---|
| CSP | Unchanged (`script-src 'self'`, no `unsafe-eval`); the Next.js page has no inline script; `verify.sh` checks it live |
| Rendering | Client-only; the build renders the empty shell. The only raw HTML is the fixed launch-screen markup |
| Logging | No `console.*` in the app (lint rule); nothing logs content, keys or tokens |
| Service worker | No fetch handler and no cache: it can't serve a stale app; it opens only this app's own paths |
| Links | The router moves only to this app's own section paths; other origins, files and malformed ids never route |
| Retired routes | The AI catch-up would have sent decrypted messages to a route that no longer exists; removed |
| Local data | Recent searches are now forgotten at sign-out (they stayed for the next person on the browser) |
| Queue | Unreadable items are kept as placeholders before they're acknowledged, never silently dropped |

## 5. Results (2026-10-23, `nextjs-migration` at c56df02)

| Check | Result |
|---|---|
| Typecheck, lint, format | clean |
| Unit + live against API 0.26.0 (the production server's version) | 82 files, **546 passed, 1 skipped, 0 failed** (the 22 earlier skips were the retired modules' tests and gated ones; the guest and event tests now really run) |
| Contract tests | every fixture of API 0.27.0 decodes; strict pass 0 findings; allowlist empty |
| Browser, Next.js dev build (4 projects, 96) | **80 passed, 14 skipped, 2 failed**: Firefox "media under the wrong key" (passed 4 of 4 on rerun: flaky) and the phone-width layout test (a development-only address race, fixed in 2c3ee5b; then 6 of 6) |
| Browser, production build with the production CSP (`ORBIT_E2E_BUILD=1`) | **72 passed, 16 skipped, 8 failed**: all 8 are the accounts and emoji specs in each project, which read the development-only `window.__orbit` hook (as on the Vite production build). Calls, notifications, the Safari-16 fallback, launch screen, touch, voice room and screen sharing pass under the production CSP |
| Build | `npm run build` → `dist/` (19 MB with source maps; 36 JavaScript files, all ES2022; no inline script) |

Compared with the Vite baseline: the three baseline failures are gone (the Firefox legacy test was fixed; the video
call and deafen tests passed this time) and no test regressed.

**Deployment readiness:** ready for the owner's review, not deployed. Before installing: check the live release,
build from the reviewed commit with `deploy/scripts/build-release.sh`, install, run `verify.sh`, open the site on a
phone. Rollback: `rollback.sh` (returns to the last Vite release; see `docs/MELDIQ_WEB_NEXTJS.md` §5).

**Unresolved / not checked here:**
- Physical phones and Safari 16 itself (Playwright's WebKit is current); the device checklist is in
  `docs/MELDIQ_WEB_BROWSERS.md` §5.
- Turbopack also copies the call worker's TypeScript source to `_next/static/media/e2eeWorker.*.ts`; nothing loads it
  (the compiled worker chunk is used). Harmless, but extra.
- The version is still 0.5.0-beta: a bump is the owner's call.
- The accounts and emoji browser specs can't run on a production build (they need the development hook).
