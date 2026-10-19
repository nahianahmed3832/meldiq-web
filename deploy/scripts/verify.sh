#!/usr/bin/env bash
# Checks a deployed Orbit Web from anywhere: DNS, TLS, the app, its config, security headers, the API through the same
# origin, and the realtime upgrade. Read-only; signs in to nothing.
#   bash verify.sh https://web.griipbuddy.cloud
set -uo pipefail
url="${1:?usage: verify.sh https://web.example.com}"
host="${url#https://}"; host="${host%%/*}"
fail=0
ok() { printf '  ✓ %s\n' "$1"; }
bad() { printf '  ✗ %s\n' "$1"; fail=1; }

echo "Orbit Web at $url"
ip="$(dig +short "$host" | tail -1)"; [ -n "$ip" ] && ok "DNS: $host → $ip" || bad "DNS: $host doesn't resolve"
exp="$(echo | openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
[ -n "$exp" ] && ok "TLS certificate valid until $exp" || bad "TLS: no valid certificate"
headers="$(curl -fsSI "$url/")" && ok "the app answers" || bad "the app doesn't answer"
for h in content-security-policy strict-transport-security x-content-type-options permissions-policy; do
  echo "$headers" | grep -qi "^$h:" && ok "header $h" || bad "missing header $h"
done
curl -fsS "$url/index.html" | grep -q '<div id="root">' && ok "index.html is the Orbit app" || bad "index.html isn't the app"
cfg="$(curl -fsS "$url/config.json")" && echo "$cfg" | grep -q '"environment"' && ok "config.json: $(echo "$cfg" | tr -d '\n ' | cut -c1-120)" || bad "config.json missing or unreadable"
curl -fsSI "$url/config.json" | grep -qi 'cache-control: no-store' && ok "config.json isn't cached" || bad "config.json may be cached"
info="$(curl -fsS "$url/v1/server-info")" && ok "API through this origin: $(echo "$info" | grep -o '"version":"[^"]*"')" || bad "API not reachable through $url/v1"
echo "$info" | grep -q '"accounts-v2"\|"accounts":' && ok "server has Orbit 2.0 accounts" || bad "server is older than Orbit 2.0 accounts"
code="$(curl -s -o /dev/null -w '%{http_code}' --http1.1 -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' --max-time 3 "$url/v1/ws")"
[ "$code" = 101 ] && ok "realtime upgrade (101)" || bad "realtime upgrade answered $code, not 101"
[ "$fail" = 0 ] && echo "All checks passed." || echo "Some checks failed."
exit "$fail"
