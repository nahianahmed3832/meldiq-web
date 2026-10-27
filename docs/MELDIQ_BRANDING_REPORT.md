# Community branding, the reference UI and Discord import (2026-10-27)

Follows [`MELDIQ_MELDLING_REPORT.md`](MELDIQ_MELDLING_REPORT.md). Production since 10:21 UTC: **API 0.44.0** and
**Meldiq Web 0.5.0-beta-c3220e5**. Discord import is **on**.

## Completed

1. **Community accent colours and banners** (API 0.44.0, meldiq `docs/COMMUNITY_BRANDING.md`).
   - Server: migration 057 adds `orgs.accent` and `orgs.banner_rev` (nullable: every existing community keeps Meldiq's
     theme). `PATCH /v1/orgs/:orgId` takes `accent` (`#rrggbb` or `null`; anything else is 400). Banner upload,
     removal and download: `PUT/DELETE/GET /v1/orgs/:orgId/banner` (JPEG, at most 1 MB, in the existing photo store,
     per revision), `GET /v1/invites/:code/banner` for invitation pages. Only people with `workspace.edit` (owners,
     admins, roles with it) change branding; members read the banner, anyone signed in reads a public community's,
     banned people never. `accent` and `bannerRev` are in every community view, Discover and both invitation
     previews; changes are audited and announced. Deleting a community removes its banner.
   - Web: Community settings › Overview › **Appearance**: ten presets plus any colour (picker or typed hex,
     validated), banner upload cropped to 1200 × 480 with a preview, Save and Cancel, loading, success and error
     states; members who can't edit see the preview only. The accent is scoped to that community's channel list
     (selected channel, header line), its rail icon, Discover card, preview and invitation, never the app's theme or
     another community; any colour is made readable (AA text on light and dark surfaces, black or white on the fill).
     The banner shows behind the community's name, on Discover cards, in its preview and on both invitation pages.
2. **The reference UI in Meldiq's colours.** User panel at the foot of the sidebar (desktop) with the profile menu;
   profile card beside the member list; Invite friends with per-person Invite and the link with Copy; one-card
   invitation; DM hub (Friends, Find people, Create group, Direct messages +); Discover cards with banners and
   "All communities"; numbered Discord steps. Colourful: each person's name in their own colour (a role's colour
   wins), blue-to-violet calls to action, slightly larger message text.
3. **Discord import on in production.** Application "Meldiq" created in the owner's Developer Portal (redirect
   `https://web.meldiq.app/discord/callback`, privileged intents off, Public Bot on so anyone can add it to a server
   they manage). The owner entered the secret and bot token through `/root/set-discord.sh` (hidden input, straight into
   `.env`). Verified from the API container without printing anything: the bot token answers as "Meldiq" with the
   same id and redirect, the client secret is accepted, the API's configuration has Discord on. The OAuth and revoke
   calls match Discord's documentation (form-encoded, `permissions=1024` View Channels only).

## Root causes fixed

| Problem | Cause | Fix and test |
|---|---|---|
| Desktop Settings had no connection state, search or profile menu | the top bar was hidden on every desktop page, including pages without the sidebar's user panel | hidden only beside the sidebar (`.workspace.with-sidebar`); accounts and settings browser tests |
| Home was empty for someone in no community | the new layout moved DMs to Home and messages only | Home without a community shows the messages hub; cross-device, emoji, legacy Safari tests |
| Phones and tablets showed the user panel inside the drawer | the hiding rule came before the panel's own `display` | higher-specificity rule; phone-width suite |
| Mid-tone accents had unreadable labels | neither black nor white reaches 4.5:1 on, e.g., #777777 | the fill is nudged until its label reads; `community-accent.test.ts` |
| `admin storage-orphans` listed community emoji and stickers as orphans | it knew only people's and communities' photos | it now knows banners and expressions too |
| The 0.35.0 build waiter on the VPS never ended | `pgrep -f` matched its own command line | the process (PID 1577835) was stopped and confirmed gone |
| The reload test's "Authentication required" | the sign-in routes' own limit (30 a minute per address) | explained in the Meldling report; not a production bug |

## Verification

| Check | Result |
|---|---|
| API `tsc --noEmit` | clean |
| API full suite | 1,106 passed, 11 skipped; new `community_branding` (7) |
| API PR CI (server, Android unit tests/lint/builds) | passed |
| Web `tsc -b`, `eslint .`, `prettier --check` | clean |
| Web unit tests | 518 passed, 1 skipped (contracts from API 0.44.0); new `community-accent` (5) |
| Browser suite, Chromium + phone width, against API 0.44.0 | **64 passed, 0 failed** (64 skipped: desktop-only tests at phone width and the reverse); new: accent and banner set, kept after reload, scoped to one community; read-only for members |

Not run: Firefox and WebKit browser projects, a physical phone, Android Studio builds beyond CI.

## Production

| Step | Result |
|---|---|
| API | backup `pre-0.44.0-20261027T093747Z` (integrity ok, schema 56, 43 users); rehearsal on a copy (schema 57, 0 errors); switch healthy; post backup `post-0.44.0-20261027T102210Z` (schema 57); 0 errors since |
| Web | `0.5.0-beta-fbee84d`, then `c3220e5` (invitation wording); checksums ok; nginx, CSP and `config.json` unchanged; `verify.sh` all passed (API 0.44.0 through the site, realtime 101) |
| Smoke (signed out) | sign-in page, `/discover`, `/discord/callback`, invitation pages and Meldling assets served; an unknown invitation shows its message; web.griipbuddy.cloud redirects |

**Not checked in production:** anything signed in (branding in the live app, the redesigned screens, a real Discord
import). There's no production test account, and creating one or using someone's account isn't something this
deploy did; all of it was checked against a local 0.44.0 server.

Rollback: web `bash /root/meldiq-web-0.5.0-beta-c3220e5/rollback.sh` (to fbee84d; again for 73bbdda); API image
`griip-internal-messaging-api:0.43.0-rollback`. 0.43.0 runs on schema 57 as it is.

## Branches

| Repository | Branch | Into |
|---|---|---|
| meldiq-web | `meldling` | `ai-workforce-web` (nahianahmed3832/meldiq-web#22, a fast-forward) |
| meldiq | `meldling-api` | `internal-beta` (nahianahmed3832/meldiq#3, a fast-forward) |

## Remaining

- A first real Discord import, by someone who manages a Discord server.
- Signed-in production checks with a test account.
- Android: branding, the redesign and Discord import aren't in the app (the new fields are additive; nothing breaks).
- The main `meldiq_android` checkout is behind `internal-beta` and has an uncommitted `build.gradle.kts` change, so the
  web's contract check needs `MELDIQ_CONTRACTS_DIR` pointed at an up-to-date checkout until it's updated.
- Two `bash -s` sleep loops on the VPS from 2026-10-23 (PIDs 1582394, 1708911) of unknown purpose, left running.
