# Meldiq Web status (2026-10-20)

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

## 3. Still open

**Needs a decision or an action outside this repository**
- **S3 CORS rule:** browsers can't upload or download files through S3 until it exists. It needs an AWS login:

  ```bash
  aws s3api put-bucket-cors --bucket griipbuddy-orbit-media-sg --region ap-southeast-1 --cors-configuration '{"CORSRules":[{"AllowedOrigins":["https://web.meldiq.app"],"AllowedMethods":["GET","PUT"],"AllowedHeaders":["range","content-type","x-amz-checksum-sha256","x-amz-server-side-encryption","x-amz-server-side-encryption-aws-kms-key-id"],"MaxAgeSeconds":3000}]}'
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

All against the server code of API 0.7.1 (`srv071`, the production build), started in-process or as a local server.

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
