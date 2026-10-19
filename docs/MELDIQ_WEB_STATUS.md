# Meldiq Web status (2026-10-19)

This document covers the current round and where to pick up again. The feature-by-feature inventory is
`MELDIQ_WEB_FEATURE_PARITY.md`. Earlier rounds are in `ORBIT_WEB_STATUS.md`, whose evidence still stands.

Live: **https://web.meldiq.app**. `web.griipbuddy.cloud` redirects there. The API is **0.5.0 + browser patches** at
`msg.griipbuddy.cloud` (the same container serves both).

## 1. The sign-in / recovery-key failure: root cause and fix

**Symptom (production, 09:00–09:03 UTC).** Signing in worked (`POST /v2/auth/login` 200). Setting the browser up then
failed every time, whether with the recovery key or with the phone's approval:

- `POST /v2/account/devices` returned **401**.
- `POST /v2/auth/refresh` returned **401**.

**Evidence.** The web host's access log and the API's request log, paths and status codes only (no bodies, tokens or
codes). In the 80 seconds between the sign-in and the first failure, the **phone** made these calls:

1. Listed the account's sessions (`GET /v2/account/sessions`).
2. Deleted three of them (`DELETE /v2/account/sessions/…`, 09:01:13–09:01:17).

A browser that is still being set up appears in that list, because its session has no device yet.

**What the failures mean on the server.** Nothing else could explain them:

- The session was revoked, so the access token was refused.
- The refresh token was refused for the same reason. It wasn't expiry: the access token lasts 15 minutes, and the
  refresh token was only 80 seconds old.

**Root cause (web).** `SetupCredentials` didn't recognise a refused refresh as the end of the session. Every later
attempt (09:02:57, 09:03:26) reused the dead tokens and failed the same way, with no way forward short of reloading the
page.

**Ruled out.** Your recovery key was never sent and was not at fault:

- The code isn't sent anywhere. Only a signature made with it is.
- The certificate and proof formats match the server byte for byte (`griip-device-cert-v1`, `griip-auth-v1`).
- Both setup paths work on production's exact server code with test accounts.

**Fix** (`src/auth/setupCredentials.ts`, `src/ui/auth/AuthScreen.tsx`, commit `fdf4f11`, deployed 10:31 UTC):

- A 401 on refresh ends the setup session. Nothing more is sent with it.
- The screen returns to sign-in with the email kept and an explanation.
- Nothing about keys, certificates or the server's checks changed, and no safeguard was relaxed.

**Regression tests** (both fail on the previous code):

- `test/live-accounts.test.ts`, "a setup session removed on another device…", against the real server.
- `e2e/accounts.spec.ts`, which removes the browser's setup session through the session list mid-setup, then expects the
  explanation and a successful set-up after signing in again.

**Second blocker found on the way (backend).** Production ran **API 0.4.2**, the code before 0.5.0 (`fdb62a1~1`; its
source is identical). 0.4.2 authenticates WebSockets only by the `Authorization` header, which browsers can't send. A
browser socket was accepted and then closed with 4401, so the web app could never be "online". My earlier go-live check
mistook that for first-frame sign-in. 0.4.2 also lacked the routes the web uses for synced navigation, workspace photos
and workspace administration.

## 2. Production changes made today (with your approval)

| When (UTC) | Change | Rollback |
|---|---|---|
| 10:23 | Backup `backups/pre-0.5.0-20261019T102306Z` with the deployment's `backup.sh`: integrity ok, schema 14, 31 users, 71 MB | — |
| 10:24 | `server/` replaced with **0.5.0 + `server-patches/0001` + `0002`** (`internal-beta` f92e59a + patches, identical to the server every web test runs against). The old source is kept as `server.pre-0.5.0` and `compose.yaml.pre-0.5.0`; the image is tagged `griip-internal-messaging-api:0.5.0`, and 0.4.2 is kept | Put `image: …:0.4.2` back in `compose.yaml` and run `docker compose -p griip-internal-messaging -f compose.yaml up -d --no-deps api`; restore the backup if needed |
| 10:25 | Only the `api` container recreated (`up -d --no-deps api`); healthy in seconds. LiveKit and ntfy untouched. Migration `015_workspace_prefs.sql` is additive (`orgs.photo_rev` column, `nav_preferences` table) | Additive: 0.4.2 ignores both |
| 10:31 | Web release `0.1.0-fdf4f11` (the sign-in fix) | `rollback.sh` on the VPS |
| next | Web release with this round's features (§3) | `rollback.sh` |

**Verified after the upgrade:**

- **Versions:** `server-info` reports 0.5.0, with `workspace-admin`, `nav-preferences` and `org-photos`.
- **Data:** intact (31 users, 39 devices, 6 workspaces, 17 conversations).
- **Browser WebSocket sign-in:** an unauthenticated socket now waits about 10 s for its auth frame before closing with
  4401. That is the first-frame sign-in at work.
- **Web host:** `verify.sh https://web.meldiq.app` passes, including realtime 101.
- **Phones:** reconnected and working (logins, messages 200, sockets 101, no 5xx). The newer app now uses
  `/v1/me/preferences`, which 0.4.2 didn't have.
- `WEB_ORIGINS` is not set; the same-origin setup doesn't need it.

## 3. Built this round

Each item has the tests named in `MELDIQ_WEB_FEATURE_PARITY.md`.

**Conversations**
- **Edit a channel or group:** rename it, set a channel's topic, and add people from Details. Offered only when the
  server says you manage it.
- **Block or unblock** someone from a direct message's details.
- **Media and files:** a photos-and-videos grid and a file list, decrypted on demand, with SVG and other active types
  offered as downloads only.

**People and workspaces**
- **New message** finds people by exact international phone number (only if they allow it) and by `@name:server` (when
  the server federates).
- **Synced workspace selection:** the browser adopts the account's selection when it opens and saves every switch, as
  the phone does.
- **Branches and teams:** rename them; add members and managers or leads; departments (add, rename, delete, group a
  team).

**Links and emoji**
- **Link warnings:** the phone's `LinkRules.warning`, same checks and wording. A warned link asks before opening.
- **Animated emoji:** the phone's 20 emoji and 5 motions. They show and send, with an on/off switch in Appearance, and
  respect the system's reduced-motion setting.

**Settings**
- **Appearance:** message text size (Small, Default, Large).
- **Storage:** what this browser keeps, and asking the browser to keep it permanently (this device's keys live there).

**Fix**
- The composer empties at once on send. Before, text typed while a message was going out joined it, or was wiped after
  an upload.

## 4. Still open

**Needs a decision or an action outside this repository**
- **S3 CORS rule:** browsers can't upload or download files until it exists. It needs an AWS login (none on this Mac):

  ```bash
  aws s3api put-bucket-cors --bucket griipbuddy-orbit-media-sg --region ap-southeast-1 --cors-configuration '{"CORSRules":[{"AllowedOrigins":["https://web.meldiq.app"],"AllowedMethods":["GET","PUT"],"AllowedHeaders":["range","content-type","x-amz-checksum-sha256","x-amz-server-side-encryption","x-amz-server-side-encryption-aws-kms-key-id"],"MaxAgeSeconds":3000}]}'
  ```

  First check that `get-bucket-cors` returns `NoSuchCORSConfiguration`; `put-bucket-cors` replaces the whole rule.
- **Physical-phone test:** no row is "device"-verified. Real Android ↔ web for messages, files and calls hasn't been
  done.
- **Email texts:** the server still says "Orbit" in its emails (`server/src/accounts/mailer.ts`, a server change).
- **Blocked:** connectors and custom roles (no committed server API), Web Push (needs VAPID on the server) and sending
  link previews (needs a server-side fetcher).
- **Missing:** several accounts per browser, and languages other than English.

**Known intermittent**
- The Chromium "video call from the phone app" browser test sometimes stays at "Verifying encryption…".
  - Today it failed in two runs (both times as the first call test after LiveKit started) and passed in the third, also
    as the first, so "first call" isn't the cause on its own.
  - It passes when repeated, and the other call tests pass in the same runs.
  - No call code changed in this round. Cause not established.

## 5. Tests run (2026-10-19)

All against API 0.5.0 + patches, the build now in production.

| Suite | Result |
|---|---|
| Server suite (`server/`, `npx vitest run`) + typecheck | 409 passed, 10 skipped, 0 failed; typecheck clean |
| Web typecheck, lint, format | clean |
| Web unit + integration (`npx vitest run`, 26 files) | **243 passed** |
| Browser, without the call suite (`npx playwright test`, 4 projects) | **19 passed** (accounts, cross-device, including the two new regression scenarios), 0 failed. The call suite was skipped in that run because the release folder has no native test peer |
| Browser, call suite (`e2e/calls.spec.ts`, server folder with the native peer) | Run 1: 17 passed, 2 skipped (deliberate), 1 failed (the known intermittent above). Run 2, straight after: **18 passed, 2 skipped, 0 failed** |
| Production | `verify.sh` all ✓; server-info 0.5.0; WebSocket first-frame sign-in; phone traffic healthy |
| By hand (local) | Edit channel and topic, Details panel, Storage, Appearance, animated emoji sent and played |

## 6. Where to resume

1. **S3 CORS:** after the rule is applied, send a file from the browser on production and open it on the phone.
2. **Physical-phone test:** `ORBIT_WEB_STATUS.md` §9, now against production.
3. **Call intermittent:** run `e2e/calls.spec.ts` on a cold LiveKit several times, and capture `call-tracks-at-failure.json`
   (it wasn't attached this time: check why the attach step didn't run).
4. **Next parity items:** several accounts per browser; languages; Web Push once the server has VAPID.
