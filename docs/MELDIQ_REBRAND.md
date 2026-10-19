# Meldiq rebrand of the web app (2026-10-19)

The web app (formerly Orbit Web) now presents itself as **Meldiq**. It keeps the same backend and API contracts, the
same accounts and encryption, and works with the Android app (now `com.griipbuddy.meldiq`). This is a controlled
rebrand, not a rebuild: no screen, flow or protocol was replaced.

The rebrand itself touched no production system. Afterwards, with the owner's go-ahead, the site went live on
2026-10-19 at **https://web.meldiq.app** (DNS record, certificate, nginx site; §5), with `web.griipbuddy.cloud`
redirecting there. Docker, MongoDB, the API, OAuth registrations and the Android app were not touched.

## 1. Audit summary (before the changes)

| Area | What it is |
|---|---|
| Framework | Vite 7 + React 19 + TypeScript 5.9 SPA; npm; hash routes (`src/app/router.ts`): `#/home`, `#/dms`, `#/activity`, `#/settings/<page>`, `#/workspace/<page>` |
| Authentication | Email-and-password accounts (`/v2/auth/*`, `src/auth/`), access token in memory, refresh token sealed in IndexedDB; older phone-linked browsers sign in with their device key (`/v1/auth/login`) |
| API | `src/api/client.ts`, base from `/config.json` (`src/app/config.ts`): same origin by default, nginx or Vite proxies `/v1` and `/v2` to the existing API |
| Realtime | One WebSocket `/v1/ws` (first-frame auth), frames `queue`, `typing`, `presence`, `call`, `conv.updated`, `org.updated`, `prefs.updated`, … (`src/realtime/socket.ts`) |
| Features | DMs, groups, channels, workspaces and administration, synced sections, voice messages, files up to 1 GiB (S3 presigned parts), calls and screen share (LiveKit, frame-encrypted), notifications while a tab is open, profile and privacy |
| Connectors / OAuth | **None in this repository or on the committed server.** No OAuth callbacks, redirect URIs or connector settings exist here to change |
| Config | `/config.json` at runtime; `deploy/config/*.json`; development variables `ORBIT_API_URL`, `ORBIT_SERVER_DIR`, `ORBIT_E2E_*` |
| Deployment | Prepared, never applied: `deploy/` (nginx templates, release scripts). No Dockerfile or Compose file for the web app (it's static files on the host nginx). The API's Docker, MongoDB and S3 live in the Orbit repository and production |
| Metadata | `index.html` (title, description, favicon); no manifest or Open Graph before |
| Email templates | **Not in this repository**: the server sends them (`server/src/accounts/mailer.ts`) |

## 2. What changed

| Area | Change |
|---|---|
| Brand in one place | `src/app/brand.ts` (`Meldiq`, `Meldiq Web`, formerly Orbit) |
| Logo | `src/ui/components/BrandMark.tsx` replaces `OrbitMark`; `public/meldiq.svg`; icons `meldiq-180/192/512.png`, maskable 512, share image `meldiq-og.png`, all rendered from the SVG by `scripts/render-brand-assets.ts`. **Provisional mark** in the app's existing tile and gradients: replace the path when the final logo exists, then run the script |
| Visible text | Every sign-in, sign-up, verification, reset and recovery screen; status screens (loading, unsupported, another tab, signed out, config error); rail, top bar, sidebar, settings (about, privacy, notifications, account, devices), call screen, identity review, errors and permission messages, system notifications ("Meldiq" when message text is hidden) |
| Old accounts | Migration screens say "Used Orbit (now Meldiq) before email sign-in?" and "Move your Orbit account to Meldiq": people who knew the old name find the way |
| New browser device names | "Meldiq Web · Chrome on macOS". Browsers set up before keep their stored "Orbit Web · …" name; Devices recognises both |
| Downloaded recovery key | `meldiq-recovery-key.txt`, titled "Meldiq recovery key" |
| Metadata | `<title>Meldiq`, description, `application-name`, Apple title, Open Graph and Twitter card, favicon and touch icon, `manifest.webmanifest` (install name Meldiq, standalone, theme colours, icons) |
| Package | `package.json` name `meldiq-web` and description (the GitHub repository URL is unchanged) |
| Configuration | `MELDIQ_API_BASE_URL`, `MELDIQ_WS_URL`, `MELDIQ_WEB_BASE_URL`, `MELDIQ_ENVIRONMENT` write `/config.json` at install; `MELDIQ_API_UPSTREAM` and `MELDIQ_CONNECT_EXTRA` configure the web host's proxy and CSP (`.env.example`). Earlier names (`ORBIT_API_URL`, `WEB_HOST`, `API_UPSTREAM`, `CONNECT_EXTRA`) still work |
| Deployment files | `deploy/nginx/meldiq-web*.conf.template`, `/opt/meldiq-web`, `meldiq-web.conf`, release tarball `meldiq-web-…` (never installed under the old names, so nothing live moves); `deploy/config/meldiq-production.json` for the future domain |
| Docs | `README.md`, `docs/ORBIT_WEB_DEPLOYMENT.md`, this file |
| Tests | Expectations follow the new visible text; test device names say Meldiq Web |

The design system, layout, colours, fonts, accessibility labels and responsive behaviour are unchanged apart from the
names.

## 3. Kept on purpose (do not rename)

| Identifier | Where | Why it stays |
|---|---|---|
| `orbit-history-v1` (HKDF salt and AAD), `orbit-att-chunk` (file chunk AAD), `orbit-call-verify-v1` (call code HKDF info) | `src/crypto/history.ts`, `src/crypto/attachment.ts`, `src/crypto/fileStream.ts`, `src/call/callKeys.ts` | Cryptographic labels shared byte-for-byte with the Android app and server. Renaming them would make every existing message history, file and call code unreadable or mismatched across devices |
| `griip-envelope-v1`, `griip-device-cert-v1`, `griip-auth-v1`, `griip-pairing-v1`, `griip-legacy-migration-v1` | `src/crypto/` | Protocol strings signed and verified by the server and phones |
| IndexedDB database `orbit-web`, `localStorage` key `orbit.prefs.v1`, Web Lock `orbit-web-device`, stored keys (`calls.log`, `nav.pending`, …) | `src/store/db.ts`, `src/app/prefs.ts`, `src/app/boot.ts` | Every browser already set up keeps its keys, messages and session under these names. Renaming would sign everyone out and lose local history |
| Worker name `orbit-call-e2ee`, message type `orbit.frameAudit`, probe `orbit-web-seed-check` | `src/call/`, `src/crypto/ed25519.ts` | Internal plumbing, never shown; renaming gains nothing and risks the call encryption wrapper |
| `useOrbit`, `src/app/orbit.tsx`, `OrbitDB` type | code identifiers | Internal names in ~60 files; churn without user benefit (a later code-only rename is safe) |
| "Orbit 2.0" (account system version), "Orbit repository", `docs/ORBIT_*.md` file names, `ORBIT_SERVER_DIR`, `ORBIT_E2E_*` | docs, tests, tooling | They name the server repository and its documents, which still carry those names; the test variables are used by CI and other sessions |
| `https://github.com/nahianahmed3832/orbit-web` | `package.json` | The real repository; renaming it is a GitHub decision |
| Server name in server-info (`instanceName`) | API environment | The web app shows the server's `INSTANCE_NAME` if set, else "Meldiq" (§4) |

## 4. Pending outside this repository (needs the owner)

| Item | What | Notes |
|---|---|---|
| Email texts | `server/src/accounts/mailer.ts` still says "Orbit verification code", "Reset your Orbit password", … | A server change (Orbit repository) and an API deploy. `MAIL_FROM` display name likewise |
| `INSTANCE_NAME` | Production API environment | If it's set to "Orbit", the sign-in screen shows "Orbit 0.5.0". Set it to `Meldiq` or leave it empty |
| Android app | Package `com.griipbuddy.meldiq`, names, icons | Not part of this task. A new package id is a new app to Android: installed apps keep the old id until users move |
| Push / deep links / universal links | None used by the web app | The Android app's links (if any) are an Android task |
| OAuth / connectors | None committed (a connectors framework is being built in another session's uncommitted worktree) | Its redirect URIs must be registered for the final web domain when it lands |
| CORS / WebSocket origins | `WEB_ORIGINS` (server patch 0002) | Add `https://web.meldiq.app` when that site goes live; keep the old origin until it's retired |
| S3 CORS | Bucket rule (`ORBIT_WEB_DEPLOYMENT.md` §6) | Add `https://web.meldiq.app` as an allowed origin at cut-over |
| Cookies | None (bearer tokens only) | Nothing to move |

## 5. Domain: web.meldiq.app (live since 2026-10-19)

Done on 2026-10-19: steps 1–4 and 6 (the domain was already registered in Hostinger; `web` A record; Let's Encrypt
certificate; release installed for `web.meldiq.app` with `MELDIQ_REDIRECT_HOSTS=web.griipbuddy.cloud`; `verify.sh`
passed). The production API already had browser WebSocket sign-in, so it wasn't changed, and `WEB_ORIGINS` isn't needed
for the same-origin setup. **Still open: the S3 CORS rule (step 5), without which browsers can't upload or open files,
and the hand checks with a phone in step 6.** The original plan follows.

1. **Buy and verify** `meldiq.app` in Hostinger. `.app` is HSTS-preloaded: it only works over HTTPS, which the site
   needs anyway.
2. **DNS**: an A record `web` → the VPS (72.60.107.88), TTL 300 during the switch. No change to existing records.
3. **TLS**: `certbot certonly --nginx -d web.meldiq.app` on the VPS.
4. **Install the same release for the new host**, beside the current one (the current site stays up):
   `MELDIQ_WEB_BASE_URL=https://web.meldiq.app MELDIQ_ENVIRONMENT=production MELDIQ_API_UPSTREAM=127.0.0.1:18080
   MELDIQ_CONNECT_EXTRA="…" bash install-release.sh`. The API endpoint doesn't change: the new site proxies to the
   same API container (`msg.griipbuddy.cloud` keeps serving the phones).
   _Note: the install script manages one site (`meldiq-web.conf`). To run both hosts at once, render a second site file
   for the second host (a one-line copy of the template with the other `server_name`), or add both names to
   `server_name` with both certificates._
5. **Allow the new origin**: `WEB_ORIGINS=https://web.griipbuddy.cloud,https://web.meldiq.app` (API environment,
   restart only the API service), and the S3 CORS rule.
6. **Verify**: `bash verify.sh https://web.meldiq.app`, then sign in, send a message each way with the phone, upload and
   download a file, place a call. Only then call it live.
7. **Move people over**: link or announce the new address; optionally redirect `web.griipbuddy.cloud` → the new host
   with a 301 once the new one has run cleanly for a while. **Browsers keep their data per origin**: a browser that
   moves to the new address starts signed out and is set up again (sign in, recovery key or phone approval). History
   restores from the encrypted server history. Say so in the announcement.
8. **Retire** the old host later: remove its origin from `WEB_ORIGINS` and the S3 rule, keep the 301.

**Rollback** at any step: remove the new site file and reload nginx; remove the new origin from `WEB_ORIGINS`. The
current site and the API are untouched throughout, so rollback has no downtime. Within a site, `rollback.sh` returns to
the previous release.

**Risks**: people on the new origin must set the browser up again (above); a mistyped `WEB_ORIGINS` closes browser
sockets for that origin (verify step 6 catches it); `.app` without TLS doesn't load at all (step 3 first).

## 6. Infrastructure classification

| Class | Items |
|---|---|
| Safe branding labels, changed | UI text, metadata, icons, manifest, package name, deploy file names (never installed), docs |
| Runtime configuration prepared, not active | `MELDIQ_*` variables, `deploy/config/meldiq-production.json`, `WEB_ORIGINS` value for the new domain, S3 CORS entry |
| Live identifiers needing their own migration | API host `msg.griipbuddy.cloud`, compose project `griip-internal-messaging`, its containers, volumes and network, MongoDB database names, the S3 bucket and IAM roles, SES identities and `MAIL_FROM`, LiveKit host `rtc.griipbuddy.cloud`, Android package id. None were touched; renaming any of them is a separate plan with downtime and rollback per resource |
