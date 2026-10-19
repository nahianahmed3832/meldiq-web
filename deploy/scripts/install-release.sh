#!/usr/bin/env bash
# Installs an Orbit Web release ON THE WEB SERVER (as root), next to the existing Orbit API. Run from the unpacked
# release folder. It touches only /opt/orbit-web, its nginx site and snippet; nothing of the API or other sites.
#
#   WEB_HOST=web.griipbuddy.cloud API_UPSTREAM=127.0.0.1:18080 \
#   CONNECT_EXTRA="https://rtc.griipbuddy.cloud wss://rtc.griipbuddy.cloud https://BUCKET.s3.ap-southeast-1.amazonaws.com" \
#   CONFIG=config/production.json bash install-release.sh
#
# Steps: copy the files to /opt/orbit-web/releases/<version>-<commit>, write its config.json, render the nginx site,
# check nginx, switch /opt/orbit-web/current to the new release, reload nginx. The previous release stays for rollback
# (rollback.sh); the newest 5 are kept. The TLS certificate must exist first (certbot certonly --nginx -d $WEB_HOST).
set -euo pipefail
: "${WEB_HOST:?set WEB_HOST, e.g. web.griipbuddy.cloud}"
: "${API_UPSTREAM:=127.0.0.1:18080}"
: "${CONNECT_EXTRA:=}"
: "${CONFIG:=config/production.json}"
here="$(cd "$(dirname "$0")" && pwd)"
base=/opt/orbit-web
release="$(tr '\n' '-' < "$here/RELEASE" | sed 's/-$//')"
target="$base/releases/$release"

[ "$(id -u)" = 0 ] || { echo "Run as root." >&2; exit 1; }
[ -f "$here/dist/index.html" ] || { echo "No dist/index.html next to this script: run it from an unpacked release." >&2; exit 1; }
[ -f "/etc/letsencrypt/live/$WEB_HOST/fullchain.pem" ] || { echo "No TLS certificate for $WEB_HOST yet: certbot certonly --nginx -d $WEB_HOST" >&2; exit 1; }
node -e "JSON.parse(require('fs').readFileSync('$here/$CONFIG','utf8'))" 2>/dev/null || python3 -c "import json,sys; json.load(open('$here/$CONFIG'))"

mkdir -p "$base/releases"
rm -rf "$target"
cp -R "$here/dist" "$target"
cp "$here/$CONFIG" "$target/config.json"
chown -R root:root "$target"
find "$target" -type d -exec chmod 755 {} + && find "$target" -type f -exec chmod 644 {} +

export WEB_HOST API_UPSTREAM CONNECT_EXTRA WEB_ROOT="$base/current"
vars='${WEB_HOST} ${API_UPSTREAM} ${WEB_ROOT} ${CONNECT_EXTRA}'
mkdir -p /etc/nginx/snippets
envsubst "$vars" < "$here/nginx/orbit-web-headers.conf.template" > /etc/nginx/snippets/orbit-web-headers.conf
envsubst "$vars" < "$here/nginx/orbit-web.conf.template" > /etc/nginx/sites-available/orbit-web.conf
ln -sfn /etc/nginx/sites-available/orbit-web.conf /etc/nginx/sites-enabled/orbit-web.conf
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
