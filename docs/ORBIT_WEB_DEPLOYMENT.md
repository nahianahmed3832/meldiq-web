# Deploying Orbit Web

> **Not applied.** Nothing here has been run against production. Each step changes production infrastructure and
> needs the owner's approval first. Status and test evidence: `ORBIT_WEB_STATUS.md`.

Orbit Web is static files (`dist/`, built from this repository) plus the existing API. The browser talks to the API **on its own origin**, so
the API needs no CORS (`ORBIT_WEB_ARCHITECTURE.md` › G2): the web site's nginx serves the files and proxies `/v1` to
the same API container the Android app uses. One backend, one database.

## 1. Prerequisites

| # | What | Why |
|---|---|---|
| 1 | Deploy the server from this branch (0.3.0 + the WebSocket auth frame). | Production runs 0.2.0; browsers can't authenticate its WebSocket (G1). The change is backward compatible: the Android app keeps sending the `Authorization` header. Follow `DEPLOYMENT.md` (backup first: `scripts/backup.sh`). |
| 2 | A host name with TLS for the web app, e.g. `orbit.griipbuddy.cloud`. | WebCrypto only works on HTTPS (or `localhost`). A separate site leaves `msg.griipbuddy.cloud` exactly as it is. |
| 3 | With S3 storage only: a CORS rule on the attachments bucket (§4). | File downloads redirect to presigned S3 URLs; the browser follows them only if the bucket allows the web origin. |

## 2. Build

```bash
npm ci && npm run build
```

Copy `dist/` to the server, e.g. `/opt/orbit-web/dist` (owned by root, read-only to nginx). The build contains no
server addresses, keys or secrets: it always talks to the origin it's served from.

## 3. nginx site (new file, e.g. `/etc/nginx/sites-available/orbit-web.conf`)

```nginx
server {
  listen 443 ssl http2;
  server_name orbit.griipbuddy.cloud;
  # ssl_certificate / ssl_certificate_key: from certbot (certbot --nginx -d orbit.griipbuddy.cloud)

  root /opt/orbit-web/dist;
  index index.html;

  # The same API container the app uses (compose project griip-internal-messaging, API_HOST_PORT).
  location /v1/ {
    proxy_pass http://127.0.0.1:18080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;          # /v1/ws
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;                          # the app pings every 25 s
    client_max_body_size 26m;                         # attachments (25 MiB + envelope)
  }

  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    include /etc/nginx/snippets/orbit-web-headers.conf;
  }

  location / {
    try_files $uri /index.html;
    add_header Cache-Control "no-cache";
    include /etc/nginx/snippets/orbit-web-headers.conf;
  }
}
```

`$connection_upgrade` needs the usual map in `http {}` (`map $http_upgrade $connection_upgrade { default upgrade; '' close; }`).
The API already trusts its local proxy (`TRUST_PROXY=loopback,uniquelocal` in `deploy/compose.yaml`), so per-address
limits see the real client address.

`/etc/nginx/snippets/orbit-web-headers.conf`:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self'; connect-src 'self' wss://orbit.griipbuddy.cloud https://YOUR-BUCKET.s3.YOUR-REGION.amazonaws.com; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" always;
add_header X-Content-Type-Options nosniff always;
add_header Referrer-Policy no-referrer always;
add_header Cross-Origin-Opener-Policy same-origin always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
add_header Strict-Transport-Security "max-age=31536000" always;
```

- `style-src 'unsafe-inline'` is needed for React `style` attributes; scripts stay `'self'` only (no inline scripts in
  the build).
- The S3 entry in `connect-src` is only for S3 storage (presigned downloads); drop it for local storage.
- The CSP is the main defence against injected script, which could use this browser's keys while the page is open.

Then `nginx -t && systemctl reload nginx`.

## 4. S3 bucket CORS (S3 storage only)

Add to the attachments bucket (in `deploy/aws/orbit-storage.yaml` as `CorsConfiguration`, or with
`aws s3api put-bucket-cors`):

```json
{ "CORSRules": [ { "AllowedOrigins": ["https://orbit.griipbuddy.cloud"], "AllowedMethods": ["GET"], "AllowedHeaders": ["range"], "MaxAgeSeconds": 3000 } ] }
```

Uploads from the browser go through the API (`POST /v1/attachments`), not to S3, so no `PUT` rule is needed.

## 5. Check after deploying

1. `https://orbit.griipbuddy.cloud/v1/server-info` returns `version: 0.3.0` (or later).
2. Open the site: the link screen shows a code and a device key (not "This browser can't run Orbit").
3. Link from a phone signed in to `msg.griipbuddy.cloud` (Settings › Devices › Approve new device). The phone's
   account must be on the same server the web site proxies to.
4. Send a message each way; remove the browser from the phone and check it signs out.

## 6. Rolling back

Remove the site (`rm /etc/nginx/sites-enabled/orbit-web.conf && nginx -t && systemctl reload nginx`). The server
change can stay: it only adds an authentication path for clients without the header.
