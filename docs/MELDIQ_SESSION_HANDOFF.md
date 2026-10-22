# Meldiq Web session handoff (2026-10-22, Android parity round B1–B16)

This is the web's handoff. Android's is `meldiq_android/docs/product/MELDIQ_SESSION_HANDOFF.md`. It wasn't edited
from here (that checkout holds the owner's uncommitted work); its B-numbers are used throughout. The behaviour-by-behaviour
status is **`docs/product/MELDIQ_WEB_PARITY_MATRIX.md`**.

## Where things are

- **Branch:** `claude/meldiq-web-android-parity-a6333c` in the meldiq-web worktree
  `orbit_web/.claude/worktrees/meldiq-web-android-parity-a6333c`. Not pushed, no PR, not deployed.
- **Commits, in order:**

| Commit | Batches | What |
|---|---|---|
| `3fc900e` | W1 (B2, B3) | Community channel panel: categories, channel types, permissions, discovery |
| `55b009b` | B3, B4, B4b, B5, B12 | Moderation and community settings |
| `b5e5998` | B4b, B6, B6b, B12 | Connections, message requests, presence, pronouns, group photos, profiles |
| `d2c906d` | B5, B8, B8b | Forums, threads list, Unreads, follow, guide, onboarding, repeating events |
| `912f0db` | B9, B12 | Community emoji and stickers, `:name:` reactions |
| `f1b806c` | B10, B11 | Deafen, noise reduction, pre-call check, screen share modes and sound, listen-only |
| `1b0aaa9` | B14 | Minimal DM/group header, one-row composer, tabbed details, New group with… |
| `80768e6` | B16 | Motion with the shared tokens, off under reduced motion |
| `726841a` | — | Community wording, Android's current intro pages |
| `67de053` | — | Merge of `main` (voice channels have no message box, `df66b32`/`e9f8d2b`) |
| `c141464` | B14 | Voice channel room page; details header, round actions and Android's tab order |

## How it was checked (2026-10-22)

- `vitest` full suite after the merge: **82 files, 481 passed, 21 skipped, 0 failed**. The skipped tests are retired
  modules that skip on community servers. They run against a copy of the server repository's current code (API 0.24.0).
- `eslint`, `tsc -b`, `npm run format:check`: clean.
- Playwright `e2e/calls.spec.ts`, Chromium: **6 of 6 passed**, including deafen. Earlier failures came from editing
  sources while the e2e Vite server served them; don't edit during a run.
- By hand in the in-app browser against the local server (port 8188, web on 5182), at 1024 px and 375 px: sign-in and
  unlock by code, Home with the new wording, the DM header and composer, the details tabs (About, Members, Links), a
  voice channel's note, and Settings › Calls. A local `griip-bot` played the other person in the DM.
- **Not done:** a physical phone, production, Safari, Firefox, a 1 GiB upload over a real network, and running the
  pre-call device check by hand.

## Local test setup

- Server: `.claude/launch.json` › `parity-server` (port 8188, data in the session scratchpad). Web: `parity-web` (5182).
- Test accounts are listed in the session scratchpad only, never in the repository. On a new browser profile the unlock
  code is in the server's mail folder (`DATA_DIR/mail/*.eml`).
- A second person: `cd srv/tools/griip-bot && GRIIP_SERVER=http://127.0.0.1:8188 GRIIP_BOT_ID=local-peer-identity.json
  npm run bot -- chat <username> 600`. **Always set `GRIIP_SERVER`:** the bot defaults to production.

## B14 completion (same day, later)

- A voice channel opens as its room (`VoiceRoomView`): who's in it, Join voice or Open the call, Invite people, the
  listen-only and no-permission notes, and why Join is off. No search, pins or message box. `VoiceRoomBanner` is gone.
- DM and group details follow Android's `DmDetails`: photo and name, round actions Search · Mute/Unmute · Profile (DM)
  or Add (group managers) · Security, New group (DM), tabs (a group opens on Members, a DM on Media), settings below.
  Media, Files, Pins and Links open the message in the chat. The panel moved to `ConversationDetails.tsx`.
- Checked: `voice-room.test.ts`, `details-rules.test.ts`, `muteToggle` in `nav-prefs.test.ts`; e2e `voice-room.spec.ts`
  passed in Chromium and at phone width; by hand at 400 px: Mute and Unmute, Profile, Security, Add, and a group made
  with New group. Afterwards: full suite **84 files, 491 passed, 21 skipped, 0 failed**; `calls.spec.ts` and
  `voice-room.spec.ts` in Chromium **7 of 7 passed**.
- Still not on the web from B14: timeline media sizing and quiet call notes (DM-06).

## Open items

Listed in the matrix's last section. In short: timeline media sizing,
camera choice in a call, and three server items (onboarding broadcast, files domain on MongoDB, Web Push), plus the owner's
device and production checks.

## Notes for the next session

- The desktop app's `sync_with_base_branch` refused because `origin` (now `meldiq-web`) differs from the origin it
  pinned (`griip-mesage`). The owner can re-pin it under Help › Troubleshooting › Review Pinned Git Origins. The merge
  of `main` was done locally, without a fetch.
- Production is on API 0.25.0. The local copy used for tests is 0.24.0, so re-run the live tests on 0.25.0 before a
  deployment.
- Deployment and any production change need the owner's approval.
