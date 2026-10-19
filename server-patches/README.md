# Server changes Orbit Web needs

Patches for the Orbit server (github.com/nahianahmed3832/griip-mesage, `server/`), made against `internal-beta` at
f92e59a (API 0.5.0). They are kept here because they can only be merged into the Orbit repository with the owner's
go-ahead. Apply from the Orbit repository's root:

```bash
git am /path/to/orbit-web/server-patches/0001-server-websocket-first-frame-auth.patch
```

| Patch | What | Tests |
|---|---|---|
| 0001 | WebSocket authentication by first frame for browsers (`{"t":"auth","token"}`, `WS_AUTH_TIMEOUT_MS`), on API 0.5.0's async frame pipeline. Header authentication (Android) unchanged. | `server/test/ws_frame_auth.test.ts` (7); full server suite passes |

Until 0001 is in the server a browser can't open the realtime connection (browsers can't set an `Authorization`
header on a WebSocket). The tests in this repository find a patched server through `ORBIT_SERVER_DIR`.
