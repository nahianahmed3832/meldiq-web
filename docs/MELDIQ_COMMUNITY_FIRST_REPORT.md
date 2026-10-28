# Meldiq community-first redesign: implementation report (2026-10-26)

The brief: [`MELDIQ_COMMUNITY_FIRST_BRIEF.md`](MELDIQ_COMMUNITY_FIRST_BRIEF.md). Owner's mascot references: `brand/reference/`.

## Where the work is

| Repository | Branch | Base (what production runs) | Commits |
|---|---|---|---|
| meldiq-web (`/Volumes/code_files/meldiq_web`) | `community-first` | `origin/ai-workforce-web` (production web 0.5.0-beta-0f42277 + one test fix) | 10 |
| meldiq (`meldiq_android/.claude/worktrees/community-first-api`) | `community-first-api` | `origin/internal-beta` a95fb82 (production API 0.41.0) | 4, API **0.42.0** |

`main` of meldiq-web is **not** what production runs (it lacks the AI workforce work): build releases from `community-first`.
An earlier copy of the web work based on `main` is on `community-first-redesign`, and of the server work based on 0.33.0 on
`community-first-server`; both are superseded.

## Shipped

1. **Navigation (§G, §H, §3).** The mascot, cropped from the owner's app icon (`scripts/render-mascot-assets.mjs`), is the
   rail's Home and messages button with the unread DM count; DMs, Activity and Later left the rail. Activity (with the
   mention count) and Saved for later (with reminders due) are in the top bar and the profile menu; their routes, data and
   the message menu's Save for later are unchanged. Round **Create** and **Discover** buttons sit under the communities and
   open the existing creation and discovery flows (Discover gained Try again). Phones get the same as a strip above the
   conversation list, and the tab bar's DMs tab became Messages with the mascot.
2. **Unread (§C).** One rule (`src/ui/unread.ts`) for channel rows, DM rows and community icons: one unread event
   highlights the row (white text and edge marker) without a number; two or more add a light count (99+ shown, real
   number in the label); mentions get a pink `@` badge; muted stays quiet. Community icons roll up their visible
   channels. Selected, unread, mention and live-call states differ by shape as well as colour.
3. **Notifications (§D).** A Web Audio chime for messages the existing notification pipeline lets through (not yours,
   not the conversation you're reading, not muted or paused), armed only after a click or key press, one per 1.5 s across
   tabs (Web Locks), never doubled with a system notification's sound; Settings › Notifications: on/off, volume, test.
   The tab title and favicon show unread DMs plus mentions as a number, other channel activity as a dot.
4. **Reactions (§B).** Hover or keyboard focus on a reaction shows who chose it (eight names, then "and N more"); a long
   press, right-click or the message menu's Reactions opens everyone, one tab per reaction. Same component for DMs and
   channels.
5. **Calls (§E).** Rows show a live call: speaker (voice), camera (video), screen (someone sharing), with the number of
   people; voice channels mark who is sharing; the call banner names sharers and says why there's no Join.
6. **Members and invitations (§F).** Add members (People page and community menu): search, pick up to twenty, add, see
   each outcome, with "Create an invite link" for anyone who can't be added directly. Invitation links open Meldiq Web at
   `/join/<code>`, kept through sign-in, straight to the community's preview and Join; Copy link, Copy code and Share on
   new invitations; the public invite page restyled.
7. **Visual system (§1).** A new default palette, **Meldiq**: deep navy surfaces, the logo's cyan/blue/violet for
   selection and actions, pink only for mentions, white for unread. Browsers that never picked a palette move to it;
   anyone who picked one keeps it.

## Root causes fixed

- **Presence flicker (§A).** Not the client: the server announced "online" the moment any connection opened and
  "offline" the moment the last closed. When someone receives a message while their phone is in the background, the push
  wake-up (Android `WakeFetch`) opens the relay connection for about a second to fetch the queue, so everyone sharing a
  conversation with them saw them flash online, then offline. Network hand-offs did the reverse. Now
  (`server/src/modules/realtime/presence.ts`) a person appears online once a connection has stayed open 4 s and offline
  once none has been open for 10 s (`PRESENCE_SETTLE_MS`, `PRESENCE_GRACE_MS`); REST views use the same settled state;
  delivery still follows the raw connections. Works with every existing app version.
- **Stale views after props change.** `useOrbit` cached a selector's result by store state only, so a view whose selector
  reads props kept the previous result until something else changed (seen as channels under "Recent direct messages").
  Now cached per state and selector.

## Verification

On the final branches (web `community-first` on `ai-workforce-web`; API `community-first-api`, 0.42.0, on `internal-beta`):

| Check | Result |
|---|---|
| Server `tsc --noEmit` | clean |
| Server `vitest run` (full) | **1076 passed**, 11 skipped, 0 failed (123 files), including the new `presence_stability` (wake-up connection never announced, DM and channel sends, offline recipient, reconnect within grace, two connections, real leave), `presence_tracker` (settle, grace, duplicate signals, rapid toggling, stale timer), `call_screen_shares` and `members_add` (bypass attempts, strangers, blocks, bans, consent settings, pause, validation, rate limit, audit) |
| Server architecture boundaries | pass (cross-module calls go through `index.ts`) |
| Web `tsc -b`, `eslint .`, `prettier --check` | clean |
| Web unit tests (`vitest`, without live tests) | 505, all passed against the 0.42.0 contracts (`MELDIQ_CONTRACTS_DIR` = the API branch); new: `reactors`, `unread-markers`, `tab-badge`, `pending-invite`, updated `prefs` |
| Web browser tests, Chromium + phone width, local API 0.42.0 and LiveKit | full run 114 passed / 2 failed; both fixed and rerun: `agents.spec` (its "Save" locator now also matched the new "Saved for later" button: exact name) and `viewports.spec` (one-off timeout under load; passed 2 of 2 alone). New `community-first.spec.ts` (rail, top bar, Create, Discover, the unread rule, title count, reaction hover) passes |
| By hand (local server, in-app browser) | 1280, 375 and 320 px: rail, phone strip, unread markers, DM list from the mascot, title `(1) Meldiq` and the favicon badge, the reaction card, Add members against the server, `/join/<code>` opening Join with the server's answer |
| Baseline before any change | web `main`: typecheck, lint, build clean; unit 1 failure (`contract-fixtures`: the checkout's server branch differed), not caused by this work |

Not tested: Firefox and WebKit browser projects, a physical phone, real push notifications, production.

## Production

**Live since 2026-10-26 22:26 UTC: API 0.42.0 and Meldiq Web 0.5.0-beta-9e42f38** (owner's go-ahead in chat).

| Step | Result |
|---|---|
| Pre-flight | running API 0.41.0 (healthy, 2 days) and web 0f42277; VPS `server/` byte-equal to `internal-beta` a95fb82 outside tests (`rsync -c` dry run); 49 GB free |
| Backup | `backups/pre-0.42.0-20261026T221714Z`: integrity ok, schema 55, 43 users, `.env` + `compose.yaml` copies; image tagged `0.41.0-rollback`; sources kept as `server.pre-0.42.0` |
| Build | the 15 files of this release synced (dry run listed exactly them); `docker build -t griip-internal-messaging-api:0.42.0 server` (`build-0.42.0.log`, done, no errors) |
| Rehearsal | snapshot copy, `--network none`, env without FCM lines: healthy, `/healthz` 0.42.0, schema 55 unchanged (no migration), integrity ok, 43 users; removed after |
| Switch | `compose.yaml` image 0.42.0, `validate-env.sh` 0 errors (the 2 known warnings), `config -q`, `up -d --no-deps --no-build api`: healthy, 0 restarts |
| Checks after (API) | `/healthz` 0.42.0 on msg.meldiq.app and msg.griipbuddy.cloud; `POST /v1/orgs/:id/members` answers "Authentication required"; deployment `verify.sh` clean; 0 errors in the log |
| Web | release `0.5.0-beta-9e42f38` (`sha256sum -c` OK on the VPS) installed with the live settings (read back from the running config.json and CSP); `nginx -t` ok (the two known warnings); CSP and site file byte-identical; `verify.sh https://web.meldiq.app` all passed (API 0.42.0 through the site, realtime 101) |
| Smoke | sign-in page serves the new bundle (Meldiq palette) with no console errors; mascot assets, `/join/<code>`, `/sw.js` served; web.griipbuddy.cloud 301; the invite page shows the new layout and a clear message for an unknown code |
| Post backup | `backups/post-0.42.0-20261026T222757Z` verified (schema 55, 43 users) |

**Not checked in production:** anything after signing in (presence while sending, reactions, unread, sound, Add members,
a real invite, call badges). There's no production test account, and creating one or using a real person's account wasn't
in scope. These were all checked against a local 0.42.0 server.

Rollback, web first: `bash /root/meldiq-web-0.5.0-beta-9e42f38/rollback.sh` (back to 0f42277); then the API:
`compose.yaml` image `griip-internal-messaging-api:0.41.0-rollback` and `docker compose -p griip-internal-messaging -f
compose.yaml up -d --no-deps --no-build api` in `/opt/griip-internal-messaging` (no migration to undo).

## Mobile parity

- **Responsive web:** checked by hand at 1280, 375 and 320 px (no horizontal overflow on the conversation list or an open
  channel at 320 px; `document.scrollWidth` equals the width); phones get the community strip with Create and Discover,
  the mascot Messages tab, touch alternatives for hover (long press on a reaction opens the list; Add members and Join
  are dialogs that fit the screen). The existing phone-width browser project ran too (see Verification).
- **Native Android (`meldiq_android/android`): no change needed and none made.** The server changes are backward
  compatible: presence settling needs nothing from the app (it fixes the flicker for every released version, including
  the wake-up fetch that caused it); `sharing` is a new optional field the app's JSON (`ignoreUnknownKeys = true`)
  ignores; the add-members route is new. Not done on Android: showing who reacted, the unread rule, live-call badges,
  Add members, `/join` links. Those are UI work in the app, not compatibility fixes.

## Remaining risks and follow-up

- **Signed-in production smoke tests** are still to do with a test account (see Production).
- **Branches are local:** `community-first` (web) and `community-first-api` (API) aren't pushed or merged; production now
  runs them, so merge them into `ai-workforce-web`/`main` and `internal-beta` before anyone releases from those.
- **Channel read state across devices.** DMs and small groups sync read state through encrypted read receipts; channels
  don't (by design since before this work: `sendsReadReceipts` excludes channels), so reading a channel on the phone
  doesn't clear it on the web. Fixing it needs a self-only read control (or a server cursor) that Android also sends and
  applies: a protocol change for both apps.
- **Reactions don't count as unread.** Only messages do, as on Android; counting reactions to your messages would make
  the web disagree with the phone.
- **Community accent colours and banners (§1).** The server has no field for either (roles have colours, which the
  member list already shows). Not added: a setting without a backend would be fake. Needs a validated server field, a
  migration and UI on both apps.
- **Camera on/off isn't tracked for channel badges.** LiveKit's webhooks don't report a camera being muted, so the badge
  says "video call" from the call's type, not who has a camera on.
- **Presence timing.** Online now appears ~4 s after someone connects and offline ~10 s after they leave. Tunable without
  a release (`PRESENCE_SETTLE_MS`, `PRESENCE_GRACE_MS` in the API's `.env`).
- **Add members eligibility.** Deliberately narrow: only people the adder knows who'd accept a DM from them. Everyone
  else needs an invite link (offered in the dialog).
