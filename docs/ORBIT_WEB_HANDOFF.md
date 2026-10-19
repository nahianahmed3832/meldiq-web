# Orbit Web: hand-off notes (keep current)

For whoever continues this work after an interruption. Status and evidence: `ORBIT_WEB_STATUS.md`. Feature list:
`ORBIT_WEB_PARITY.md`. Design: `ORBIT_WEB_ARCHITECTURE.md`.

## Where things are

| What | Where |
|---|---|
| Web client (this repository) | `/Volumes/code_files/orbit_web`, `main`, github.com/nahianahmed3832/orbit-web. Commits under the owner's identity, no Claude attribution. Push only when the owner says so. |
| Orbit monorepo (server, Android) | `/Volumes/code_files/griip_message` (`internal-beta`, API 0.5.0). Shared with other sessions: **don't edit, stash, switch or merge there**. |
| Server change for browsers (first-frame WebSocket auth) | Old: branch `orbit-web` (694af71, on API 0.3) in worktree `/Volumes/code_files/griip-mesage`. Current: re-applied on API 0.5.0 as one commit in a scratch copy of the server; exported as `server-patches/*.patch` in this repository. Not in the Orbit repository yet (merging there needs the owner). |
| Browser calls (first version) | Commit `c9b7fb0` on `claude/strange-mclaren-5d8fdb` in the monorepo's `web/`; ported here. |
| Connectors, custom roles | Being built by another session in `griip_message/.claude/worktrees/orbit-integrations` (uncommitted). Web waits for it. |

## Running the tests against API 0.5.0

`ORBIT_SERVER_DIR` must point at a server with the first-frame patch (the monorepo's `internal-beta` lacks it):

```bash
ORBIT_SERVER_DIR=/path/to/server-with-patch/server npm run test:all
```

## Decisions

- Vite + React SPA kept (not Next.js): E2EE content can't be server-rendered; keys stay in the browser.
- Orbit 2.0 accounts in the browser: refresh token stored sealed by a non-extractable AES key in IndexedDB (like the
  WebKit X25519 fallback); access token in memory only. The recovery key is typed into the page and never sent.
- "Start fresh" (identity reset) stays phone-only: it wipes history for every device.
- The server URL is runtime configuration (`/config.json`), not baked into the build.
