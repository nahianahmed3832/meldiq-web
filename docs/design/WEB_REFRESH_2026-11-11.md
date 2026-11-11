# Messages and Later refresh — 11 November 2026

> Historical implementation report. The clean release integration, current verification and remaining release gates are recorded in [Release readiness — 11 November 2026](RELEASE_READINESS_2026-11-11.md). Counts and blockers below describe the earlier working-copy run, not the final candidate.

## Discovery and selected scope

Meldiq is a browser device for the same encrypted messaging account as its native clients (`README.md`, `docs/MELDIQ_WEB_NEXTJS.md`). People enter a conversation through Messages/Friends, community navigation or search, send a message, and return to saved messages or activity. This refresh concentrates on beginning and resuming that journey. It does not add a dashboard or alter encryption, authentication, messaging, community permissions or routes.

The current checkout has 912 pre-existing modified/untracked entries. Edits are layered onto that checkout; pre-edit copies of affected files and the initial status are in `/tmp/meldiq-refresh-20261111`. No cleanup, branch switch or deployment is part of this task.

| Roadmap area | Evidence in this checkout | Status before refresh |
| --- | --- | --- |
| Personalized home | Messages opens Friends; HomeView is a community fallback, RecentActivity already exists | Partial; no separate My Meldiq dashboard |
| Onboarding | Account/device setup and community GuideOnboarding | Implemented; not all provider/new-user journeys reverified here |
| Notifications/reminders | ActivityView, RemindersList, webPush, service worker | Present in source; provider delivery and notification relevance unverified here |
| PWA | Manifest, install, offline shell, updates and service worker | Present in source; install/offline and physical device behavior unverified here |
| Analytics | Community usage and billing telemetry | Partial; no verified retention or field performance evidence |
| Command/search | SearchDialog, Ctrl/Cmd+K, server access checks, local encrypted-message search | Implemented; stale request suppression already present |
| Sharing/collaboration/integrations | Message links, communities, calls, developer/bot and workspace integrations | Implemented in distinct flows; blanket Phase 5 completion is unverified |

Before screenshots are in `docs/design/web-refresh/before-*.png` (desktop Chromium and a Pixel-sized viewport). Rendered inspection confirmed the ungrouped Saved controls and the empty Online list despite an available DM.

Code evidence: SavedList resets its filters on unmount, silently treats missing selected collections as all collections, and offers no reset after no results. Its collection refresh can retain stale membership data after a mutation. FriendsView defaults to online friends without surfacing the existing opt-in recent conversations. These are code/design findings, not measured user research.

## Plan and acceptance

1. **A — Starting experience:** refresh the existing Messages/Friends entry with a title, concise context, New message, Saved shortcut and existing opt-in recent conversations. Preserve Friends tabs and the phone conversation list. First use must lead to a real message action without invented history.
2. **B — Finding saved messages:** refresh Later's header, tabs, filters and rows; distinguish first use, filtered emptiness, loading and failure. Add clear filters and explicit recovery for deleted/inaccessible collections. Keep only accessible message content visible and reuse server collection authorization.
3. **C — Continuation:** remember the Later tab, query, status and collection for the current account on this browser using the existing IndexedDB database. Restore on refresh and Back, validate stored values, serialize writes, show failed persistence with retry, and erase with account sign-out. No URL query leakage or cross-account restoration.

Use the established font, six palettes, light/dark/system themes and CSS tokens. Share only small presentation foundations. No dependencies, backend changes or production data migration. Preserve existing icons; the icon skill refers to a catalogue/adapter absent from this checkout, so this scope does not introduce or replace icon assets.

## Verification plan and baseline

- Typecheck: baseline passed. Lint: baseline passed. Existing targeted personal-history/navigation tests: 3 passed.
- Existing web-experience browser tests: 2 skipped because the default neighboring backend lacks the required capabilities. Use the available newer release API source with disposable local SQLite data for the selected flow; never use production data.
- Capture before/after desktop and narrow screenshots with generated test accounts and messages.
- Exercise real pairing, message opening/sending, collection persistence, filter recovery, reload/Back, account isolation, storage failure, inaccessible content and keyboard focus.
- Check changed layouts in light/dark and all six existing palettes, 320px/phone/desktop widths, reduced motion, and a shortened viewport representing keyboard space. Desktop emulation is not physical keyboard/device qualification.
- Run relevant Vitest, Playwright, lint, typecheck and production build. Record actual results below; do not infer full WCAG conformance or production Core Web Vitals from local tests.

Targets and references: [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/) for changed controls and [Core Web Vitals](https://web.dev/articles/vitals) (75th-percentile field LCP ≤2.5s, INP ≤200ms, CLS ≤0.1). No field measurements are available for this task.

## Implemented result and actual verification

Implemented A, B and C in the existing routes. `/dms` (desktop) and `/friends` use a shared `ExperienceHeader`, the existing NewMessageDialog and existing opt-in RecentActivity. Friends tabs now support arrow/Home/End keys and labeled panels; loading reserves space, failures offer retry, and no-results search can be cleared without losing focus. The phone `/dms` conversation list remains the entry view.

`/later` uses the same heading foundation, a labeled search/filter group, visible collection actions, clearer message rows and first-use/no-result/deleted-collection recovery. Collection mutations use the server-returned list and invalidate older reads. Duplicate submissions are guarded synchronously. New/Rename collection drafts survive refusal; dialog triggers explicitly receive focus for Safari focus recovery.

`useLaterView`, `application/laterView.ts` and two small LocalStore methods store only the selected tab, status, collection ID and current query in that account's existing IndexedDB `kv` store. Values are validated, writes serialize across view remounts, and reads await pending edits. Failed writes keep the current view usable and offer retry. The database is erased by the existing sign-out flow. This is browser/account view state, not cross-device preference sync or additional activity tracking. Saved messages/collections continue to use their existing synced APIs. No new dependencies, backend changes, database migrations or deployment configuration are required.

The CSS uses the existing palette/typography tokens, 44px controls, stronger input boundaries, wrapping toolbars and a scrollable layout with no new sticky elements. Shared navigation and URLs remain compatible. New copy is provided in English and Bengali; other locales use the existing English fallback.

### Verification results

| Check | Actual result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed: TypeScript, optimized Next.js static export and service-worker bundle; release build without test-linking enabled. Existing dependency annotation / browser-crypto externalization warnings remain |
| `npm test` | 143 files passed; 969 tests passed, 1 existing skip |
| `npm run i18n:validate` | Passed structural validation: 0 errors, 0 hardcoded source candidates. Full catalog coverage is incomplete: English/Bengali complete; 26 other locales have 95 missing entries each, including 18 added here, and use the existing fallback |
| Targeted Prettier check | Passed for the changed feature files and tests. Including `Shell.tsx` reports one pre-existing formatting issue in its SparkAssistant JSX, identical in the pre-edit backup; left untouched |
| `git diff --check` | Passed |
| `e2e/web-refresh.spec.ts`, all five browser projects | 30 passed: real messaging and peer decryption; collection operations; filter/Back/reload persistence; storage refusal/retry; deleted collections; removed conversation access; Friends errors; keyboard/dialog focus; all palette modes; first use; narrow layouts |
| Final journey/theme rerun after contrast and phone layout refinements | 10 passed across the same five projects; final screenshots regenerated |
| Existing `e2e/multiple-accounts.spec.ts`, Chromium and phone | 2 passed: account switching, cancellation, reload and logout of one account |
| Existing `e2e/dms-selection.spec.ts` | Existing assertion mismatch at line 45: expects exactly `/home`. The newer API lands at `/lobby`; the default neighboring API lands at `/home/c/:id`. Both follow the pre-existing `useLobbyLanding` / `communityLanding` logic, already wired in the pre-edit Shell. Earlier DMs/rail/sidebar assertions passed. The phone case is intentionally skipped by this desktop-only test. No routing logic or this test was changed |

The full refresh suite ran with:

```sh
ORBIT_SERVER_DIR=/Volumes/code_files/meldiq_web/.git/spark-purchase-release/api/server \
  npx playwright test e2e/web-refresh.spec.ts \
  --project=chromium --project=firefox --project=webkit \
  --project=phone-width --project=iphone-width
```

The existing Playwright harness started this API with disposable SQLite data and generated accounts. The refresh failure-injection suite blocks service workers so browser request interception reliably reaches the API; it does not qualify production PWA behavior. Account isolation and erasure also have real IndexedDB unit coverage in `test/later-view.test.ts`. The existing multi-account browser suite exercises session changes separately.

Visual inspection and test runs caught and resolved a collection-capability loading race in Firefox, Safari focus restoration, faint placeholder text and a cramped collection selector on phones. Targeted text/placeholder contrast checks require 4.5:1, control boundaries 3:1, across all six palettes in light/dark modes. These are focused checks, not a complete accessibility audit. Layout and dialog controls were also checked at 320×480 with reduced motion; this simulates constrained viewport space, not an actual phone keyboard.

Logs and before-edit snapshots are retained under `/tmp/meldiq-refresh-20261111/`. The generated `docs/i18n/coverage.json` reflects the current catalog after validation. No production deployment was performed.

### Preview and review

All screenshots use disposable local accounts and test messages. They are development evidence, not production previews.

Because this working copy already contains substantial unrelated work, a focused implementation patch is available at `/Users/nahian/Documents/Codex/2026-11-11/outputs/meldiq-web-refresh-20261111.patch`. It contains only this task's 15 source, locale and test files relative to the pre-edit working copy, not relative to Git HEAD. Documentation and screenshots are separate in this directory. The patch was checked in reverse against the completed files without applying it. No commit, branch switch or unrelated cleanup was performed.

| Screen | Before | After |
| --- | --- | --- |
| Messages/Friends desktop | [Before](web-refresh/before-friends-chromium.png) | [After](web-refresh/after-friends-chromium.png) |
| Messages/Friends phone | [Before](web-refresh/before-friends-phone-width.png) | [After](web-refresh/after-friends-phone-width.png) |
| Later desktop | [Before](web-refresh/before-later-chromium.png) | [After](web-refresh/after-later-chromium.png) |
| Later phone | [Before](web-refresh/before-later-phone-width.png) | [After](web-refresh/after-later-phone-width.png) |

Theme screenshots in the same directory cover Meldiq, Midnight, Charcoal, Indigo, Plum and Amber in light and dark. No production deployment was performed.

### Deliberate boundaries and next evidence

A new dashboard, global-search rewrite, pinning, notification system, onboarding campaign, integrations and analytics platform were deferred: the selected journey has useful existing mechanisms, and none requires those additions. Message sending, collection acknowledgments and account isolation were verified directly; no retention, conversion or production performance improvement is claimed.

Existing usage APIs (`src/sync/usage.ts`) report community resource counts and metering; they do not measure this personal Saved journey. No new tracking system or message/query telemetry was added. In a returning-user study, measure successful saved-message retrieval, completion time, recovery from no results and successful return to the same filtered view using consented task observations.

A physical iOS/Android software keyboard and native-language review beyond the supplied copy remain unverified. Browser emulation and targeted contrast/keyboard checks do not establish complete WCAG conformance. No production field Core Web Vitals or general product outcome telemetry is available here. The next useful step is a short returning-user study of finding a saved message and resuming its conversation, before expanding the home or command palette.
