# Orbit Web: status report (2026-10-19)

This repository is the web client of Orbit. Its server changes are two patches in `server-patches/` for the Orbit
repository (github.com/nahianahmed3832/griip-mesage, API 0.5.0); paths such as `server/…` and `android/…` below are in
that repository. Design: `ORBIT_WEB_ARCHITECTURE.md`. Feature-by-feature inventory: `ORBIT_WEB_PARITY.md`. Calls:
`ORBIT_WEB_CALLS.md`. Deployment (not applied): `ORBIT_WEB_DEPLOYMENT.md`. Hand-off notes: `ORBIT_WEB_HANDOFF.md`.

Words used below: *written* (the code exists), *tested* (automated tests pass against a real Orbit server, with the
server's reference protocol client, byte-compatible with the Android app, playing the other people), *verified in a
browser* (Playwright in real Chromium, Firefox and WebKit, or checked by hand in the browser pane). Nothing has been
verified with the Android app on a physical phone.

**Bottom line.** Orbit Web is an authenticated, end-to-end encrypted browser client of the existing Orbit server: same
accounts, workspaces, conversations and permissions as the Android app, no second backend or data store, realtime over
the server's WebSocket. People sign in with their Orbit 2.0 email account, set the browser up as another device of the
account (recovery key or approval from the phone), and then message, call, share files up to 1 GiB and run their
workspace from the browser. It is **not deployed**, **not tested with a physical phone**, and **production can't serve
it until the API is updated** (§3). Calls are built and tested in browsers but **not supported** until the phone test.

## 1. What was implemented

| Area | What | State |
|---|---|---|
| Orbit 2.0 accounts (`src/auth`, `src/ui/auth`) | Sign in, sign up with an emailed code, forgotten password, moving a pre-2.0 account (username + recovery key, checked in the browser). Device setup: the first device makes the identity and shows the recovery key once; later browsers use the recovery key or the phone's approval. Session tokens sealed with a non-extractable AES key in IndexedDB, renewals serialised; an ended session asks for the password and keeps local data. Account settings: password, sessions. | tested, verified in a browser |
| Workspaces (`src/ui/workspace`, `src/sync/workspaces.ts`) | Create (idempotent), join by code (preview first), settings and photo, leave, delete; people (roles, titles, removal, mirroring `server/src/roles.ts`); invitations; channels (create, access mode, archive, restore); branches and teams (create, archive, restore). New groups. | tested |
| Personal arrangement (`src/sync/navPrefs.ts`) | Starred, custom sections, collapsed groups and notification levels, synced through `/v1/me/preferences`, merged across devices; local archive and mark read/unread. Activity: mentions, missed calls, thread replies, change log. | tested |
| Messaging (`src/sync`, `src/ui/chat`) | Text, history and paging, replies and threads, edits, deletions, reactions, pins, mentions and @everyone, receipts, typing, presence; contact cards and locations; voice messages (record, preview, play); forwarding with re-encrypted files; call history lines; identity changes and safety numbers. | tested (recording itself: written only) |
| Files (`src/crypto/fileStream.ts`, `src/sync/largeUpload.ts`) | Up to 1 GiB in the phone's chunked format, never held whole in memory: S3 multipart (16 MiB parts, each bound to size and SHA-256) or a streamed POST; streamed decryption; save straight to disk where the browser allows. | tested (S3: against a simulated store) |
| Calls (`src/call`, `src/ui/call`) | Ringing, answering, placing, joining, per-call keys in memory from the creator only, LiveKit frame encryption with a per-track audit behind the "End-to-end encrypted" badge, reconnecting; screen sharing; microphone, camera and speaker choice. | tested; verified in browsers except screen sharing and device choice (simulated media only) |
| Profile and privacy (`src/sync/profile.ts`, `src/ui/settings`) | Photo, names, username, bio, birthday, phone; who sees each field and who can find you; blocked people (list, unblock). | tested |
| Runtime config and deployment (`src/app/config.ts`, `deploy/`) | `/config.json` (same-origin by default, or an https API origin); release build, install with atomic switch and nginx check, rollback, verify scripts; nginx site and security headers for web.griipbuddy.cloud. | written; config tested; nothing deployed |
| Server (`server-patches/`) | 0001: WebSocket authentication by first frame (browsers can't send headers). 0002: `WEB_ORIGINS` (CORS allowlist without credentials, WebSocket origin control). | tested against the server's own suite |

## 2. Backend reused (unchanged)

Accounts (`/v2/auth/*`, `/v2/account*`, `/v2/workspaces`, `/v2/migration/legacy/*`), devices and pairing (`/v1/auth/challenge`,
`/v1/pairing*`, `/v1/devices`), messages and queue (`/v1/messages`, `/v1/queue*`, `/v1/ws`), conversations
(`/v1/conversations*` including groups, members and calls), workspaces (`/v1/orgs*`, `/v1/branches*`, `/v1/teams*`,
`/v1/invites*`), preferences (`/v1/me/preferences/:workspaceId`), people and privacy (`/v1/users*`, `/v1/blocks`),
attachments (`/v1/attachments*` including direct uploads), history (`/v1/history/items`), calls (`/v1/calls*`, the
server's LiveKit) and `/v1/server-info`. Authorisation stays in `server/src/authz.ts` and `roles.ts`; the browser only
hides what the server would refuse, and the tests make the refused calls directly.

## 3. Backend changes, database and storage

- **Two server patches, nothing else** (`server-patches/README.md`): 0001 is required (without it a browser receives
  nothing live), 0002 is optional (off until `WEB_ORIGINS` is set). Both are backward compatible with the Android app.
- **No migrations, collections, buckets or services added.** The browser never talks to a database. Plaintext exists
  only on devices; the server stores ciphertext and the same metadata as for the phone.
- **Production** (`msg.griipbuddy.cloud`) ran API 0.4.x. It needs API 0.5.0 with patch 0001, SES for account email, and
  the DNS, TLS and S3 CORS steps in `ORBIT_WEB_DEPLOYMENT.md` §1. None of that was done.

## 4. Realtime and synchronisation

One authenticated WebSocket per browser (one tab holds it; others offer "Use Orbit here"): first-frame auth, ordered
frame handling, acknowledgements only after a message is stored, backoff 1–30 s with jitter, 25 s pings, re-auth on
4401 (refresh, or password when the session ended). Missed messages come back from the server's queue (7 days) in
order, once each; history restore fills older ones. Server events refresh exactly what changed: `conv.updated`,
`org.updated`/`org.deleted`, `prefs.updated` (the person's other devices), `devices.changed`, `call`, `presence`,
`typing`. Workspace switching changes only what's shown; every request is authorised by the server.

## 5. Tests run and results (2026-10-19)

All against API 0.5.0 with both patches (`ORBIT_SERVER_DIR`, `ORBIT_WEB_HANDOFF.md`), Node 25.8, macOS.

| Suite | Result |
|---|---|
| Web: `npm run typecheck`, `npm run lint`, `npm run format:check` | clean |
| Web: `npx vitest run` (unit + integration, 21 files) | **221 passed** on 5 of 6 runs; **one run had 1 failure** that wasn't captured and didn't recur in the next 5 runs (an intermittent; see §7) |
| Web: `npm run build` | main bundle 147 KB gzipped; settings and workspace administration load on demand (8 KB each); LiveKit (150 KB) and its worker only when a call starts |
| Browser: `npx playwright test` (Chromium, Firefox, WebKit, Pixel 7-sized Chromium; local LiveKit 1.13.10) | 40 tests (10 per project). **Two consecutive full runs after the last edit: 37 passed, 3 skipped, 0 failed each** (4.5 and 4.4 min). The skips are deliberate: the network-loss call test in Firefox and WebKit (their offline emulation doesn't cut live connections) and one desktop-only case at phone width. The first full run of this round, before the fixes, had 31 passed, 6 failed, 3 skipped: 5 failures in `accounts.spec.ts` (never run before; an ambiguous selector, and WebKit submitting before the typed email landed; both test-side, fixed) and 1 call flake in Chromium (§7) |
| Server (scratch copy with both patches): `npx vitest run` | **409 passed, 10 skipped** (live-S3 suite without credentials, one MongoDB-only case). One earlier run had a timing failure in `account_store_races` (refresh race on MongoDB) that passes alone, with and without the patches |

Shared vectors: the browser reproduces the Android envelope and payload vectors, the Android recovery-key encoding
(checked against an independent implementation) and the chunked file format (checked against the reference encryptor).

Found and fixed in this round: the dev proxy didn't forward `/v2`; a page reload could see its own tab lock as another
tab (start-up now retries briefly); call-log writes could race; browsers may not set `content-length` on S3 uploads.

## 6. Browser and physical-device verification

- **Real browsers**: Chromium, Firefox, WebKit and phone width (§5). By hand in the browser pane: sign-up with an emailed
  code, encryption setup and recovery key, reload into the stored session, creating a workspace, an invitation joined
  by a test person, the member list, a channel, starring and the conversation menu, the production build served with a
  `config.json`.
- **Physical phone: not performed.** Messages, files, preferences and calls with the Android app on a real device are
  unverified (§9). The reference client and LiveKit's native SDK make interoperability likely, not proven.

## 7. Known issues and security notes

**Security**
- Script injected into the page could use this browser's keys and session while it's open. Defences: React text
  rendering only, http(s)-only links, inert inline media, and the CSP in `deploy/nginx` (not deployed).
- Session tokens and WebKit's X25519 key are stored wrapped by non-extractable AES keys: protected at rest, not from
  script in the page. Chromium and Firefox keep the X25519 key itself non-extractable.
- Messages the browser received are kept in IndexedDB without the phone's SQLCipher layer; signing out erases them.
- The recovery key passes through the page when it's made or typed; it's dropped right after (never stored or sent).
- Profile and workspace photos aren't end-to-end encrypted (as on the phone). Starred items and section names are
  server-visible metadata (as on the phone).
- Inherited protocol limits (`SECURITY.md` §4): no forward secrecy, trust on first use, server-asserted membership,
  cooperative deletion. Not independently reviewed.

**Functional limits and open issues**
- Calls: not supported until the phone test (`ORBIT_WEB_CALLS.md` §8). Screen sharing and device choice tested only
  with simulated media. Known intermittent: in one full run the Chromium video-call test's badge stayed "Verifying
  encryption…" for 30 s; it then passed 5 of 5 times alone and in both later full runs. Cause not established; the
  test now attaches the per-track evidence at the moment of failure (`call-tracks-at-failure.json`) so the next
  occurrence can be diagnosed.
- Not built: blocking someone from the browser (unblocking works), renaming channels and branches/teams, adding channel
  members, departments, the synced workspace selection, phone-number lookup screen, animated emoji, several accounts in
  one browser profile, text size, storage screen, languages other than English, Web Push (no notifications without an
  open tab).
- Blocked outside this repository: **connectors** (Google Drive, Microsoft Graph, calendar, GitHub, Jira, Notion) and
  **custom roles**: being built by another session in the Orbit repository's uncommitted `orbit-integrations` worktree;
  nothing to integrate until it's committed. Group mentions need a protocol change (`WORKSPACE_ADMINISTRATION.md` §8).
- Large files: the S3 path is tested against a simulated store only; real S3 needs the bucket CORS rule.
- Voice messages recorded in Chrome or Firefox are Opus (WebM/Ogg); whether the Android app plays them is unverified.
- The intermittent unit/integration failure in §5 wasn't identified.

## 8. How to run, test and deploy

```bash
bash scripts/local-server.sh
```

```bash
npm ci && npm run dev
```

Open http://localhost:5173 (WebCrypto needs HTTPS or localhost). Account emails go to the server's `data/mail`;
`npx tsx scripts/demo-phone.ts mail` prints the codes. `ORBIT_SERVER_DIR` must point at a server with patch 0001.

```bash
npm run typecheck && npm run lint && npm run format:check && npx vitest run
```

```bash
npx playwright test
```

Calls locally: `bash scripts/livekit-dev.sh`, then `bash scripts/local-server.sh --calls`. Production build and
release: `bash deploy/scripts/build-release.sh`; install, verify and rollback: `ORBIT_WEB_DEPLOYMENT.md`.

## 9. Physical-phone test: when and how

Ready now. Everything runs on the Mac against a local Orbit server; production isn't touched. You need the Mac and the
phone on the same Wi-Fi, and an Orbit **debug or testing** build (0.2.2-beta or later) on the phone, which accepts
`http://` servers. Run these from this repository, with `ORBIT_SERVER_DIR` set to a server folder that has patch 0001.

1. Start the server and the web app, each in its own terminal:
   ```bash
   bash scripts/local-server.sh
   ```
   ```bash
   npm run dev
   ```
2. Find the Mac's Wi-Fi address:
   ```bash
   ipconfig getifaddr en0
   ```
3. On the phone: **Settings › Server and about › Servers › Add a server**, `http://<that address>:8080`, **Check**
   (expect server 0.5.0), **Add and switch**. Create an account with an email address; get the code with:
   ```bash
   npx tsx scripts/demo-phone.ts mail
   ```
   Set up encryption on the phone and **write down the recovery key**.
4. On the Mac, open http://localhost:5173 and **sign in with the same email and password**. Choose **Approve from my
   phone**; on the phone, **Settings › Devices › Approve new device**, type the code, check the device key matches the
   browser's, approve. (Or use **Use my recovery key**.)
5. A second person on the same server, if wanted:
   ```bash
   npx tsx scripts/demo-phone.ts setup
   ```
   ```bash
   npx tsx scripts/demo-phone.ts dm bob YOUR_PHONE_USERNAME
   ```

What we'll check together, recording pass or fail for each: messages both ways without a reload; replies, edits,
reactions and deletions both ways; a photo from the phone opens in the browser and a file and a voice message from the
browser open and play on the phone; a workspace created in the browser and joined from the phone with an invitation
code (and the reverse); starring and muting on one device shows on the other; reading on the phone clears the browser's
unread count; turning the Mac's Wi-Fi off and on, then catching up; removing the browser in the phone's Settings ›
Devices signs it out. Calls: `ORBIT_WEB_CALLS.md` §8.

Nothing here claims the physical-device test has passed. It will be recorded here after we run it.
