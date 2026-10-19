# Orbit Web: hand-off notes (keep current)

For whoever continues this work after an interruption. Status and evidence: `ORBIT_WEB_STATUS.md`. Feature list:
`ORBIT_WEB_PARITY.md`. Design: `ORBIT_WEB_ARCHITECTURE.md`. Deployment: `ORBIT_WEB_DEPLOYMENT.md`.

## Where things are (2026-10-19)

| What | Where |
|---|---|
| Web client (this repository) | `/Volumes/code_files/orbit_web`, github.com/nahianahmed3832/orbit-web. Commits under the owner's identity, no Claude attribution. Push only when the owner says so. The final test and documentation round is on branch `claude/orbit-web-finish` (worktree `.claude/worktrees/orbit-web-finish`), cut from `main` at 8e09d72. A rebrand to Meldiq was started in the main checkout at the same time (uncommitted there when this was written). |
| Orbit monorepo (server, Android) | `/Volumes/code_files/griip_message` (`internal-beta`, API 0.5.0). Shared with other sessions: **don't edit, stash, switch or merge there**. |
| Server changes for browsers | `server-patches/0001` (first-frame WebSocket auth, required) and `0002` (`WEB_ORIGINS`, optional), made against `internal-beta` f92e59a. Not in the Orbit repository: merging there needs the owner. A patched copy of the server (with `tools/griip-bot` dependencies) used by all tests: `/private/tmp/claude-501/-Volumes-code-files-orbit-web/3039d7bd-69e6-4b7d-be4e-c04986e59fdd/scratchpad/orbit-server/server` (temporary; recreate from the patches if gone). |
| Connectors, custom roles | Being built by another session in `griip_message/.claude/worktrees/orbit-integrations` (uncommitted). The web waits for its committed API. |

## Running the tests

`ORBIT_SERVER_DIR` must point at a server folder with patch 0001 (the monorepo's `internal-beta` lacks it):

```bash
ORBIT_SERVER_DIR=/path/to/server-with-patches npx vitest run
```

```bash
ORBIT_SERVER_DIR=/path/to/server-with-patches npx playwright test
```

Call browser tests need `livekit-server` on PATH and `npm ci` in `tools/griip-bot` next to that server folder.

## Decisions

- Vite + React SPA kept (not Next.js): end-to-end encrypted content can't be server-rendered; keys stay in the browser.
- Orbit 2.0 accounts in the browser: the session's tokens are stored AES-GCM sealed under a non-extractable key in
  IndexedDB (the phone seals them with its Keystore key); renewals are serialised. The recovery key passes through the
  page only when it's made or typed, and isn't kept, so this browser can't approve other devices.
- "Start fresh" (identity reset) stays phone-only: it wipes history for every device.
- Same-origin hosting (nginx proxies `/v1`, `/v2`) is the recommended production setup; the API address is runtime
  configuration (`/config.json`), not baked into the build.
- Files over 25 MB use the phone's chunked format and two passes (hash, then encrypt-and-upload), never held whole.

## Next steps

1. The physical-phone test with the owner (`ORBIT_WEB_STATUS.md` §9, `ORBIT_WEB_CALLS.md` §8).
2. With the owner's go-ahead: merge the server patches into the Orbit repository and deploy (`ORBIT_WEB_DEPLOYMENT.md`).
3. Connectors and custom roles once committed upstream.
4. Gaps listed in `ORBIT_WEB_STATUS.md` §7 (blocking from a profile, channel renaming and members, synced workspace
   selection, departments, Web Push, languages).
