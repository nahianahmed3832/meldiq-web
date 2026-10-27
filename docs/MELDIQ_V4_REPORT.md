# Meldiq Web overnight continuation v4: report (2026-10-28)

Brief: `Meldiq_Overnight_Continuation_Master_Prompt_v4.md`. Web first; native apps untouched. Branches: meldiq-web
`continuation-v4` (on `ai-workforce-web` a9eb914), meldiq `v4-api` (on `internal-beta` e80986e). API **0.48.0**.

## 1. What changed

| Area (brief §) | Result | Main files |
|---|---|---|
| Phones rebuilt after the Android app (§18, §14) | Home is the Android app's: a vertical community rail beside the channel panel (the horizontal strip with snap scrolling is gone). Bottom bar Home · Messages · Activity · **You** (your avatar with its status dot). The lists and a conversation have their own headers; the top bar only shows on Activity, Saved and Discover. The conversation header keeps the name, calls and the menu (pins and members are in the details the name opens). **You**: your card, Status (presence, status, pause notifications), Install, Saved, then every settings page as a list, each page with a way back | `ui/shell/Shell.tsx`, `Rail.tsx`, `TabBar.tsx`, `Sidebar.tsx`, `settings/SettingsView.tsx`, `YouCard.tsx`, `styles/responsive.css`, `settings.css` |
| Rail scrolling (§14) | Native scrolling only; edge cues are sticky overlays instead of a CSS mask on the scrolling element (masks cost Safari its fast scrolling); the selected community is brought into view by scrolling the rail alone (scrollIntoView also moved the page) | `ui/components/scrollStrip.ts`, `styles/layout.css` |
| Top-bar online pill (§16) | Removed. A slim banner shows only while the connection is down (after 1.5 s, with Retry); your own avatar's dot says you're online | `ui/shell/ConnectionBanner.tsx`, `TopBar.tsx` |
| Channel order flash (§15) | Two causes. (1) The browser restored conversations from its cache but not the server's feature list, so the first paint used the older workspace layout, which groups channels by category alphabetically. Now the feature list is cached too, and the list shows a skeleton until the layout is known. (2) A channel knew its category's name but not its place: API 0.48.0 adds `categoryPosition` to every channel, and the panel orders categories by it until the category list loads | `sync/engine.ts`, `ui/shell/Sidebar.tsx`, `sync/communityRules.ts`; API `conversationsRoutes.ts` |
| DM order (§15) | Newest activity first everywhere, with a stable tie-break (equal times never swap) | `ui/selectors.ts`, `Shell.tsx` |
| Encryption speed (§2) | Files up to 64 MiB: the ciphertext hashed by the browser's own SHA-256 in one call instead of in JavaScript, and AES-GCM chunks in flight together. Larger files keep the streaming hash (bounded memory). Same format, same checks; a corrupt copy now fails before decryption starts | `crypto/cipherJobs.ts` |
| Safety numbers retired (§13) | Gone: the details card, Mark as verified, Compare safety numbers, the number in the key-change dialog, the settings line, the security sheet's verified points, `safetyNumber()`, `markVerified()`. **Kept**: a changed security key still pauses messages until reviewed (the dialog now says what changed and asks to confirm it in person or on a trusted call) | `ui/chat/ConversationDetails.tsx`, `SecuritySheet.tsx`, `dialogs/IdentityReview.tsx`, `sync/conversationSecurity.ts`, `crypto/identity.ts` |
| Old account system retired (§13) | "Move an existing account" (username + recovery key, `/v2/migration/legacy/*`) removed with its forms and module. "Link with your phone instead" (phone-only sign-in) is off in release builds: nothing offers it and its screen, a separate chunk, is never loaded; development and the browser-test build keep it for the test phones (`auth/testLinking.ts`) | `ui/auth/AuthScreen.tsx`, `AccountForms.tsx`, `auth/accountApi.ts`, `App.tsx`; deleted `auth/legacyMove.ts` |
| Install as an app (§17) | "Install Meldiq" where the browser offers it (Settings › About, the You tab), never a banner; on iPhone/iPad the About page explains Add to Home Screen. The service worker still caches nothing (no private data in any cache) | `application/install.ts`, `ui/settings/InstallButton.tsx` |
| SQL to MongoDB (§19) | Plan only, from the code and a production backup's row counts; nothing migrated | meldiq `docs/SQL_TO_MONGODB_MIGRATION_PLAN.md` |

## 2. Encryption and transfers: measurements

`npx tsx scripts/bench-transfer.ts` (Node 25, this Mac; best of three; same output and hash checked):

| Size | v3 encrypt | v4 encrypt | v3 decrypt | v4 decrypt |
|---|---|---|---|---|
| 8 MB | 55 ms (145 MB/s) | 8 ms (972 MB/s) | 54 ms | 8 ms |
| 32 MB | 220 ms (146 MB/s) | 30 ms (1,050 MB/s) | 217 ms | 32 ms |
| 64 MB | 433 ms (148 MB/s) | 61 ms (1,041 MB/s) | 434 ms | 65 ms |
| 128 MB | 992 ms | 1,028 ms | 1,399 ms | 1,200 ms |
| 256 MB | 3,269 ms | 2,889 ms | 3,025 ms | 3,572 ms |

Up to 64 MiB: about 7× faster both ways. Above it nothing changed in substance (the 128 and 256 MB rows vary by
±20% between runs on this machine; an earlier run gave 913/870 and 1,901/2,082 ms). Above 64 MiB the JavaScript SHA-256 (~148 MB/s) still sets the pace; going
faster there needs WebAssembly (`'wasm-unsafe-eval'` in the CSP, the owner's decision) or keeping the whole file in
memory. Uploads can't overlap hashing with sending: the server takes the ciphertext's hash before the upload starts.
Resume, reuse and keys work as in v3 (`docs/MELDIQ_CONTINUATION_V3_REPORT.md` §3).

## 3. What was retired and what was kept (§13)

| Removed from Meldiq Web | Kept (security-critical) |
|---|---|
| Safety number card, Mark as verified, Compare safety numbers, the number in the key-change dialog, `safetyNumber()`, `markVerified()` | Identity keys and their pins, the pause on a changed key and its review, device certificates and their verification, HPKE/AES-GCM envelopes, attachment encryption, call encryption |
| Moving a pre-email account (`LegacyVerifyForm`, `LegacyDetailsForm`, `auth/legacyMove.ts`, `legacyVerify`/`legacyComplete`) | Email/password sign-in, passkeys, two-step sign-in, recovery key, account recovery codes, key backup, approving a new browser from another device |
| Phone-only sign-in in release builds | The same flow in development and the browser-test build; existing sessions keep working |

No server route, table or record was removed; the server keeps `/v2/migration/legacy/*` and device-key sign-in (the
Android app may still use them). Candidates for retiring during the database migration are listed in the plan §7.

## 4. Checks

| Check | Result |
|---|---|
| Web `tsc -b`, `eslint .`, `prettier --check` | clean |
| Web unit tests | 524 passed, 1 skipped (with `MELDIQ_CONTRACTS_DIR` on the API branch; new `retired-features`, two in `transfers`, one in `community-rules`) |
| API `tsc --noEmit` and full suite | 952 passed, 10 skipped (after regenerating `docs/api`; new `channel_order`) |
| Browser suite, Chromium desktop and phone width | 65 passed, 3 failed on the first run: two were tests written for the old phone layout or picking the wrong "More" button (fixed, then passed), one was `viewports` (the known intermittent reload flake: passed on the rerun, desktop and phone). Reruns of every affected spec: all passed |
| Wheel scrolling in Firefox and WebKit | `navigation-scroll` desktop test passed in both |
| New browser tests | `navigation-scroll` (real touch swipes through Chromium's DevTools protocol, and the wheel; rail, channels, a swipe opens nothing, a tap does), `chat-position` (opens at the newest message, after a reload and on return; a reader keeps their place and gets "1 new message"; the DM list follows new messages; categories in their saved order from the first paint, recorded across the reload), `retired-v4` |

## 5. Native apps

No file under `android/` changed (`git diff --name-only internal-beta -- android`: none); no app id, signing, version or
Play Store change. API 0.48.0 is additive (one new field). **Android CI on `internal-beta`** has failed since API
0.47.0 removed AI: the Android app still has AI screens and its contract tests expect the removed routes (6 of 736
tests). Fixing that means changing the Android app, which this brief excludes; production Android hides its AI parts
because the server no longer advertises the feature.

## 6. Production

TBD

## 7. Remaining

- **meldiq.app DNS** (owner): old `meldiq.app/invite/…` links and the Android app's links work once the apex points at
  the VPS (`docs/STAGE3_SETUP.md` §3).
- **GIF provider key** (owner): `GIF_PROVIDER`, `GIF_API_KEY`.
- **Discord import** (owner): the Discord app and its four settings.
- Real-device checks: touch scrolling was tested with Chromium's synthetic touch gestures and the wheel in Chromium,
  Firefox and WebKit; not on a physical iPhone or Android phone.
- Android CI (above).
