# Deploying Meldiq Web (formerly Orbit Web)

> **Live since 2026-10-19 at https://web.meldiq.app.** `web.griipbuddy.cloud` (live for an hour before that) now
> redirects there permanently (`MELDIQ_REDIRECT_HOSTS`, §4). Examples below that name `web.griipbuddy.cloud` describe
> the original setup; use `web.meldiq.app` (`MELDIQ_REBRAND.md` › Domain). File and folder names use `meldiq-web`; nothing was ever
> installed under the old names.
>
> **Not applied.** Nothing here has been run against production, DNS or AWS. Every step below changes production
> infrastructure and needs the owner's go-ahead. Status and evidence: `ORBIT_WEB_STATUS.md`.

Meldiq Web is static files plus the existing Orbit API. The recommended setup serves the app at
**https://web.griipbuddy.cloud** from the same VPS and nginx that already serve `msg.griipbuddy.cloud`, and proxies
`/v1` and `/v2` from the web host to the same API container. The browser then talks to its own origin: no CORS, no
cookies, one backend and one database for the phone and the browser. The domain is configuration (§3), not code.

```
browser ──https──▶ web.griipbuddy.cloud (nginx on the VPS)
                    ├─ /            static app        /opt/meldiq-web/current  (a release, §4)
                    ├─ /config.json runtime config    written per server at install
                    └─ /v1 /v2      proxy ──▶ 127.0.0.1:18080  (the API container the Android app uses)
phone app ──https──▶ msg.griipbuddy.cloud (unchanged)
calls ──wss──▶ rtc.griipbuddy.cloud (LiveKit, unchanged)        files ──https──▶ S3 (presigned, §6)
```

## 1. What production needs first (owner's decisions)

| # | Change | Why | Where |
|---|---|---|---|
| 1 | Deploy the API with `server-patches/0001` (first-frame WebSocket auth). | Browsers can't set an `Authorization` header on a WebSocket; without it the browser can't receive anything live. Backward compatible: the phone keeps sending the header. | Orbit repository, `docs/DEPLOYMENT.md` (back up first: `scripts/backup.sh`) |
| 2 | API 0.5.0 or later (Orbit 2.0 accounts, workspace administration, preferences) in production. | Production ran 0.4.x; the web app signs in with email accounts (`/v2`). | Same |
| 3 | Email for accounts (`MAIL_TRANSPORT=ses`, SES out of the sandbox). | Sign-up, verification and password reset send codes. Without it, existing verified accounts can still sign in. | `docs/ORBIT_SES_SETUP_2026-10-18.md` |
| 4 | DNS: **A record `web` → 72.60.107.88** in the Hostinger zone for `griipbuddy.cloud`. | The new host name. | Hostinger DNS |
| 5 | TLS: `certbot certonly --nginx -d web.griipbuddy.cloud` on the VPS. | WebCrypto only runs on HTTPS. Renewal is certbot's existing timer. | VPS |
| 6 | 1 GB files: `FILE_MAX_BYTES` (default 1 GiB) and the quotas in `deploy/.env.example`; with S3, the bucket CORS rule (§6). | Production ran `ATTACHMENT_MAX_BYTES=25 MB`. Raising it is a cost decision (`ORBIT_2_ARCHITECTURE` §7). | API `.env` |
| 7 | Optional: `WEB_ORIGINS=https://web.griipbuddy.cloud` (`server-patches/0002`). | Same-origin works without it. With it, the API also refuses browser WebSockets from any other site, and a cross-origin setup (§3) becomes possible. | API `.env` |

## 2. Build a release (workstation)

```bash
bash deploy/scripts/build-release.sh
```

It refuses a dirty working tree, then runs `npm ci`, typecheck, lint, the unit tests and the production build, and
writes `release/meldiq-web-<version>-<commit>.tar.gz` with a `.sha256`. The tarball holds `dist/`, the nginx templates,
the config files and the install, rollback and verify scripts. The build contains **no server address, key or secret**.

## 3. Configuration (per server, not per build)

`/config.json` is read when the page loads (`src/application/config.ts`):

| Field | Production value | Meaning |
|---|---|---|
| `apiBase` | `""` | Same origin (recommended). Or the API's https origin, e.g. `https://msg.griipbuddy.cloud`: then the API must list this site in `WEB_ORIGINS` (`server-patches/0002`), and CSP `connect-src` must include it. |
| `wsUrl` | `null` | Derived: `wss://<page host>/v1/ws`, or from `apiBase`. |
| `publicUrl` | `https://web.griipbuddy.cloud` | Shown in diagnostics. |
| `environment` | `production` | `development`, `staging` or `production`. |

`deploy/config/production.json` is the recommended file; `deploy/config/example-cross-origin.json` shows the
cross-origin variant. **Moving to another domain**: a DNS record, a certificate, `WEB_HOST` at install (§4) and, if
`WEB_ORIGINS` is set, its new value. No rebuild.

A malformed `config.json` (e.g. an `http://` API) stops the app with "Meldiq Web isn't set up correctly" rather than
talking to the wrong server.

## 4. Install on the VPS

Copy the tarball to the VPS, check it, unpack, and install as root (it touches only `/opt/meldiq-web`, its nginx site
`meldiq-web.conf` and the snippet `meldiq-web-headers.conf`; never the API, its compose project or other sites):

```bash
scp release/meldiq-web-*.tar.gz* root@72.60.107.88:/root/
```

```bash
ssh root@72.60.107.88
```

```bash
cd /root && shasum -a 256 -c meldiq-web-*.tar.gz.sha256 && tar xzf meldiq-web-*.tar.gz && cd meldiq-web-*/
```

```bash
MELDIQ_WEB_BASE_URL=https://web.griipbuddy.cloud MELDIQ_ENVIRONMENT=production MELDIQ_API_UPSTREAM=127.0.0.1:18080 MELDIQ_CONNECT_EXTRA="https://rtc.griipbuddy.cloud wss://rtc.griipbuddy.cloud https://BUCKET.s3.ap-southeast-1.amazonaws.com" bash install-release.sh
```

`/config.json` is written from the `MELDIQ_*` values (`.env.example`); `CONFIG=config/<file>.json` copies a file
instead. The earlier names `WEB_HOST`, `API_UPSTREAM` and `CONNECT_EXTRA` still work. `MELDIQ_REDIRECT_HOSTS="old.host …"`
adds a permanent redirect from each former address to the current one (each needs its own certificate).

The command that installed the current production release:

```bash
MELDIQ_WEB_BASE_URL=https://web.meldiq.app MELDIQ_ENVIRONMENT=production MELDIQ_API_UPSTREAM=127.0.0.1:18080 MELDIQ_REDIRECT_HOSTS=web.griipbuddy.cloud MELDIQ_CONNECT_EXTRA="https://rtc.griipbuddy.cloud wss://rtc.griipbuddy.cloud https://griipbuddy-orbit-media-sg.s3.ap-southeast-1.amazonaws.com" bash install-release.sh
```

`install-release.sh` copies the release to `/opt/meldiq-web/releases/<version>-<commit>`, writes its `config.json`,
renders the nginx site and header snippet from the templates, switches `/opt/meldiq-web/current`, runs `nginx -t`
(switching back if nginx refuses) and reloads nginx. The newest five releases are kept.

The site brings its own WebSocket upgrade map (`$meldiq_web_connection_upgrade`), so nothing else in nginx is needed.
If `nginx -t` refuses the new files, the script puts back the previous release and the previous nginx files (or removes
the new site on a first install), so a refused install never blocks other sites' reloads.

### What the nginx site does (`deploy/nginx/meldiq-web.conf.template`)

- HTTP → HTTPS; TLS 1.2/1.3 with the certbot certificate.
- `/v1/ws`: upgraded, 120 s read timeout (the app pings every 25 s).
- `/v1/`, `/v2/`: to the API; bodies up to 1100 MB stream **unbuffered** (`proxy_request_buffering off`), one-hour
  timeouts for slow uploads. The API already trusts its local proxy (`TRUST_PROXY`), so per-address limits see the
  real client.
- `/media/attachments/<id>` (`deploy/nginx/meldiq-web-media.conf.template`, rendered to
  `/etc/nginx/snippets/meldiq-web-media.conf`): for a bucket without a CORS rule (§6). It asks the API with the person's
  token; when the API answers with a link to the bucket, nginx follows it itself, only to `MELDIQ_MEDIA_ORIGIN` (default:
  the `amazonaws.com` entry of `MELDIQ_CONNECT_EXTRA`) and without the token or cookies, keeping `Range`. Any other
  host gets 502; the API's own errors pass through; GET only.
- `/config.json`: `no-store`. `/assets/`: content-hashed, cached a year. Everything else falls back to `index.html`.
- Its own access and error logs (`/var/log/nginx/meldiq-web.*.log`).

### Headers (`deploy/nginx/meldiq-web-headers.conf.template`)

`Content-Security-Policy`: `default-src 'self'`; scripts only from the site (the build has no inline scripts);
`worker-src 'self' blob:` (the call-encryption worker); `style-src 'self' 'unsafe-inline'` (React style attributes);
`img-src`/`media-src` `blob:` (decrypted photos, voice and video); `connect-src 'self' wss://<host>` plus
`CONNECT_EXTRA`: LiveKit signalling (`rtc.griipbuddy.cloud`, https and wss) and the S3 bucket (presigned uploads and
downloads); `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`.
Also HSTS, `nosniff`, `Referrer-Policy: no-referrer`, COOP and CORP `same-origin`, and `Permissions-Policy` allowing
camera, microphone, screen capture and location for this site only (the browser still asks the person).

The CSP is the main defence against injected script, which could use this browser's keys while the page is open
(`ORBIT_WEB_STATUS.md` › Security).

## 5. Check

```bash
bash deploy/scripts/verify.sh https://web.griipbuddy.cloud
```

Read-only: DNS, certificate expiry, the app and its headers, `config.json` (and that it isn't cached), the API through
the web origin (`/v1/server-info`, Orbit 2.0 accounts present), and the realtime upgrade (`101`). Then by hand:

1. Open the site: the sign-in screen names the server and its version.
2. Sign in with an existing account; set up the browser with the recovery key or by approving it on the phone.
3. Send a message each way with the phone; edit, react, delete; a file both ways; star a channel on one device and see
   it on the other.
4. Calls only after the physical-phone test (`ORBIT_WEB_CALLS.md` §8) has passed.

## 6. S3 (file storage)

With S3 storage, files over the single-upload size go **from the browser straight to S3** (presigned PUTs, 16 MiB
parts, each bound to its size and SHA-256), and downloads redirect to presigned GETs. For that, the bucket needs a CORS
rule for the web origin (add it to `deploy/aws/orbit-storage.yaml` as `CorsConfiguration`, or `aws s3api
put-bucket-cors`).

**Without the rule the web still works** (since 2026-10-20): a refused download is fetched again through the web
server's `/media/attachments/` (§4), and a refused upload is removed and sent through the API instead. Each tab
remembers it and goes that way at once for later files. Phones are unaffected (CORS is a browser rule). The rule is
still worth adding: it keeps browsers' file traffic off the web server.

The rule (the production bucket had none on 2026-10-20: S3 answered "CORS is not enabled for this bucket"):

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://web.meldiq.app"],
      "AllowedMethods": ["GET", "PUT"],
      "AllowedHeaders": ["range", "content-type", "if-none-match", "x-amz-checksum-sha256", "x-amz-server-side-encryption", "x-amz-server-side-encryption-aws-kms-key-id"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

These are the headers the server signs into its upload URLs (`server/src/storage/s3.ts`; `if-none-match` was missing
from this list before 2026-10-20, which would have kept single uploads refused); the browser adds
`content-length` itself from the body, which is the signed size. No `ExposeHeaders` is needed: the browser reads part
ETags through the API (`GET /v1/attachments/uploads/:id/parts`).
Without S3 (local disk), files stream through the API instead, and nothing here is needed.

## 7. Roll back

The previous release (the API isn't touched):

```bash
bash /root/meldiq-web-*/rollback.sh
```

Remove the site entirely:

```bash
rm /etc/nginx/sites-enabled/meldiq-web.conf && nginx -t && systemctl reload nginx
```

The server patches can stay: 0001 only adds an authentication path for clients without the header; 0002 does nothing
until `WEB_ORIGINS` is set.

## 8. Environments

| | Development | Staging (not created) | Production |
|---|---|---|---|
| App | `npm run dev` at http://localhost:5173 | a second site, e.g. `staging-web.griipbuddy.cloud`, same scripts | `web.griipbuddy.cloud` |
| API | `bash scripts/local-server.sh` (local data, emails to files) | the staging compose project (`ORBIT_2_ARCHITECTURE` §9, needs the owner) | `msg.griipbuddy.cloud` container via the proxy |
| config.json | none (same origin through Vite's proxy) | `environment: "staging"` | `deploy/config/production.json` |
| Email | `MAIL_TRANSPORT=file` | SES sandbox | SES |

## 9. Logs, health and restarts

- The app is static: nginx serves it; there is no web process to restart. `systemctl reload nginx` after changes.
- API health stays `scripts/verify.sh` in the Orbit repository; the web site's own check is §5.
- Logs: `/var/log/nginx/meldiq-web.access.log` and `.error.log` (no request bodies; tokens travel in headers nginx
  doesn't log by default). The app sends no analytics or telemetry.
