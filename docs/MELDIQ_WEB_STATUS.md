# Meldiq Web status (2026-10-22)

## Android parity round B1–B16 (2026-10-22, not deployed)

Branch `claude/meldiq-web-android-parity-a6333c` brings Android's batches B1–B16 to the web: community structure and
settings, moderation, connections and message requests, forums and the guide, community emoji, call controls (B10,
B11), the minimal DM screen (B14) and motion (B16). Behaviour-by-behaviour status, with what's missing and what wasn't
verified: **`product/MELDIQ_WEB_PARITY_MATRIX.md`**. Commits and how it was checked: `MELDIQ_SESSION_HANDOFF.md`.
**The web is not at full parity**: the matrix lists the gaps. Nothing from this round is in production.

The sections below are from 2026-10-20.


This document covers the current round and where to pick up again. The feature-by-feature inventory, with an ID, the
Android source, backend, tests and verification level for every row, is `MELDIQ_WEB_FEATURE_PARITY.md`. Earlier rounds
are summarised in §6 and detailed in `ORBIT_WEB_STATUS.md`.

Live: **https://web.meldiq.app** (`web.griipbuddy.cloud` redirects there). The API at `msg.griipbuddy.cloud` is **0.7.1**,
deployed by another session, with the browser WebSocket patch.

## 0. Android sync passes (2026-10-20, later)

The web was matched to the **latest Android code** in two passes. Item by item: `MELDIQ_ANDROID_WEB_SYNC_REPORT.md`
(S-01 … S-29); inventory: `MELDIQ_WEB_FEATURE_PARITY.md` (section R7 for round 7 C1–C8).

- **Reference:** `internal-beta` `35aa4b5` (0.2.3-beta), plus round 7: uncommitted work in the `orbit-integrations`
  worktree (slice A, the call/channel fixes, and slices C1–C8), aimed at 0.2.4-beta.

**Pass 1 (commit `a70afad`), live in production:**
- Profile cards in place of contact cards with phone numbers.
- No call buttons in text channels; public channels that reach every member; faster call setup; mirroring only your own
  front camera.
- Pin button and pinned list; bulk save to a folder; message info; on-device translation where the browser has it.
- Invitation QR codes and pasted invite links; notification and chat options; bubbles layout; your network address.

**Pass 2 (commits `8509ac0` … `ce8dc3e`), round 7 C1–C8, built in Android's order:**
- C1 service health (platform admins), C2 universal search, C3 workflows, C4 documents, C5 templates, groups, guest
  end dates and meetings, C6 API keys and webhooks, C7 measured usage and limits, C8 AI with consent on every request.
- Each screen appears only when the server advertises its feature and the person has the permission. **Production's
  API (0.7.1) offers none of them, so they are deployed but hidden** until the round 7 server is deployed (not ours to
  deploy; needs your approval).
- Fix found by hand (`606c625`): long workspace and settings pages couldn't scroll in windows wider than 640 px.

**Pass 3 (version 0.2.4-beta), round 8 and the app version:**
- The Unified Inbox for customer conversations from Messenger, Instagram and WhatsApp business accounts: Workspace ›
  Customer inbox (`inbox.view`) and Inbox setup (`inbox.manage`), matching the phone's three screens and notices. It
  appears only where the server offers `unified-inbox`; production doesn't yet.
- The web's version is now **0.2.4-beta**, the Android release these features ship in, shown in Settings › About.
- Checked against the newest round 7/8 server code: the whole suite passes there too.
- By hand against a local copy of that server with a fake Meta inside it: a test Page connected through the web's own
  dialog, a synthetic customer's message arriving live, a reply, an internal note and a priority change. No real Meta
  account exists or was used.

**Tests (pass 2):**
- Unit and live against the round 7 server copy: 55 files, **355 passed**. Against the 0.7.1 code: **338 passed, 17
  skipped** (the round 7 suites skip themselves).
- AI was tested with a stand-in provider inside the test server, as the server's own tests do. No real AI provider was
  called, and none is configured anywhere.
- By hand (Chromium, local round 7 server): template applied, meeting scheduled with an invitee, AI page without a
  provider, measured usage, an API key made (token shown once, not in browser storage).

**Not done:** phone-tested. Round 7 needs its server deployed before anyone sees C1–C8.

**Resume here:** `MELDIQ_ANDROID_WEB_SYNC_REPORT.md` §6.

## 1. Built this round

Every item is backed by the real server (API 0.7.1). No mock APIs and no browser-only stand-ins for server features.

**Accounts**
- **Account recovery with recovery codes** (lost email): start with the current email, a code and a new email, then
  confirm with the emailed 6-digit code and a new password. The screen says plainly that this restores the account,
  not the encryption keys.
- **Recovery codes in Settings › Account:** see how many are left, make a new set (shown once, copy or download), revoke.
  All behind the password.
- **Signing in again after the email changed** on another device.
- **First-run introduction**, shown once per browser and again from Settings › About.

**Later**
- **Saved items**, synced through the personal preferences document like the phone's.
- **Reminders:** create, edit, snooze, complete, dismiss, repeat. They go off once in the browser.
  - Contents are sealed with the account's reminder key, so the server can't read them; the phone can.
  - A saved message with a time gets the same server reminder the phone would make.
  - Browsers set up before reminders existed unlock them with the recovery key.

**Messages**
- **Polls:** create, vote, change your vote, close (creator only).
- **Stickers:** the shared catalogue.
- **Music and video cards** for YouTube, YouTube Music, Spotify, SoundCloud and Vimeo links, with an on/off setting.
  Nothing is fetched.
- **Conversation security sheet** behind a padlock in the header.
- **Search in a conversation.**
- **Album grid**, with a viewer that steps through the photos.
- **Photo quality** (Standard, HD, Original). Standard and HD re-encode the photo, so location data isn't sent.

**Home**
- **Drafts & sent.**
- **Get started** checklist.

**Workspaces**
- **Custom roles:** catalogue, templates, editor and assignments.
- **Audit log, ownership transfer, usage and limits.**
- **Apps:** directory, install, request, turn off, uninstall.
- **Incoming webhooks and workflows.**
- **Live app updates** in channels.

**Calls**
- **Voice rooms:** create one, see who's in it from Home, and join without ringing anyone.
- **Raise hand**, and the room managers' **mute, lower hand and remove**.
- **The room's key** can be passed on by anyone connected, under the phone's rule.

**Fixed on the way**
- **App updates in a channel never loaded.** The server's event ids are strings and the web expected numbers.
  `live-roles-apps` caught it.
- **Search snippets** now keep the match in view next to long links.
- **The type check:** `npx tsc --noEmit -p .` checks nothing in this repository, because the root config only has
  references. The real check is `npx tsc -b` (what `npm run build` runs). It was used for this round and is clean.

## 2. Production

| When (UTC) | Change | By |
|---|---|---|
| 2026-10-20 | API **0.7.1** with the WebSocket first-frame patch | Another session |
| 2026-10-20 01:39 (UTC+8) | Web release **0.1.0-9e04997** (this round, §1) | This session; see §2a |
| 2026-10-20 10:46 (UTC+8) | Web release **0.1.0-1286588**: both Android sync passes (§0) and the scroll fix | This session; see §2b |
| 2026-10-20 12:36 (UTC+8) | Web release **0.2.4-beta-ba154b1**: round 8 Unified Inbox and the 0.2.4-beta version (§0, pass 3) | This session; see §2c |
| 2026-10-20 13:39 (UTC+8) | Web release **0.2.4-beta-e95c739**: files from S3 open in the browser without a bucket CORS rule (reported bug: "Can't reach the server" on a photo) | This session; see §2d |

### 2a. Web deploy

- **Release:** `release/meldiq-web-0.1.0-9e04997.tar.gz`, SHA-256 `ab0a3ded…50ef5`, checked on the VPS before unpacking.
- **Install:** with the production command in `ORBIT_WEB_DEPLOYMENT.md` §4. `nginx -t` passed; only the web site and its
  header snippet changed. The API and its compose project weren't touched.
- **Rollback:** the previous release `0.1.0-3b3a580` is kept. Run `bash rollback.sh` on the VPS.
- **Checks:**
  - `verify.sh https://web.meldiq.app`: all ✓. That covers TLS, security headers, `config.json` not cached, the API
    through this origin reporting 0.7.1, accounts, and realtime upgrade 101.
  - The served bundle contains this round's screens.
  - `web.griipbuddy.cloud` still answers 301.
  - A bare browser socket stays open and closes with 4401 after 11.2 s, so first-frame sign-in works on 0.7.1.
- **Not checked:** a signed-in session on production. It needs your account, and this session doesn't enter passwords.

### 2b. Web deploy of 0.1.0-1286588

- **Release:** `release/meldiq-web-0.1.0-1286588.tar.gz` (commit `1286588`, pushed to `origin/main`), SHA-256
  `012d1665…`, checked on the VPS before unpacking. Its build ran typecheck, lint, 237 unit tests and the production
  build; the unpacked release (43 files) was scanned for key material: clean.
- **Install:** the production command in `ORBIT_WEB_DEPLOYMENT.md` §4; `nginx -t` passed. The API wasn't touched.
- **Rollback:** `0.1.0-9e04997` is kept. Run `bash rollback.sh` on the VPS.
- **Checks:** `verify.sh https://web.meldiq.app` all ✓ (TLS, headers, `config.json`, API 0.7.1 through this origin,
  accounts, realtime 101); the served `index` bundle is this release's; `web.griipbuddy.cloud` answers 301; a bare
  socket closes with 4401 after 11.2 s.
- **Round 7 screens are hidden in production:** its API offers none of `search`, `workflows`, `documents`,
  `workspace-templates`, `groups`, `guest-expiry`, `meetings`, `developer-api`, `ai` (checked on `/v1/server-info`).
- **Not checked:** a signed-in session on production (needs your account).

### 2c. Web deploy of 0.2.4-beta-ba154b1

- **Release:** `release/meldiq-web-0.2.4-beta-ba154b1.tar.gz` (commit `ba154b1`, pushed to `origin/main` of
  github.com/nahianahmed3832/meldiq-web), checksum checked on the VPS. Its build ran typecheck, lint, 243 unit tests and
  the production build; the unpacked release (43 files) was scanned for key material, Meta tokens included: clean.
- **Rollback:** `0.1.0-1286588` is kept. Run `bash rollback.sh` on the VPS.
- **Checks:** `verify.sh` all ✓; the served bundle is this release's; `web.griipbuddy.cloud` answers 301; a bare socket
  closes with 4401 after 11.2 s.
- **Hidden in production:** the API (0.7.1) offers none of the round 7/8 features, `unified-inbox` included.

### 2d. Web deploy of 0.2.4-beta-e95c739 (S3 fix)

- **Cause:** production keeps files in S3; the API answers a download with an S3 link, and the bucket has no CORS rule,
  so browsers refused it ("CORS is not enabled for this bucket", checked from outside). Large uploads failed the same
  way.
- **Fix:** the new nginx snippet `/etc/nginx/snippets/meldiq-web-media.conf` (bucket origin from
  `MELDIQ_CONNECT_EXTRA`) and the app's fallbacks (`ORBIT_WEB_DEPLOYMENT.md` §4, §6). Tested by `live-s3-cors` and, for
  nginx 1.24 itself, by a temporary instance on the VPS (9 cases, removed afterwards).
- **Checks:** `verify.sh` all ✓; `/media/attachments/<id>` reaches the API (401 without a token, POST refused); the VPS
  reaches the bucket over TLS; served bundle is this release's; socket closes with 4401 after 11.0 s.
- **Confirmed by the owner (2026-10-20):** after a reload, the photo from the phone that showed "Can't reach the
  server" opens in the browser on production.
- **Rollback:** `0.2.4-beta-ba154b1` is kept (`bash rollback.sh`); the snippet stays harmless without the app's use.

## 3. Still open

**Needs a decision or an action outside this repository**
- **S3 CORS rule (recommended, no longer blocking):** the bucket still has no CORS rule ("CORS is not enabled for this
  bucket", checked 2026-10-20), which broke every file in the browser ("Can't reach the server"). Since `0.2.4-beta`
  the web works without it: downloads go through the web server's `/media/attachments/` and uploads through the API
  when S3 refuses the browser (`ORBIT_WEB_DEPLOYMENT.md` §6). Adding the rule moves that traffic back to S3 directly.
  It needs an AWS login, and the earlier version of the rule lacked `if-none-match`:

  ```bash
  aws s3api put-bucket-cors --bucket griipbuddy-orbit-media-sg --region ap-southeast-1 --cors-configuration '{"CORSRules":[{"AllowedOrigins":["https://web.meldiq.app"],"AllowedMethods":["GET","PUT"],"AllowedHeaders":["range","content-type","if-none-match","x-amz-checksum-sha256","x-amz-server-side-encryption","x-amz-server-side-encryption-aws-kms-key-id"],"MaxAgeSeconds":3000}]}'
  ```

  First check that `get-bucket-cors` returns `NoSuchCORSConfiguration`, because `put-bucket-cors` replaces the whole
  rule.
- **Physical-phone test:** no row is device-verified. Real Android ↔ web for messages, polls, reminders, voice rooms,
  files and calls hasn't been done; the reference client proves the protocol only.
- **Connecting your account to an app from the web:** the server returns OAuth only to `meldiq://integrations`
  (`INTEGRATIONS_APP_RETURN_URL`). The web needs a per-client return, such as `https://web.meldiq.app/#/workspace/apps`.
  This is a server change and needs approval.
- **Blocked on the server:** Web Push (VAPID), so there are no notifications without an open tab. Sending link previews
  (needs a server-side fetcher).
- **Not built:** translation (on the phone it's on-device ML), languages other than English, several accounts per
  browser profile.

**Known intermittent**
- The Chromium "video call from the phone app" browser test.
  - It sometimes stays at "Verifying encryption…" when it's the first call after LiveKit starts.
  - Today it failed once in the full run and passed when the call suite was run again (5/5).
  - No call path it uses changed this round. Voice rooms add code only for voice-room calls.

## 4. Tests run (2026-10-20)

**Pass 3 (round 8 inbox, version 0.2.4-beta; latest):**

| Suite | Result |
|---|---|
| Typecheck, lint, format | clean |
| Unit + live, newest round 7/8 server copy | 57 files, **364 passed**, 0 failed |
| Unit + live, API 0.7.1 code | 57 files, **344 passed, 20 skipped** (round 7/8 suites skip themselves), 0 failed |
| New suites | `inbox-rules` (the phone's `InboxRulesTest` cases), `live-r8-inbox` (fake Meta inside the test server) |
| Browser (`npx playwright test`, 4 projects, LiveKit, API 0.7.1 code) | 36 passed, 3 skipped (deliberate), 1 failed: the known Chromium "video call from the phone app" intermittent. Call suite run again: **18 passed, 2 skipped, 0 failed** |
| By hand (Chromium, local round 7/8 server with a fake Meta) | Inbox setup lists platforms (TikTok awaiting access); a test Page connected through the dialog (token masked); a synthetic customer's message arrived live; reply sent, note added, priority set. Fixed: the header's name and details ran together; a paragraph nested in a paragraph |

**Round 7 C1–C8 pass:**

| Suite | Result |
|---|---|
| Typecheck (`npx tsc -b`), lint, format | clean |
| Unit + live, round 7 server copy | 55 files, **355 passed**, 0 failed |
| Unit + live, API 0.7.1 code | 55 files, **338 passed, 17 skipped** (round 7 suites skip themselves), 0 failed |
| New suites | `live-r7-ops`, `universal-search`, `live-r7-search`, `workflow-rules`, `live-r7-workflows`, `document-rules`, `live-r7-documents`, `meeting-rules`, `live-r7-c5`, `live-r7-developer`, `live-r7-usage`, `ai-rules`, `live-r7-ai` (stand-in AI provider inside the test server) |
| Browser (`npx playwright test`, 4 projects, LiveKit, API 0.7.1 code) | **37 passed, 3 skipped** (deliberate), 0 failed |
| Release build and secret scan | passes; clean |
| By hand (Chromium, local round 7 server) | all round 7 pages listed; template applied; meeting scheduled with an invitee; AI page without a provider; measured usage; API key made (token once, not stored). Found and fixed: long pages didn't scroll in wide windows |

**Earlier in the day**, all against the server code of API 0.7.1 (`srv071`, the production build), started in-process or as a local server.

| Suite | Result |
|---|---|
| Typecheck (`npx tsc -b`), lint, format | clean |
| Unit (`npm test`, 24 files) | **201 passed** |
| Unit + live (`npx vitest run`, 36 files) | **295 passed**, 0 failed |
| New live suites | `live-roles-apps` (6), `live-voice-rooms` (5), `live-later` (5), `live-rich` (5), `live-accounts` recovery codes (2) |
| Browser (`npx playwright test`, 4 projects, with LiveKit) | 36 passed, 3 skipped (deliberate), 1 failed (the known intermittent). Call suite run again: **5 passed** |
| Production build | passes; no secrets in the bundle (scanned for LiveKit, integration, AWS and key material) |
| By hand (Chromium, local 0.7.1 server) | Intro, Get started, Spotify card, security sheet, search with highlight and jump, voice room created and listed with its banner, usage page, two photos re-encoded and sent as an album with the viewer |

**Not checked by hand:** the Raise hand button and the People panel on the call screen. The local server had no media
server. Their behaviour is covered by `live-voice-rooms`, which drives the same call manager.

## 5. Where to resume

0. **Round 7 server:** C1–C8 appear in production once the round 7 API is deployed (your approval). Then open each by
   hand there; see `MELDIQ_ANDROID_WEB_SYNC_REPORT.md` §6.
1. **Signed-in check on production** (yours to do): sign in on web.meldiq.app and open Later, a voice room, and
   Workspace › Roles, Apps and Usage.
2. **S3 CORS:** after the rule is applied, send a file from the browser in production and open it on the phone.
3. **Physical-phone test:** `ORBIT_WEB_STATUS.md` §9, extended with polls, a reminder made on each side, and a voice room
   with the phone and the browser in it.
4. **OAuth return for the web** (server change, needs approval), then connecting accounts and sharing from apps.
5. **Call intermittent:** run `e2e/calls.spec.ts` on a cold LiveKit several times and read `call-tracks-at-failure.json`.

## 6. Earlier round (2026-10-19), in short

- **Sign-in / recovery-key failure:** root cause and fix in `fdf4f11`.
  - The phone ended the browser's setup session from its session list, and setup kept reusing the dead tokens.
  - A 401 on refresh now ends setup and returns to sign-in, with an explanation.
  - Regression tests: `live-accounts` and `e2e/accounts`.
- **API upgrades:**
  - 0.4.2 → 0.5.0 with the browser patches, with your approval. A backup was taken first.
  - Then 0.6.0 and 0.7.1 were deployed by other sessions. The patches are now in the server repository.
- **Parity round `3b3a580`:** conversation management, people lookup, structure admin, link warnings, animated emoji,
  media gallery, storage.
