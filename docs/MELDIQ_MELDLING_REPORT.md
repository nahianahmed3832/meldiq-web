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
| Full browser suite, Chromium + phone width | see below |

Not tested: Discord against the real Discord (no Discord application exists yet; the server's tests use a local
stand-in for Discord's API), Firefox and WebKit, a physical phone.
