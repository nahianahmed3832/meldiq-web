#!/usr/bin/env bash
# Starts an Orbit server for development and the phone test (docs/ORBIT_WEB_STATUS.md): the server/ folder of the Orbit
# repository (github.com/nahianahmed3832/griip-mesage), with its data in that folder's data/ (git-ignored there), open
# registration and no calling (no LiveKit configured). It listens on all interfaces so a phone on the same network can
# reach it. Never point this at production data.
#
# Where the server is: ORBIT_SERVER_DIR, else a clone next to this repository (griip-mesage or griip_message), else ../server.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
dir="${ORBIT_SERVER_DIR:-}"
if [ -z "$dir" ]; then
  for c in "$here/../griip-mesage/server" "$here/../griip_message/server" "$here/../server"; do
    if [ -f "$c/src/index.ts" ]; then dir="$c"; break; fi
  done
fi
if [ -z "$dir" ] || [ ! -f "$dir/src/index.ts" ]; then
  echo "Orbit server not found: clone github.com/nahianahmed3832/griip-mesage next to this repository and run npm ci in its server/ folder, or set ORBIT_SERVER_DIR." >&2
  exit 1
fi
cd "$dir"
export PORT="${PORT:-8080}" HOST="${HOST:-0.0.0.0}" REGISTRATION_MODE="${REGISTRATION_MODE:-open}" LOG_LEVEL="${LOG_LEVEL:-info}"
exec npx tsx src/index.ts
