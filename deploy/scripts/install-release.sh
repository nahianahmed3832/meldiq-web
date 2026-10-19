#!/usr/bin/env bash
# Installs a Meldiq Web release ON THE WEB SERVER (as root), next to the existing API. Run from the unpacked release
# folder. It touches only /opt/meldiq-web, its nginx site and snippet; nothing of the API or other sites.
#
#   MELDIQ_WEB_BASE_URL=https://web.griipbuddy.cloud MELDIQ_ENVIRONMENT=production MELDIQ_API_UPSTREAM=127.0.0.1:18080 \
#   MELDIQ_CONNECT_EXTRA="https://rtc.griipbuddy.cloud wss://rtc.griipbuddy.cloud https://BUCKET.s3.ap-southeast-1.amazonaws.com" \
#   bash install-release.sh
#
# /config.json is written from MELDIQ_API_BASE_URL (empty: same origin), MELDIQ_WS_URL, MELDIQ_WEB_BASE_URL and
# MELDIQ_ENVIRONMENT, or copied from CONFIG=config/<file>.json. The earlier names WEB_HOST, API_UPSTREAM, CONNECT_EXTRA
# still work.
#
# Steps: copy the files to /opt/meldiq-web/releases/<version>-<commit>, write its config.json, render the nginx site,
# check nginx, switch /opt/meldiq-web/current to the new release, reload nginx. The previous release stays for rollback
# (rollback.sh); the newest 5 are kept. The TLS certificate must exist first (certbot certonly --nginx -d $WEB_HOST).
set -euo pipefail
: "${WEB_HOST:=${MELDIQ_WEB_BASE_URL#https://}}"
WEB_HOST="${WEB_HOST%%/*}"
[ -n "$WEB_HOST" ] || { echo "Set MELDIQ_WEB_BASE_URL (or WEB_HOST), e.g. https://web.griipbuddy.cloud" >&2; exit 1; }
: "${API_UPSTREAM:=${MELDIQ_API_UPSTREAM:-127.0.0.1:18080}}"
API_UPSTREAM="${API_UPSTREAM#http://}"
: "${CONNECT_EXTRA:=${MELDIQ_CONNECT_EXTRA:-}}"
: "${CONFIG:=}"
here="$(cd "$(dirname "$0")" && pwd)"
base=/opt/meldiq-web
release="$(tr '\n' '-' < "$here/RELEASE" | sed 's/-$//')"
target="$base/releases/$release"

[ "$(id -u)" = 0 ] || { echo "Run as root." >&2; exit 1; }
[ -f "$here/dist/index.html" ] || { echo "No dist/index.html next to this script: run it from an unpacked release." >&2; exit 1; }
[ -f "/etc/letsencrypt/live/$WEB_HOST/fullchain.pem" ] || { echo "No TLS certificate for $WEB_HOST yet: certbot certonly --nginx -d $WEB_HOST" >&2; exit 1; }
# The browser's /config.json: public values only. Checked here as the app checks it (https, no paths).
config_json() {
  python3 - "$@" <<'PY'
import json, os, re, sys
api = os.environ.get("MELDIQ_API_BASE_URL", "").strip().rstrip("/")
ws = os.environ.get("MELDIQ_WS_URL", "").strip() or None
web = os.environ.get("MELDIQ_WEB_BASE_URL", "").strip() or None
env = os.environ.get("MELDIQ_ENVIRONMENT", "production").strip()
if api and not re.fullmatch(r"https://[a-z0-9.-]+(:\d+)?", api): sys.exit("MELDIQ_API_BASE_URL must be empty or an https origin without a path")
if ws and not ws.startswith("wss://"): sys.exit("MELDIQ_WS_URL must be a wss:// URL")
if env not in ("development", "staging", "production"): sys.exit("MELDIQ_ENVIRONMENT must be development, staging or production")
print(json.dumps({"apiBase": api, "wsUrl": ws, "publicUrl": web, "environment": env}, indent=2))
PY
}

mkdir -p "$base/releases"
rm -rf "$target"
cp -R "$here/dist" "$target"
if [ -n "$CONFIG" ]; then
  python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$here/$CONFIG"
  cp "$here/$CONFIG" "$target/config.json"
else
  config_json > "$target/config.json"
fi
chown -R root:root "$target"
find "$target" -type d -exec chmod 755 {} + && find "$target" -type f -exec chmod 644 {} +

export WEB_HOST API_UPSTREAM CONNECT_EXTRA WEB_ROOT="$base/current"
vars='${WEB_HOST} ${API_UPSTREAM} ${WEB_ROOT} ${CONNECT_EXTRA}'
mkdir -p /etc/nginx/snippets
envsubst "$vars" < "$here/nginx/meldiq-web-headers.conf.template" > /etc/nginx/snippets/meldiq-web-headers.conf
envsubst "$vars" < "$here/nginx/meldiq-web.conf.template" > /etc/nginx/sites-available/meldiq-web.conf
ln -sfn /etc/nginx/sites-available/meldiq-web.conf /etc/nginx/sites-enabled/meldiq-web.conf
grep -q 'connection_upgrade' -r /etc/nginx/nginx.conf /etc/nginx/conf.d /etc/nginx/sites-enabled 2>/dev/null \
  || { echo "nginx needs: map \$http_upgrade \$connection_upgrade { default upgrade; '' close; } in http {}" >&2; exit 1; }

previous="$(readlink "$base/current" 2>/dev/null || true)"
ln -sfn "$target" "$base/current.new" && mv -Tf "$base/current.new" "$base/current"
if ! nginx -t; then
  [ -n "$previous" ] && ln -sfn "$previous" "$base/current"
  echo "nginx refused the configuration; the previous release is still current." >&2
  exit 1
fi
systemctl reload nginx
ls -1dt "$base/releases"/* | tail -n +6 | xargs -r rm -rf
echo "Installed $release (previous: ${previous:-none}). Check it: bash verify.sh https://$WEB_HOST"
