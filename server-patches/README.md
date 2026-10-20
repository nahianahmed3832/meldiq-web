# Server changes Orbit Web needs

Patches for the Orbit server (github.com/nahianahmed3832/griip-mesage, `server/`), made against `internal-beta` at
f92e59a (API 0.5.0). They live here because they can only be merged into the Orbit repository with the owner's
go-ahead. Apply from the Orbit repository's root, in order:

```bash
git am /path/to/meldiq-web/server-patches/0001-server-websocket-first-frame-auth.patch
```

```bash
git am /path/to/meldiq-web/server-patches/0002-server-web-origins.patch
```

| Patch | What | Needed? | Tests |
|---|---|---|---|
| 0001 | WebSocket authentication by first frame (`{"t":"auth","token"}`, `WS_AUTH_TIMEOUT_MS`), on API 0.5.0's async frame pipeline. Header authentication (Android) unchanged. | **Yes**: browsers can't set an `Authorization` header on a WebSocket, so without it nothing arrives live. | `server/test/ws_frame_auth.test.ts` (7) |
| 0002 | `WEB_ORIGINS`: listed browser origins get CORS answers (no credentials) and may open the WebSocket; others' sockets close with 4403; apps without an Origin are unaffected. Off by default. | Optional: same-origin hosting works without it. Recommended for production as WebSocket origin control, and required for a cross-origin `apiBase`. | `server/test/web_origins.test.ts` (3) |

With both applied: the full server suite passes (409 passed, 10 skipped: the live-S3 suite without credentials and a
MongoDB-only case). The tests in this repository find a patched server through `ORBIT_SERVER_DIR`.
