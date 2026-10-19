#!/usr/bin/env bash
# Switches Orbit Web back to the release before the current one, ON THE WEB SERVER (as root). The API is untouched.
#   bash rollback.sh            → the previous release
#   bash rollback.sh <release>  → a named one from /opt/orbit-web/releases
set -euo pipefail
base=/opt/orbit-web
current="$(readlink "$base/current")"
if [ -n "${1:-}" ]; then
  target="$base/releases/$1"
else
  target="$(ls -1dt "$base/releases"/* | grep -vx "$current" | head -1)"
fi
[ -d "$target" ] || { echo "No release to roll back to." >&2; exit 1; }
ln -sfn "$target" "$base/current.new" && mv -Tf "$base/current.new" "$base/current"
nginx -t && systemctl reload nginx
echo "Now serving $(basename "$target") (was $(basename "$current"))."
