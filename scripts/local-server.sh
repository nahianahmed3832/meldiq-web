#!/usr/bin/env bash
# Starts an Orbit server for development and the phone test (docs/ORBIT_WEB_STATUS.md): the server/ folder of the Orbit
# repository (github.com/nahianahmed3832/griip-mesage), with its data in that folder's data/ (git-ignored there) and open
# registration. It listens on all interfaces so a phone on the same network can reach it. Never point this at production
# data.
#
# Email accounts (Orbit 2.0): emails go to files in data/mail; `npx tsx scripts/demo-phone.ts mail` shows the codes.
#
# Where the server is: ORBIT_SERVER_DIR, else a clone next to this repository (griip-mesage or griip_message), else ../server.
#
# --calls: calling through a local LiveKit started with scripts/livekit-dev.sh (same development key). Set
# LIVEKIT_PUBLIC_URL to the address phones should use, e.g. ws://192.168.0.5:7880 (default ws://localhost:7880).
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
# Orbit 2.0 accounts: verification and reset emails are written to files instead of sent (development only);
# `npx tsx scripts/demo-phone.ts mail` prints the newest codes.
export APP_ENV="${APP_ENV:-development}" MAIL_TRANSPORT="${MAIL_TRANSPORT:-file}" MAIL_FILE_DIR="${MAIL_FILE_DIR:-${DATA_DIR:-$dir/data}/mail}"
if [ "${1:-}" = "--calls" ] || [ "${ORBIT_CALLS:-0}" = "1" ]; then
  export LIVEKIT_API_KEY="${LIVEKIT_API_KEY:-orbit-dev}"
  export LIVEKIT_API_SECRET="${LIVEKIT_API_SECRET:-orbit-dev-secret-for-local-testing-only-0001}"
  export LIVEKIT_PUBLIC_URL="${LIVEKIT_PUBLIC_URL:-ws://localhost:7880}"
  export LIVEKIT_API_URL="${LIVEKIT_API_URL:-http://127.0.0.1:${LIVEKIT_PORT:-7880}}"
fi
exec npx tsx src/index.ts
