# Multiple browser tabs

Implemented 11 November 2026 in the existing web client. Opening another tab no longer shows the exclusive-use screen or stops the first tab.

## Behavior and implementation

- Every tab has its own navigation, view state and composer. Tabs for the same account/device share one WebSocket through `TabRealtimeClient`, using a device-scoped Web Lock and BroadcastChannel. This also avoids the API's per-device connection limit when five or more tabs are open. Closing, reloading or freezing the connection owner releases ownership; another tab continues delivery.
- The connection owner broadcasts incoming frames to the other tabs; followers process their copies without acknowledging the delivery again. Each tab still uses the existing authenticated REST APIs and authorization checks. Older/non-browser hosts without coordination APIs retain the ordinary direct transport.
- The API intentionally excludes the sending device from its own delivery queue. After a successful send, the client therefore broadcasts the accepted event to its sibling tabs. Failed/pending sends are not presented there as accepted. Events are validated and matched to the current user/device; session tokens are not sent through the channel. Existing message IDs and server idempotency remain in use for queued retries.
- A tab resuming after another tab acknowledged incoming messages refreshes its visible newest history window from the server. Deliberately detached search/older windows are preserved.
- `TabDrafts` preserves each tab's draft across reload without another tab's snapshot overwriting it. Session storage contains only AES-GCM ciphertext, bound to the account/database/device, using a non-exportable key in account IndexedDB. Logout clears the tab's draft data; late queued writes cannot recreate it. A failed save keeps the text in the composer and reports that the tab should remain open until the text is copied or saved.
- Account selection is pinned in each tab. Choosing another saved account in one tab does not change the other tab's account when it reloads. The most recently selected account remains the default for a new tab.
- Refresh-token rotation retains the existing cross-tab lock and rereads committed credentials. Local snapshot/token encryption-key creation is now atomic across database connections.
- Deleting the account's local database notifies every open connection. Other tabs stop their engines and hide private content, even if their API requests cannot reach the server. Signing out one saved account leaves another account's tabs usable.
- Message/call alert routing chooses one tab, preferring the focused tab, and suppresses a message alert when its conversation is being read in another tab. Calls retain one active microphone/media owner for this browser device; another tab cannot replace it. Incoming call cards stop ringing when the same device answers in another tab.

The removed whole-application lock was in `application/boot.ts` / `ui/App.tsx`. Coordination now belongs to `realtime/tabClient.ts`, rather than blocking the UI. No API change, database migration, new dependency or deployment flag is required. Existing browser capability requirements and supported browser targets remain unchanged.

Platform references: [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API), [Broadcast Channel](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API).

## Verification

All browser checks use generated accounts and a disposable local API database, never production data.

```sh
ORBIT_SERVER_DIR=/Volumes/code_files/meldiq_web/.git/spark-purchase-release/api/server \
  npx playwright test e2e/cross-device.spec.ts e2e/multiple-accounts.spec.ts \
  --project=chromium --project=firefox --project=webkit \
  --project=phone-width --project=iphone-width
npm test
npm run typecheck
npm run lint
npm run i18n:validate
NEXT_PUBLIC_MELDIQ_TEST_LINKING=0 npm run build
```

The focused browser scenarios cover five concurrent tabs, sending from either tab, receiving one accepted message, independent encrypted drafts after reload, connection-owner closure, simulated freeze/resume, logout while another tab cannot reach the API, simultaneous real token refresh, and account isolation across switching/reload/logout. The existing cross-device and account tests run alongside them. Browser lifecycle events and phone viewports are simulated; physical-device operating-system suspension and native call/media behavior are not qualified by these checks.

`test/multi-tab-storage.test.ts` verifies atomic key creation, encrypted draft/account isolation, corrupt-storage recovery, storage failure/retry (including unavailable browser storage), cancellation of late writes on logout, database invalidation, tab-specific account selection and serialized token rotation.

| Check | Actual result |
| --- | --- |
| `npm test` | 144 files passed; 977 tests passed, 1 existing skip |
| `npm run typecheck`, `npm run lint` | Passed; final build also reran TypeScript |
| Targeted Prettier and `git diff --check` | Passed |
| Cross-device / multiple-account browser cases, five projects | All 25 cases passed across the main run and targeted rerun. The main run passed 20 and exposed an existing logout test looking for the former “Sign out” label; its route/selectors were updated to the current “Log out” flow, then all 5 instances passed |
| Existing refresh journey (`e2e/web-refresh.spec.ts`, “starts a real message”) | 2 passed: desktop Chromium and phone-width; sending, Saved, Back and reload still work |
| `npm run i18n:validate` | 0 structural errors and 0 hardcoded source candidates. English/Bengali complete; the other 26 locales have 96 missing entries each, including this task's one new warning, using the existing English fallback |
| Release build with test linking disabled | Passed: TypeScript, optimized Next.js export and service-worker bundle. Existing HPKE annotation / browser-crypto externalization warnings remain |

Simultaneous “Add account” setup in separate tabs is outside these checks; the existing single pending account setup remains. Physical-device call/media and operating-system suspension still need their own qualification.

Logs and pre-edit copies are in `/tmp/meldiq-multitab-20261111/`. No production deployment is included. The earlier [web refresh](design/WEB_REFRESH_2026-11-11.md) and unrelated working-copy changes are preserved.

## Review artifact

`/Users/nahian/Documents/Codex/2026-11-11/outputs/meldiq-multi-tab-20261111.patch` contains these 20 source, locale, test and documentation files relative to the pre-task working copy, rather than Git HEAD. The generated localization coverage report is not part of that patch. The patch was checked in reverse without applying it. No branch switch, commit or unrelated cleanup was performed.
