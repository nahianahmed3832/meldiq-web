# Orbit Web: status report (2026-10-18)

This repository is the web client. Its one server change lives in the Orbit repository (github.com/nahianahmed3832/griip-mesage),
on branch `orbit-web` (based on `internal-beta` at 6f355a1); paths such as `server/…` and `android/…` below are in that repository.
Design and audit:
`ORBIT_WEB_ARCHITECTURE.md`. Deployment plan (not applied): `ORBIT_WEB_DEPLOYMENT.md`.

**Bottom line.** Orbit Web is a working browser client of the existing Orbit server: a browser is linked as another
device of an account by the phone, then sends and receives end-to-end encrypted messages, files, reactions, edits,
deletions, pins and read receipts through the same server as the Android app, in real time, with reconnection and
history restore. It has been verified against a real server with the reference protocol client (byte-compatible with
the Android app) in Chromium, Firefox and WebKit. **It has not been tested with a physical phone yet** (§9), and
**production can't serve it until the server change is deployed** (§3).

**Calls (added 2026-10-18, `ORBIT_WEB_CALLS.md`).** Voice and video calls are implemented in the browser with the same
server API and the same media encryption as the Android app, and pass their tests in Chromium, Firefox and WebKit with
real encrypted media against LiveKit's native SDK. **They have not been run with the Android app on a physical phone,
so browser calls are not supported yet**; the step-by-step phone test is `ORBIT_WEB_CALLS.md` › 8.

## 1. What was implemented

| Area | What |
|---|---|
| Server (one change) | WebSocket authentication by first frame for clients that can't send headers: `server/src/ws.ts`, `WS_AUTH_TIMEOUT_MS` in `server/src/config.ts`, `server/test/ws_frame_auth.test.ts`, `docs/ABUSE_CONTROLS.md`. |
| Cryptography (`src/crypto`) | griip-envelope-v1 seal/open, Ed25519, HPKE (X25519), attachment encryption (single and chunked), history keys and items, pairing (sealed identity seed), fingerprints and safety numbers. WebCrypto + `@hpke/core`; private keys non-extractable. |
| Protocol and API (`src/protocol`, `src/api`) | zod validation of every server response, decrypted payload and history record; typed API client with re-authentication by signature. |
| Sync (`src/sync`, `src/realtime`, `src/store`) | Linking, sign-in, realtime client (first-frame auth, ordered frames, backoff, heartbeat), receive pipeline, outbox, history restore, trust on first use, IndexedDB store, sign-out. |
| Interface (`src/ui`) | Link screen; workspace rail and switcher; Home, DMs and Activity; sidebar with channel groups and DMs; conversation with history, paging, replies, threads, reactions, edits, deletions, pins, mentions, attachments (drag, paste, pick); details panel with members and safety numbers; search (⌘K); new message; channel browser; identity review; settings (profile, devices, notifications, appearance, security, about); status screens; responsive layout down to phone width. |
| Calls (`src/call`, `src/ui/call`) | Ringing, answering, placing and joining calls; per-call media keys in memory only, from the call's creator only, with late-joiner requests; LiveKit (`livekit-client` 2.22.3, pinned) with frame encryption; a worker that verifies frames for the "End-to-end encrypted" badge and drops unencrypted ones; call stage, permission and device states, reconnecting, verification code. Details and evidence: `ORBIT_WEB_CALLS.md`. |
| Tooling | `scripts/local-server.sh` (the Orbit server with local data; `--calls` for calling), `scripts/livekit-dev.sh` (a local LiveKit), `scripts/demo-phone.ts` (test participants for a local server), Playwright browser tests, `.github/workflows/ci.yml`. |

## 2. Existing backend services reused (unchanged)

Accounts and devices (`/v1/auth/challenge`, `login`, `add-device`, `/v1/pairing*`, `/v1/devices`), messages and queue
(`/v1/messages`, `/v1/queue`, `/v1/queue/ack`, `/v1/ws`), conversations (`/v1/conversations*`, `/v1/conversations/:id/devices`,
`/v1/users/devices`), workspaces (`/v1/orgs*`, `/v1/orgs/:id/channels`, `/v1/orgs/:id/activity`), people
(`/v1/users/me`, `/v1/users/:id`, `/v1/users/search`), attachments (`POST/GET /v1/attachments`), encrypted history
(`/v1/history/items`), calls (`POST /v1/calls`, `/join`, `/connected`, `/alerted`, `/decline`, `/end`, `/leave`,
`GET /v1/calls/:id`, `GET /v1/calls/active`; `call` and `queue.drained` realtime events; the server's LiveKit), and
`/v1/server-info`. Authorisation stays in `server/src/authz.ts`. Storage stays SQLite plus local disk or S3.

## 3. Backend changes and migrations

- **One change**: a socket without an `Authorization` header may authenticate with `{"t":"auth","token":…}` as its first
  frame within `WS_AUTH_TIMEOUT_MS` (default 10 s); anything else closes it with 4401 before anything is sent. The token
  never goes in a URL. Header authentication (the Android app) is unchanged; the session is still re-checked on every frame.
- **Calls needed no server change**: the browser uses the call API and events as they are (`ORBIT_WEB_CALLS.md` › 1).
- **No database migrations.** No new tables, stores, services or secrets. No second message store: plaintext exists only
  on devices, as before.
- **Not deployed.** Production (`msg.griipbuddy.cloud`) runs 0.2.0. Deploying is in `ORBIT_WEB_DEPLOYMENT.md`.

## 4. What works end to end

"Live" means a real Orbit server from this branch, with the reference client as the other side; "browser" means the
real app in that engine (§6).

| Feature | Status | Evidence |
|---|---|---|
| Link a browser from the phone (code + device-key fingerprint) | Works | `test/live.test.ts`; Playwright in Chromium, Firefox, WebKit, phone width; fingerprint on screen equals the phone's computation |
| Sign in again after reload with the device key (token in memory only) | Works | Playwright reload step, all engines |
| Receive in real time (decrypted, ordered by server time) | Works | live + browser tests |
| Send; the other person and the account's own phone both receive it | Works | live + browser tests; "Delivered" receipt shown |
| Phone's own messages appear in the browser as the account's | Works | live + browser tests |
| Edits, deletions, reactions, pins (both directions; author-only rules) | Works | `live.test.ts`, `live-actions.test.ts` |
| A control that arrives before its message | Works | `live.test.ts` |
| Read receipts (DMs, groups ≤ 20); reading on the phone clears the browser's unread | Works | `live.test.ts` |
| Mentions (resolved to member ids; @everyone needs the server's mark) | Works | `live-actions.test.ts`, `rules.test.ts` |
| Replies and thread replies | Works | `live-actions.test.ts` |
| Attachments both ways (encrypted, integrity-checked; up to 25 MB sent, 200 MB opened) | Works | `live.test.ts` |
| Offline: queued sends go out on reconnect; backlog after reconnect in order, once each, with every frame duplicated on the wire | Works | `live.test.ts` |
| Encrypted history restore on linking | Works with history written by the phone's algorithm | `live.test.ts` (items sealed by an independent implementation of `HistoryCrypto.kt`) |
| Identity key change: sends paused, incoming held, released on acceptance | Works | `live.test.ts` |
| Server-side authorisation (other conversations, files, forged signatures) | Enforced by the server | `live.test.ts` |
| Removing the browser from the phone signs it out and erases its data | Works | live + browser tests |
| Sign out (revoke, then erase) | Works | live + browser tests |
| One tab per browser; "Use Orbit here" | Works | browser test |
| Workspace switcher, channels, browse/join, activity feed, profile edit, devices list/removal | Works | `live-actions.test.ts`; manual in Chrome |
| Typing and presence | Works | `live-actions.test.ts`; manual |
| Voice and video calls, both directions, with E2EE media | **Works in browsers; not tested with a phone, so not supported yet** | `call-live.test.ts` (signalling and keys against the server with the reference client); `e2e/calls.spec.ts` in Chromium, Firefox, WebKit and at phone width (real LiveKit, media decrypted by LiveKit's native SDK, badge verified, wrong key shown as a problem) |
| Call key only from the call's creator, kept out of storage, late-joiner requests, refusal without a key | Works | `call-live.test.ts` (IndexedDB checked for the key) |
| Microphone and camera permission prompts and refusals, network drop and rejoin, busy, decline, ring recovery | Works | `call-live.test.ts`, `e2e/calls.spec.ts` |

## 5. Automated tests run and results

| Suite | Result |
|---|---|
| Server: `npm run typecheck`, `npm test` | clean; **275 passed, 9 skipped** (the real-S3 suite needs AWS credentials). Before the change: 268 passed. |
| Web: `npm run typecheck`, `npm run lint`, `npm run format:check` | clean |
| Web: `npm test` (unit + integration against an in-process server) | **141 passed** (89 before calls; Node 25.8). Coverage: 85% of lines, 80% of statements; `crypto` 99%, `protocol` 98%, `call` 89% of lines. The interface and the call code that needs a browser's WebRTC, workers and audio are covered by the browser tests. |
| Web: `npm run build` | 157 KB JavaScript gzipped for the app (145 KB before calls); LiveKit (149 KB gzipped) and the encryption worker load only when a call starts. The development-only inspection hook is absent from the bundle. |
| Browser: `npx playwright test` | **29 passed, 3 skipped** in Chromium 156 (full build, `channel: "chromium"`), Firefox 157.0, WebKit 27.2 and a Pixel 7-sized Chromium, with a local LiveKit 1.13.10. Skipped: a desktop-only test at phone width, and the network-drop call test in Firefox and WebKit (Playwright can't cut live connections there). The call tests also ran about 90 more times (`ORBIT_WEB_CALLS.md` › 6 › Stability: one unexplained Firefox failure, safe direction). Before calls: 11 passed, 1 skipped. |

Shared test vectors: the browser reproduces `android/app/src/test/resources/griip-envelope-v1-vectors.json` (the
same file the Android `EnvelopeInteropTest` and the server's `interop_vectors.test.ts` check) and re-encodes every payload
in `griip-payload-v1-vectors.json` to the same JSON.

Found and fixed by these tests: WebKit drops X25519 keys stored in IndexedDB (§7); the boot ran twice in React's
development mode; sidebar rows lost their link role; a draft could reappear after sending; a read receipt the phone
had already sent was repeated; sign-out could show "removed" instead of the link screen.

## 6. Browser and physical-device tests

- **Real browsers**: Chromium, Firefox, WebKit (Playwright, above). Manually in the Claude browser pane (Chromium) at
  1440×900, 800×600 and 375×812, light (Ivory) and dark (Cocoa): linking, messaging both ways, delivered and read
  receipts, mentions, reactions, activity feed, details panel, phone layout. No horizontal scrolling at 375 px.
- **Calls in real browsers**: Chromium, Firefox, WebKit and a phone-sized Chromium with fake microphones and cameras,
  real end-to-end encrypted media through a local LiveKit, against LiveKit's native SDK as the other participant
  (`ORBIT_WEB_CALLS.md` › 6). Screenshots checked at 1440×900 and phone width, light and dark: ringing card, call stage,
  badge, verification code, minimised bar.
- **Physical phone: not performed** (messages or calls). Nothing here proves interoperability with the Android app on a
  real device yet; the reference client is byte-compatible with it (shared vectors), and the native LiveKit peer uses the
  frame cryptor of the Android SDK's family with Android's key handling, which makes success likely but is not proof.

## 7. Known issues and security notes

**Security**
- **Safari / WebKit**: WebKit can't keep non-extractable X25519 keys in IndexedDB (verified: they read back as plain
  objects). There the browser's encryption key is stored wrapped by a non-extractable AES key (`crypto/keyStorage.ts`):
  protected at rest, but script running in the page could unwrap it. Chromium and Firefox keep it non-extractable.
- **Messages at rest**: the browser keeps the messages it received or restored in IndexedDB, in the browser profile,
  without the phone's SQLCipher layer. Signing out erases them. Shared computers should sign out (the settings say so).
- **Injected script** in the page could use this browser's keys while it's open (not export them, except as above).
  Defences: React text rendering only (no HTML from messages), http(s)-only links, inert-only inline media, and the CSP
  in `ORBIT_WEB_DEPLOYMENT.md` (not deployed yet).
- **Linking moves the identity seed** into the browser once, sealed to it; the browser uses it to derive history keys
  and then drops it. A compromised page *during linking* could capture it.
- **Inherited protocol limits** (`SECURITY.md` §4): no forward secrecy, trust on first use, server-asserted group
  membership, cooperative deletion. Unchanged by Orbit Web.
- **Call keys** live only in the page's memory while a call can use them (never IndexedDB, the outbox or logs). Script
  injected into the page could read them during a call, as it could use the message keys. Every participant's media
  is treated as encrypted whatever the media server says, and frames that would cross unencrypted are dropped.
- **Not independently reviewed.** This report is the author's review, not an audit.

**Functional limits**
- Calls: **not supported until the physical-phone test passes** (`ORBIT_WEB_CALLS.md` › 8). Not in the browser: screen
  sharing, choosing a microphone or camera, ringing with no Orbit tab open, group calls tested beyond one-to-one
  (`ORBIT_WEB_CALLS.md` › 7). Production also needs the CSP and Permissions-Policy in `ORBIT_WEB_DEPLOYMENT.md`.
- The browser reads the account's encrypted history but doesn't write it; the phone uploads everything the browser
  sends or receives (it gets a copy of each). Messages exchanged while the phone is away longer than the 7-day relay
  window reach history only from the browser's own storage.
- Unread counts are per device (as on the phone). Reading syncs between devices only where read receipts exist: DMs and
  groups of up to 20, not channels.
- Not in the browser yet: creating groups and channels, workspace administration and invitations, muting and chat
  archive, voice-message recording and inline playback, profile photos, call history, sending files over 25 MB.
- Notifications work only while a tab is open (no Web Push: the server's push is UnifiedPush for Android).
- Auth routes allow 30 requests a minute per address (existing server limit); many people linking browsers at once
  behind one address could be slowed.

## 8. How to run and deploy

Development (from the repository root):

```bash
bash scripts/local-server.sh
```

```bash
npm install && npm run dev
```

Open `http://localhost:5173` (must be `localhost`: browsers enable WebCrypto only on HTTPS or localhost). Checks:
`npm run typecheck`, `npm run lint`, `npm test`, `npm run test:integration`, `npx playwright test` (README.md). Production: `ORBIT_WEB_DEPLOYMENT.md`.

With calls: start a local LiveKit first, then the server with `--calls` (`brew install livekit` once):

```bash
bash web/scripts/livekit-dev.sh
```

```bash
bash web/scripts/local-server.sh --calls
```

The call browser tests also need `npm ci` in the Orbit repository's `tools/griip-bot` (LiveKit's native SDK plays the other side).

## 9. Phone test: when and how

For **calls**, follow `ORBIT_WEB_CALLS.md` › 8 (it starts LiveKit and the server with calling, and gives the browser its
own account so it can call your phone). The steps below cover messaging.

**The browser side is ready for the physical-device test now.** It runs against an Orbit server started on the Mac, so
production isn't touched; the phone joins that server as a second profile of the Orbit app. Run the commands below from
this repository, with `ORBIT_SERVER_DIR` set to the `server/` folder of the Orbit repository's `orbit-web` branch (the
one with first-frame WebSocket authentication).

You need: the Mac and the phone on the same Wi-Fi; an Orbit **debug or testing** build on the phone (those allow
`http://` servers; a release build accepts only HTTPS).

1. On the Mac, start the server (keep it running):
   ```bash
   bash scripts/local-server.sh
   ```
   If macOS asks whether `node` may accept incoming connections, allow it.
2. In a second terminal, start the web app:
   ```bash
   npm run dev
   ```
3. Find the Mac's address on the Wi-Fi (it was `192.168.0.5` during development):
   ```bash
   ipconfig getifaddr en0
   ```
4. On the phone, in Orbit: **Settings › Server and about › Servers › Add a server**, enter `http://<that address>:8080`,
   tap **Check** (expect "server 0.3.0", open sign-up and an unencrypted-connection warning), then **Add and switch**.
   Create an account there (no invitation needed on this server). Your production account stays as it is.
5. On the Mac, open **http://localhost:5173**. It shows a link code and a device key.
6. On the phone: **Settings › Devices › Approve new device**, type the code, tap **Look up**, check the device key matches
   the browser's, tap **Approve**. The browser opens your account.
7. Optional second person on the same server (prints usernames; `dm` opens a DM with your phone's username):
   ```bash
   npx tsx scripts/demo-phone.ts setup
   ```
   ```bash
   npx tsx scripts/demo-phone.ts dm bob YOUR_PHONE_USERNAME
   ```
   ```bash
   npx tsx scripts/demo-phone.ts say bob phone "Hello from Bob"
   ```

What we'll check together: a message typed on the phone appears in the browser without a reload and the reverse;
reactions, edits and deletions both ways; a photo from the phone opens in the browser and a file from the browser opens
on the phone; reading on the phone clears the browser's unread count; messages sent on the phone before linking appear
after linking (history); turning the Mac's Wi-Fi off and on, then catching up; removing the browser in the phone's
Settings › Devices signs it out.

Nothing in this report claims the physical-device test has passed. It will be recorded here after we run it.
