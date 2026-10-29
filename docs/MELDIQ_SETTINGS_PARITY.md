# Settings parity with the reference app (2026-10-29)

The owner asked for the reference app's settings system copied into Meldiq "entirely, server too". This file is the
spec: what the reference does (seen signed in on 2026-10-29), what Meldiq already has, and the order we build the rest.
Copy the behaviour and structure, never the reference's words, art or branding.

## 1. What the reference does

### The window

- Settings opens as a **centred window over the app** (about 1200 px wide, full height minus a margin, rounded, a close
  ✕ top right, Esc closes). The app stays visible, dimmed, behind it.
- A left rail with two titled groups and icons:
  - **User settings**: My Account, My Profile.
  - **App settings**: Appearance, Voice & Audio, Keybinds, Advanced, Developer, Subscriptions, Creators, Shards
    (their points), and the paid plan last, in the accent colour.
- The page title sits at the top of the content column. Sections inside a page use small uppercase labels.

### My Account

- A profile header card: banner colour strip, big avatar with status dot, display name, @username, an **Edit profile**
  button (jumps to My Profile).
- One card listing **Display name**, **Username**, **Email** (masked, with Reveal), each with its own **Edit** button
  that opens a small dialog.
- **Password and authentication**: Change password; **Account standing** card (shield icon, "all good" headline, a
  four-step track All good › Limited › Very limited › Suspended, and the rules: staff warnings count for 3 days; 1
  warning limits you, 2 limit more, 3 suspend); **Two-factor authentication** with an authenticator app (Turn on).
- **Privacy**: who can message you (a select), who can add you to group chats (a select, with the effect explained),
  **leave several servers at once** (pick one by one or a whole folder; servers you own stay), and a switch to be
  suggested to people with similar interests.
- **Verification** for creators: put a code line in your channel bio, platform select, channel name, link, notes, a
  proof screenshot showing the follower count (1,000+), a "the line is in my bio" checkbox, Apply.
- **Bug hunting**: report a bug, earn a badge.
- **Your data**: download everything as one JSON file, 3 times a day.
- **Account**: log out of all devices; delete account (immediate, with an email confirmation).

### My Profile

Two columns: the editor, and a sticky **Preview** profile card on the right that updates as you change things.

- A promo card for decorations with a **Browse** button.
- **Look**: profile picture upload (GIFs animate), banner upload (crop, zoom, drag in the preview), **server tag**
  (pick which community's short tag shows by your name, or none), **badge** (pick the one shown next to your name in
  chat and the member list; the profile card shows all; none hides them).
- Two rows that open their own windows: **Avatar decoration** (current one shown) and **Name style** (current font and
  colour shown).
- **Profile theme**: one colour, or "+ Second" for a two-colour gradient, plus ready presets (Sunset, Ocean, Grape, Mint,
  Midnight, Cherry, Gold, Aurora, Rose, Forest, Neon, Candy). It colours the profile card, its banner when there is no
  picture, and your voice tile.
- **Identity**: username (the old one stays yours for 7 days), display name, pronouns, about me (300 characters, a
  counter), links (+ Add link).
- **Connections**: Steam, AniList, Last.fm, Trakt, each a button with one line on what shows and "you sign in on their
  own page".

### Avatar decoration window

- Title, then tabs **Included** / **Community**, and a **Make a decoration** button.
- Included has filters **All / ★ Favourites / Pictures / Effects**. Pictures are image overlays drawn at 150 % of the
  avatar, centred (inset −25 %); Effects are CSS rings and glows in the accent colour.
- Community has a search box (name or artist), **All / Moving / Still**, then **All / ★ Favourites / Owned /** a
  seasonal set. Tiles show the name, "by @artist" and a price when it costs points.
- Each tile shows the decoration on **your own avatar**; a star on hover marks a favourite.
- The right column previews the pick large, then as a chat message ("Look at my new decoration") and as a member-list
  row, with the decoration's name below. **Cancel** / **Apply** at the bottom: nothing saves until Apply.
- Make a decoration: quality rules (clean edges, fits without covering, own art, reads small), the format (square
  512×512 PNG/WebP/GIF, transparent, centre circle empty, a template to download), what's not allowed, what you get
  (an artist badge, more submission slots), pick a picture, an optional price, an "I made this myself" checkbox, Send.

### Name style window

- **Choose font**: eight "Gg" tiles in different typefaces.
- **Choose colour**: None / Solid / Gradient (gradient shows two colour pickers); "too dark or too light gets nudged so
  it stays readable".
- The right column previews the name on a profile card, in a chat message and in the member list, plus the rules (a
  community role colour beats yours but your font stays; on a themed profile card the name turns white).
- **Surprise me**, **Reset**, **Apply**.

### Appearance

Language select; Dark / Light picture cards; **colour themes** (about 20 gradient swatches that tint the whole app, plus
a custom theme: two or three colours and an intensity slider); "use a server's own colours" switch; "unread DMs as
bubbles in the server list" switch.

### Voice & Audio

Microphone and speaker selects, output and soundboard volume sliders, a mic test with a level bar, input mode (voice
activity / push to talk), voice processing switches (AI noise suppression, standard noise suppression, echo
cancellation, automatic gain), join/leave chimes, "join calls muted", and a reset button.

### Keybinds

A list of actions, each showing its keys and an Off switch; click a shortcut and press new keys (Esc cancels), saved on
the device. Below, an **Always on** list of fixed shortcuts.

### Advanced, Developer, Subscriptions, Creators, points, plan

- Advanced: developer mode (copy IDs in right-click menus), a staff application, trusted link sites.
- Developer: a developer portal link; **bots** (2 free, 10 on the plan) and **"Log in with …" apps** (client ID and
  secret, 10 apps), each with an empty state and a make button.
- Subscriptions: everything that renews, with cancel, and an email fallback.
- Creators: a creator programme (paid in plan months by views; steps: verified channel → apply → approved dashboard).
- Points: a balance, an account level ring (colour changes every 10 levels), daily quests and one-time quests with
  rewards, ways to earn (daily visit, chatting, a 7-day streak, invites), ways to spend (levels, community decorations),
  selling your own decorations (70 % to the artist), and a history.
- Plan page: price, what's included, a free vs plan table, gift a plan.

## 2. What Meldiq already has (API 0.63.0)

| Reference feature | Meldiq today |
| --- | --- |
| Floating settings window, two titled groups | Yes (`SettingsWindow`, `SettingsView`) |
| Account standing | Yes, `GET /v2/account/standing` (warnings last 14 days by default, not 3; staff warn from the CLI) |
| Authenticator two-step sign-in | Yes, `/v2/account/totp*` |
| Who can message you | Yes, `/v1/users/me/messaging` (dmPolicy, requestPolicy) |
| Who can add you to group chats, "suggest me" | No |
| Leave several communities at once | No (one at a time) |
| Creator verification, creator programme | No |
| Bug reports and Bug Hunter badge | Yes, `/v1/bug-reports` |
| Download your data | In the browser only (`sync/dataExport.ts`) |
| Log out everywhere, delete account | Yes |
| Banner, server tag, pronouns, about me (300), links | Yes |
| Pick which badge shows | No (only hide the Mojo badge) |
| Two-colour profile theme with presets | No (one accent colour; the name has 1–3 colours) |
| Username held 7 days after a change | No |
| Steam / AniList / Last.fm / Trakt connections | No |
| Colour themes, custom gradient, intensity | Yes, browser-local (`AppearanceExtras`) |
| Voice settings | Browser-local (`CallsPage`) |
| Keybinds | A read-only list (`ShortcutsPage`) |
| Bots and "Log in with Meldiq" apps | No (only quotas in `billing/perks.ts`) |
| Subscriptions with cancel | Mojo plans via Stripe portal / Google Play |
| Points, quests, streaks, account levels | No (Mojo is the paid plan, Spark boosts communities) |
| Decoration favourites, prices | No (submissions and Artist badge exist) |

## 3. Build order

Server work goes on meldiq branch `settings-parity` (from `admin-accounts`, API 0.63.0 → 0.64.0); web on
`floating-redesign`.

1. **Web: profile and pickers.** My Profile in two columns with a sticky live preview card; Look section in the
   reference's order (picture, banner, server tag tiles, badge tiles, decoration row, name style row, profile theme);
   the decoration window (Meldiq / Community tabs, All · Favourites · Pictures · Effects filters, search and Moving ·
   Still on Community, preview as profile, chat line and member row, Cancel / Apply); the name style window (font
   tiles, None · Solid · Gradient, previews, Surprise me · Reset · Apply); My Account's header card and one card of
   fields with Edit buttons.
2. **Server, batch A (0.64.0).** Two-colour profile theme with presets; the badge you show; leave several communities;
   group-chat add policy and the "suggest me" switch with a suggestions list from shared communities; old usernames
   held 7 days; decoration favourites; points (daily visit, chatting, 7-day streak, invites), daily and one-time
   quests, account levels with a ring colour per 10 levels, and a history.
3. **Web: the rest of the pages.** Keybinds you can rebind (saved per device), voice page in the reference's layout,
   the points page, and wiring batch A into Account, Profile and Privacy.
4. **Server, batch B.** Creator verification applications with an admin review queue and a Creator badge; Steam,
   AniList, Last.fm and Trakt connections (off until the owner adds each service's keys); "Log in with Meldiq" apps
   (client ID and secret, OAuth code flow) and bots (token, slash commands).
5. **Android** follows once the API ships.

New built-in decorations (about 40, original drawings of popular community themes) go on `settings-parity` too.

## 4. Rules channel (2026-10-29)

### What the reference does

- **How it's made.** Not a channel type and not a template. A community setting, "Rules channel", is a dropdown of the
  community's text channels with "No rules channel" at the top. Picking one marks it; the setting's hint says the
  channel gets a book icon, only people who can manage the community post in it, and new members get a nudge to read it.
  Changing it is written to the audit log. A new community ("Blank server") starts with a general and a voice channel,
  so no rules channel; one only comes from a template someone shares.
- **The rules themselves** are ordinary messages that staff post in that channel: a long numbered list ("7. Use the
  right channel" with a line or two under it), often a closing line ("By staying here you agree to these rules"). Members
  react to them.
- **What members see.** The channel shows a book icon in the channel list (the header keeps the channel's own icon) and
  usually sits first. Instead of a message box there is a note: only certain roles can post here, you can still read and
  react. Members who haven't opened the channel yet get a dismissable "New here? Read the rules" button; opening the
  channel or dismissing it hides it on that browser. People who can manage the community never see it. The community's
  home page has a Rules card that opens the channel.
- **Agreeing.** There is no separate "I agree" record. Onboarding (questions, then the rules) has a last step that shows
  the first messages of the rules channel with an "I read the rules" button. When the community makes onboarding
  required, the composer says "Finish onboarding to chat here" until that step is done; reading and reacting still work.
  Onboarding only applies to people who join after it's turned on; everyone can redo it from the community menu.
- **Who can edit.** People with the manage-community permission set the channel and post the rules. The whole feature
  sits behind a staged rollout flag.

### What Meldiq had

Channel types (text, announcement, forum, voice; announcement posting needs `messages.announce` or a manager), a plain
`rules` text on the community (shown in the preview before joining), the community guide (welcome line, tasks,
resources) and onboarding questions (roles and channels, never blocking). No rules channel, no agreement, nothing that
held the composer back.

### What Meldiq does now (API 0.65.0, feature `rules-channel`)

- **Server** (`meldiq_android` `settings-parity`): `GET`/`PUT /v1/orgs/:orgId/rules` and `POST /v1/orgs/:orgId/rules/agree`;
  `rulesChannel` on community views; errors `rules_channel`, `rules_channel_invalid`, `rules_not_agreed`;
  `COMMUNITY_RULES=off` turns it off. Details in that repo's `docs/SETTINGS_PARITY_API.md`.
- **Rules as a numbered list**, not channel messages: each rule has a title and an optional description, up to 25.
  Meldiq's channel messages can't be shown before someone joins or reliably as the "first ten", so a list kept as
  community settings serves the channel, the dialog and the preview (it is also written to the plain `rules` text).
- **The rules channel** is picked in Community settings › Rules (text or announcement channels everyone can see). It
  shows `BookText` in the channel list, the sidebar and the header; its top shows the rules; only people who can edit
  the community post there, everyone else reacts and votes. Templates are unchanged, as in the reference.
- **"Members agree before they post or react"** is a switch on the same page. Unlike the reference it is its own record
  per member (`agreedAt`), applies to current members too, and is enforced by the server. Until someone agrees, the
  composer is replaced by a bar with "Read the rules", which opens the rules with "I agree". A refusal from the server
  (the switch was just turned on) brings the bar up at once. Leaving the community forgets the agreement.
- Not done: the "New here? Read the rules" nudge for communities that don't require agreeing, a Rules card on the
  community home, asking everyone again after the rules change, and Android.
