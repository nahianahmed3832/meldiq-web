#!/usr/bin/env bash
# Starts a LiveKit media server for development, the browser tests and the phone test (docs/ORBIT_WEB_CALLS.md):
# livekit-server (Homebrew: `brew install livekit`) with a development key that matches `local-server.sh --calls`.
# It listens on all interfaces so a phone on the same Wi-Fi can reach it. The key is for local testing only: never
# use it, or this script, for a server anyone else can reach.
set -euo pipefail
PORT="${LIVEKIT_PORT:-7880}"
KEY="${LIVEKIT_API_KEY:-orbit-dev}"
SECRET="${LIVEKIT_API_SECRET:-orbit-dev-secret-for-local-testing-only-0001}"
API="${ORBIT_API_URL:-http://127.0.0.1:8080}"
CONFIG="port: $PORT
rtc:
  tcp_port: ${LIVEKIT_TCP_PORT:-7881}
  udp_port: ${LIVEKIT_UDP_PORT:-7882}
  use_external_ip: false
webhook:
  api_key: $KEY
  urls: [\"$API/v1/livekit/webhook\"]
logging:
  level: ${LIVEKIT_LOG_LEVEL:-info}"
args=(--keys "$KEY: $SECRET" --config-body "$CONFIG")
# Dev mode (debug logging) unless asked otherwise; the browser tests turn it off to keep their output readable.
[ "${LIVEKIT_DEV:-1}" = "1" ] && args+=(--dev)
# The address offered to browsers and phones for media. Default: LiveKit picks this computer's network address.
# (Not 127.0.0.1: Firefox and Safari don't use loopback candidates.)
[ -n "${LIVEKIT_NODE_IP:-}" ] && args+=(--node-ip "$LIVEKIT_NODE_IP")
exec "${LIVEKIT_SERVER_BIN:-livekit-server}" "${args[@]}"
