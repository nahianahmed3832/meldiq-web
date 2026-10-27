# Meldiq community-first, version 2 (Meldling): implementation report (2026-10-27)

The brief: [`MELDIQ_COMMUNITY_FIRST_BRIEF_V2.md`](MELDIQ_COMMUNITY_FIRST_BRIEF_V2.md). Version 1's work (presence,
reactions, unread, notifications, call badges, Add members, the rail) is live since 2026-10-26 and described in
[`MELDIQ_COMMUNITY_FIRST_REPORT.md`](MELDIQ_COMMUNITY_FIRST_REPORT.md); this round builds on it.

## Where the work is

| Repository | Branch | Base (what production runs) |
|---|---|---|
| meldiq-web (`/Volumes/code_files/meldiq_web`) | `meldling` | `origin/ai-workforce-web` b653a6b (web 0.5.0-beta-9e42f38) |
| meldiq (`meldiq_android/.claude/worktrees/meldling-api`) | `meldling-api`, API **0.43.0** | `origin/internal-beta` 59c7916 (API 0.42.0) |

## Shipped

1. **Meldling, the canonical mascot.** The owner's two-colour asset (`brand/meldling.png`, unchanged) is now every brand
   surface: favicon (the unread badge is painted on it), PWA, Apple and maskable icons, the notification icon and badge,
   the rail's Home and messages button, the phone tab bar, sign-in, linking and status screens, the launch screen (a
   still on its own teal that breathes only where motion is welcome; the old ribbon video is gone), the public invitation
   page and the share image. `scripts/render-brand-assets.mjs` crops and scales; nothing is redrawn. The product is still
   Meldiq. The ribbon "M" survives only as `brand/reference/meldiq-logo-ribbon.webp`.
2. **Meldling typing indicator.** One indicator however many people type: Meldling and "Meldling…" with an ellipsis that
   fades (no movement, so the list never shifts; still under reduced motion). Screen readers and the tooltip get the real
   names ("Ana and Bo are typing"). Conversation rows show the same. It comes and goes with the existing realtime typing
   signals and their expiry.
3. **Discover page** (`/discover`, the rail's round Discover): beside Home and messages, a search as you type and a grid
   of cards with each public community's icon, description, member count and one action (Open, Join, or View to apply
   or read that it's invite-only). Only the server's data: there's no promotion system, so nothing is marked promoted.
4. **Invite people.** The community menu's Invite people (and the People page's Add members) is one dialog: find and
   add people you know, or make an invitation link with an explicit expiry (1 hour to 30 days) and use limit (1 to 500),
   then Copy link, Copy code or Share. "Manage invitations" keeps the full page with revocation.
5. **Import from Discord** (Create › Import from Discord; meldiq `docs/DISCORD_IMPORT.md`). Explains what comes over
   (icon, roles and optionally their permissions, categories, text/announcement/voice/forum channels, emoji) and what
   never does (messages, members, DMs, bots…). Connect Discord uses Discord's own bot authorization (View Channels only);
   the server confirms the person owns the server or has Manage Server, then revokes their Discord token: Meldiq stores
   none. A preview lists every item and why anything is left out; Import is explicit; progress is item by item; Retry
   continues without duplicating anything; at the end, an invitation link for the members and Open the community.
   Channels hidden from @everyone become private. Administrator is never copied. **Off in production until a Discord
   application exists** (see Production): the app says so plainly and offers nothing that would fail.
6. **Channel read state across browsers.** Reading a channel now clears it in the person's other browsers too, through an
   end-to-end-encrypted "read up to here" sent to their own devices only (API 0.43.0, `audience: "self"`): the server
   never learns what was read. A browser clears it only if nothing newer arrived. Meldiq Android already handles that
   control (it clears the channel on the phone); the phone doesn't send it yet, so reading on the phone doesn't clear the
   web.

## Verification

| Check | Result |
|---|---|
| Server `tsc --noEmit` | clean |
| Server `vitest run` (full) | **1099 passed**, 11 skipped, 0 failed (127 files); new: `discord_import` (13: not configured, state checks, no Manage Server, no bot, token revoked, preview, full import, permissions never Administrator, retry without duplicates, a 429 honoured, refused destinations, role re-checked on retry, disconnect), `discord_mapping` (8), `self_only_controls` (3) |
| Server architecture boundaries, contracts, Mongo catalogue | pass (new tables owned by organizations; OAuth states excluded from MongoDB copies) |
| Web `tsc -b`, `eslint .`, `prettier --check` | clean |
| Web unit tests | 513 passed, 1 skipped (77 files) against API 0.43.0's contracts; new: `typing-indicator`, `discord-import`, a partial read-elsewhere case |
| Web browser tests (new `meldling.spec.ts`) | 5 of 5: Meldling icons and typing (with the screen-reader names), Discover search and Join, an invitation link with expiry and limit, Discord "not set up", **a channel read in one browser clearing in the person's second browser** |
| Full browser suite, Chromium + phone width (local API 0.43.0, LiveKit) | 124 run: **61 passed, 1 failed, 62 skipped** (desktop-only or phone-only tests skip in the other project). The failure, `viewports.spec` at phone width ("composer not found"), passed 4 of 4 alone and 3 of 3 again with Discover added to its screens. It's the intermittent one of version 1's report; screenshots show why (below) |

Not tested: Discord against the real Discord (no Discord application exists yet; the server's tests use a local
stand-in for Discord's API), Firefox and WebKit, a physical phone.

### A pre-existing intermittent issue found while checking

`viewports.spec` reloads the app about 50 times in one test. Late in the run, the page sometimes shows "Reconnecting…"
and an "Authentication required" notice, and then a conversation's composer can be missing, which is what fails the test
now and then. The **production code before this round (b653a6b) shows the same** against the same server, so this round
didn't cause it. Not investigated further here: it needs its own look at how a browser's session is re-established
after many quick reloads (real use rarely reloads like that).

## Production

**Live since 2026-10-27 00:19 UTC: API 0.43.0 and Meldiq Web 0.5.0-beta-73bbdda.**

| Step | Result |
|---|---|
| Pre-flight | API 0.42.0 healthy; VPS `server/` byte-equal to `internal-beta` 59c7916 (`rsync -c` dry run; only a stray `.DS_Store` differs); live web 9e42f38; 48 GB free; no `DISCORD_*` settings |
| Backup | `backups/pre-0.43.0-20261027T000517Z`: integrity ok, schema 55, 43 users, `.env` and `compose.yaml` copies; image tagged `0.42.0-rollback`; sources kept as `server.pre-0.43.0` |
| Build | the 19 files of this release synced (the dry run listed exactly them) and `validate-env.sh`; `docker build -t griip-internal-messaging-api:0.43.0 server` (`build-0.43.0.log`, done; the SSH session dropped during the build, which `nohup` survived) |
| Rehearsal | a copy of the backup, `--network none`, env without FCM lines: healthy, `/healthz` 0.43.0, **migration 056 applied (schema 56)**, integrity ok, 43 users, the four `discord_*` tables, 0 errors; removed after |
| Switch | `compose.yaml` image 0.43.0, `validate-env.sh` 0 errors (the 2 known warnings; "Discord import off"), `config -q`, `up -d --no-deps --no-build api`: healthy, 0 restarts |
| Checks after (API) | `/healthz` 0.43.0 on msg.meldiq.app and msg.griipbuddy.cloud; `/v1/discord/status` and `/connect` answer "Authentication required" signed out; deployment `verify.sh` clean; live database integrity ok, schema 56; 0 errors in the log |
| Web | release `0.5.0-beta-73bbdda` (`sha256sum -c` OK) installed with last round's live settings; nginx `-t` ok (the two known warnings); CSP, site file and `config.json` byte-identical to before; `verify.sh https://web.meldiq.app` all passed (API 0.43.0 through the site, realtime 101) |
| Smoke (signed out) | the intro screen shows Meldling, no console errors; `/discover` and `/discord/callback` served by the app; every Meldling asset served; the manifest names Meldling's icons; web.griipbuddy.cloud 301s to web.meldiq.app; the invitation page shows Meldling and a clear message for an unknown code |
| Post backup | `backups/post-0.43.0-20261027T002049Z` verified (schema 56, 43 users) |

**Not checked in production:** anything signed in (the typing indicator, Discover, Invite people, read sync, the
Discord tab's "not set up" message). There's no production test account, and making one or using a real person's
account isn't something this deploy does. All of it was checked against a local 0.43.0 server (Verification).

**Discord import in production is off** until the owner creates a Discord application and adds four settings
(meldiq `docs/DISCORD_IMPORT.md` › Setting it up): the app says "isn't set up on this server yet". No real Discord
server has been imported anywhere.

Rollback, web first: `bash /root/meldiq-web-0.5.0-beta-73bbdda/rollback.sh` (back to 9e42f38); then the API:
`compose.yaml` image `griip-internal-messaging-api:0.42.0-rollback` and `docker compose -p griip-internal-messaging -f
compose.yaml up -d --no-deps --no-build api` in `/opt/griip-internal-messaging`. 0.42.0 runs on schema 56 unchanged (the
four new tables are only added; nothing it reads changed), so nothing in the database needs undoing.

## Mobile

- **Responsive web:** `viewports.spec` checks home, a DM, a channel, details, settings and now Discover at 320, 360,
  375, 390, 430, tablet and desktop sizes (no sideways scrolling, lists fit, the composer on screen); screenshots looked
  at for Discover at 320 and 1280. Everything new works by tap: Discover's cards and buttons, Invite people, the Discord
  import (checkboxes, lists that scroll inside the dialog), the typing indicator (no hover needed).
- **Native Android: no change made.** API 0.43.0 is backward compatible: `audience` is a new optional field the app
  never sends; the new routes are new. The app already handles a "read" control from its own account by clearing that
  conversation, so **reading a channel on the web now clears it on the phone too**; the other direction needs the app to
  send that control for channels (not done). Not done on Android: Meldling icons, the typing indicator, Discover as a
  page, Discord import.

## Remaining

- **Discord application** to create (owner, on Discord's side), then a first real import to watch.
- **Signed-in production smoke tests** with a test account.
- **Merge** `meldling` into `ai-workforce-web` and `meldling-api` into `internal-beta`: production now runs them.
- **Community accents and banners** (brief §5): still no server field for either; not added, as in version 1.
- **The reconnect-after-many-reloads issue** above.
- Firefox and WebKit browser projects weren't run.
