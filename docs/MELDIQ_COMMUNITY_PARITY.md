# Community management parity with the reference app (2026-10-30)

The owner asked for the reference app's whole community ("server") management copied into Meldiq: the same features, in
the same places, working the same way, server and database included. This file is the spec. Section 1 is what the
reference does (surveyed signed in on the owner's own community, 2026-10-30; test bots, a role and two webhooks were
made and removed again). Section 2 is what Meldiq has. Section 3 is the build order.

Same rule as `MELDIQ_SETTINGS_PARITY.md`: copy behaviour, structure and placement; write Meldiq's own wording and art,
never the reference's text, pictures or branding. In Meldiq a "server" is a **community** (API "org").

## 1. What the reference does

### Server menu (click server name, top of channel list)
Invite people · Supercharge · Server Settings · Promote Server · Bots · Create Channel · Create Category · Lock Server ·
Change Nickname · Mute Server · Notification Settings · ── · Delete Server (red)

### Lobby (server home page, first item in channel list, above "Invite people" button)
Banner gradient header, icon, name, "N members · N online", Customize button (top right) -> live editor.
Empty state card: "nothing here yet" + buttons Write an intro / Pick main channels / Add a FAQ.
Cards: Jump in (main channels with "Active Xm ago"), Who runs it (owner + mods, Owner crown tag).

### Server Settings window (wide modal, left rail)
Rail groups: [server name] Server Profile, Lobby, Theme, Channels, Supercharge, Promote | EXPRESSION Emoji |
APPS Bots | PEOPLE Members, Roles, Onboarding, Bans | MODERATION Reports, Audit Log.

#### Server Profile
- Icon upload (square, GIF animates), Server banner (wide, top of channel list, drag+zoom to frame)
- Server name (max 100) Save
- Custom invite link yapin.gg/invite/<slug max 32>, unlocks at 5 members
- Server template: "Create template link" (channels, roles, permissions; no messages/members)
- Links: + Add link
- Server tag: 2-4 letters/numbers, members wear next to name everywhere (Settings > Profile)
- Discovery: Show in Discovery toggle (public by default; listed at 5 members); one-line description (300);
  tags comma-separated up to 5
- Raid protection: Lock for 15 min / 1 hour / a day. Locked = no joins + only manage-messages can post.
  Auto: lock 15 min after 60 joins in a minute; auto 5 s slowmode on channel with 30 msgs from 6 people in 10 s.
- Verification level: None | Low | Medium | High (Medium = account older than 5 min and in server 5 min).
  Mods, people with roles, and bots skip it.
- New accounts: Off | Younger than 10 minutes | 1 hour | 1 day | 7 days (blocks joins). Mods/staff never blocked.
- Who can join: Anyone with the link | They apply, you approve
- Tickets: "Let members open tickets" toggle -> private channel member + manage-messages people, opened from server
  menu, lands in a Tickets category, closed from channel header.
- Rules channel: dropdown (No rules channel | text channels)
- Delete server (danger)
- Right side: live preview card (icon, name, online/member counts, "Est. Oct 2026")

#### Lobby
- Link "Open the live editor" (layouts, colours, fonts, backgrounds, buttons, templates, section order; live on real page)
- Toggle Show the lobby to members (members land on it the first time)
- About (textarea 2000, markdown)
- Main channels: pick up to 6, ordered; people only see ones they can open
- FAQ: up to 10 questions, Add question
- Toggle Show who runs it (owner + roles that manage server or moderate)
- Save

#### Theme
- Accent colour: none, 8 presets (orange, green, teal, blue, purple, pink, amber) + custom picker + #rrggbb.
  Too light/dark nudged for readability.
- Background tint: same swatches.
- Live preview (mini rail + message "check out this link" + Button). Save.
- Members can turn server themes off in their Appearance settings.

#### Channels
- Categories list ("No categories yet", Create Category); drag handle ⋮⋮ and ▲▼ to reorder channels.

#### Supercharge (= Meldiq Spark boosts)
- Levels 1/2/3 at 2/7/14 supercharges; $2.99/month each, any member can chip in, Plus includes one free.
- L1: 100 emoji, 25 MB uploads, 128 kbps voice, 720p60. L2: 150, 50 MB, 256 kbps, 1080p60. L3: 250, 100 MB, 384 kbps, 1080p60.

#### Promote
- Discovery rank; Boost $3.99/wk (Boosted label), Super Boost $7.99/wk, Mega Boost $12.99/wk (gold label, guaranteed
  top 100/50/20). Promoted top row, 4 spots, $29.99/wk, live views/clicks/joins, book next spot.
- Only biggest boost counts; locked/removed servers stop showing, no refund.

#### Emoji
- Up to 50 (100/150/250 with supercharge levels), usable everywhere incl. other servers and DMs. Upload emoji, N/50 used.

#### Bots
- Official bots (free, toggle): Welcomer, Helper (game night host), Levels, Logger, Starboard, Giveaways, Tickets,
  Alerts (new video), Wordy (one word a day). "Your own bot" (build in 5 min, no hosting).
- Bots+ $3.99/month per server unlocks every official bot's Plus extras (role rewards, XP boosts, custom commands,
  goodbyes, separate member log, custom starboard emoji, bigger giveaways).
- Community bots: browse, add by bot ID, search, categories Most used/All/Moderation/Fun/Games/Utility/Music/Economy/
  Social/AI/Other, sort Most used | Newest | A to Z.
- Also built in: Reaction roles (message context menu > Reaction roles…, emoji -> role).
- Each bot opens a detail window: coloured header, icon, name + BOT tag, tagline, On/Off switch, description,
  feature chips, sample message, free vs Plus comparison table, Save.
- Welcomer (on): Look in this server (Change: per-server bot name max 32 + picture); welcome channel picker (auto
  picks #general); message max 300, default "Welcome to {server}, {user}! 👋", placeholders {user} {name} {server}
  {count}, live preview, "Send a test". Plus: up to 10 random lines, goodbye message.

#### Members
- "Members - N" list.
- Every bot when On shows "Look in this server" (Change: per-server name max 32 + picture), a sample message, its
  settings, the Free vs Plus table and Save ("Saved" state).
- Helper: !8ball !roll !flip !choose !afk !help, zero setup. Plus: own commands up to 25 (!rules, !socials), {user}.
- Levels: 15-25 XP per message, once a minute; level = sqrt(XP/100); !rank !top; toggle "Announce level-ups";
  dropdown "Announce where they're chatting" | #channel. Plus: XP boost 1.5x/2x, role rewards up to 20 levels,
  own level-up message.
- Logger: edits/deletes with old text, joins (flags brand-new accounts) and leaves, kicks/bans/unbans/timeouts with
  who, roles given/taken; one line each, never pings; "Pick the log channel" (quiet until set; warn: pick private).
  Plus: member events in own channel, exclude up to 25 channels.
- Starboard: react ⭐ or 🌟; threshold dropdown 1,2,3,4,5,7,10,15,20,30 stars (default 5); channel picker; images
  copied; own stars don't count; private channels skipped; never stars twice. Plus: custom emoji, self-star, exclude 25.
- Giveaways (staff = manage messages): !giveaway 1d Prize (s/m/h/d/w), !giveaway 2h 3w Prize, !gend, !greroll; react 🎉;
  up to 3 winners / 7 days (Plus 20 / 30 days, role-restricted entry); bots can't win, must still be member.
  Sample card: "🎉 GIVEAWAY 🎉 / prize / React with 🎉 to enter! / 1 winner · ends tomorrow · hosted by X".
- Tickets: panels (name max 40, e.g. Support/Reports/Appeals) each with: channel where panel is posted ("Post the
  panel" button with "Open a ticket" button), ticket category (default auto-made "Tickets"), log channel (No log | ch);
  + Add another panel (free 2, Plus 10); open tickets per person 1|2|3 (Plus 10); opener or any mod closes.
  Plus: support role per panel pinged, welcome message per panel, transcript in log on close.
- Alerts: YouTube channels (0 of 3; Plus 25), paste link, Post in… channel, Ping role (No ping | roles), Add; checks
  every 10 min, only new uploads; message placeholders {creator} {title} {url} {role}.
- Wordy: daily 5-letter word, six tries, same word for all, new at 00:00 UTC + recap; channel picker; /wordy,
  /wordy <guess>, /wordy stats; board 🟩🟨⬛ with letters hidden; streaks + top solvers.
- "Your own bot" opens user Settings > Developer (bots 2 free / 10 Plus, Login with Yapin' apps 10) = settings round.

#### Roles
- Header text, "Default permissions @everyone ›" row, note "Members use colour of highest role; drag or arrows",
  Create role, table ROLES - N | MEMBERS.
- Editor: left list (Back, +, roles with colour dots, @everyone), title "EDIT ROLE - NAME", Copy role ID, Delete role.
  Tabs Display | Permissions | Manage Members. Sticky bar "Changes are saved when you press Save" + Save.
- Display: name (32), colour swatches (purple, orange, amber, green, teal, blue, pink, grey, custom) + hex, Remove
  colour, "Fade into a second colour (optional)" (gradient role colour) + live name preview; Give this role
  automatically: Nobody | Everyone in the server | Everyone who joined before a date (auto roles are cosmetic, no
  permissions); toggle Let anyone @mention this role (Mention @everyone holders always can).
- Permissions (Clear permissions button), 31 toggles with one-line hints:
  General: Manage Channels, Manage Roles (below own), Manage Emoji, Manage Server, Manage Webhooks, View Audit Log,
  Create Invite, Change Nickname, Manage Nicknames.
  Membership: Kick Members, Ban Members, Timeout Members.
  Text: Send Messages, Embed Links, Attach Files, Send Voice Messages, Add Reactions (can still click existing), Use
  External Emoji, Create Polls, Use Big Text (# headings), Mention @everyone, Manage Messages, Create Threads, Send
  Messages in Threads, Manage Threads (close/lock/pin/rename/move/delete, post in locked), Read Message History.
  Voice: Connect, Speak, Mute Members, Move Members. Advanced: Administrator.
- Manage Members: Add Members, list ("Nobody has this role yet").

#### Onboarding
- Toggle Turn on onboarding (only new joiners; everyone can redo from server menu); toggle Must finish before chatting
  (read but not send); Starting channel: Same as usual | channels; Questions: Add question -> question text (100),
  Remove, toggle People can pick more than one, answers (emoji + text 60 + ✕ + "Gives:" role chips), Add answer. Flow:
  questions -> rules -> starting channel.

#### Bans
- Bans - N ("Nobody is banned. Peaceful."), Voice bans - N (separate voice ban list).

#### Reports
- Reports - N; member-reported messages; actions delete message, ban from server, dismiss; Open | Handled tabs; clear
  evidence cases (slurs, sexual images, many reporters) also escalate to platform admins.

#### Audit Log
- Kept 90 days. Filters: action (All actions, Channels, Roles, Roles given or taken, Bans, Unbans, Kicks, Timeouts,
  Server settings, Invites, Bots, Webhooks) and person (Everyone | members). Rows: avatar, "X made the #c channel",
  relative time, ▾ expands changed fields.

#### Lobby live editor (Customize button on lobby; replaces right side with a panel, page edits live in place)
- Header: "Customize lobby", Desktop | Phone switch, Preview (eye), ✕. Toggle Show the lobby to members.
- Tabs Templates | Look | Sections. Footer: "No changes yet"/change count, Cancel, Save. Canvas hint "Drag the cards to
  move them. Click one to edit it." Empty cards show placeholder text + a CTA button (Write it, Add questions, Open
  Bots, Set up Onboarding, Pick a rules channel, Add links).
- Templates (5, each a colour-bar thumbnail): Gaming (live voice up top), Study (calm, readable), Creators (banner and
  links), Hangout (warm), Minimal. Applying keeps your text/channels/buttons; starter FAQ only fills an empty FAQ.
- Look: Layout Classic (two columns) | Spotlight (centered one column) | Magazine (big hero, big tiles) | Compact;
  Accent Auto | custom colour; Background Glow | Mesh | Banner blur | Plain; Cards Filled | Glass | Outline;
  Font Default | Rounded | Serif | Mono | Display; Banner height Tall | Normal | Short; Title Left | Centered.
- Sections (ordered list, drag handles, each with Show switch and Main/Side tag for Classic's right column; status
  chips EMPTY / NOTHING YET):
  Top of the page (always first): tagline (120) + up to 4 buttons (link a site or channel; first is primary).
  About (2000 md) · Main channels (up to 6 in tap order; none = busiest) · Live now (voice channels with people) ·
  Giveaways (running ones from bot) · Feed (incoming webhook URL: apps POST JSON {title,text,url,image}, Discord
  webhook format works, https links, images only from allowed hosts YouTube/Twitch/Imgur…) · FAQ (up to 10) ·
  Leaderboard (Side; top 10; boards Levels | Messages this week | Invites, several = tabs) · Pick your roles (Side;
  from onboarding questions) · Rules (Side; button to rules channel) · Who runs it (Side) · Links (Side; from profile).

#### Create Channel (menu item, or + next to a category header)
- Title + "in <Category>". Type tiles Text | Voice | Discussion (forum). Name (100, placeholder new-channel / Gaming
  Lounge for voice).
- Private Channel switch -> "Who can access this channel?" role chips (owner + server managers always can).
- Text only: Read-only switch -> "Who can post?" role chips (others read + react); Slowmode Off|5s|10s|30s|1m|5m|15m|1h|6h
  (mods unaffected).
- Voice only: Stage switch (listeners can't talk until a mod brings them up, raise hand; Mute Members can always talk).
- Discussion: just name + private.

#### Edit channel (pencil on hover in the channel list; also Delete channel button there)
- Tabs Overview | Permissions | Webhooks.
- Overview (text): name, Private Channel, Text only (no pictures/files/GIFs except managers and mods), No GIFs (picker
  GIFs + GIF links refused; pictures OK; Manage Messages excepted), Read-only, Slowmode. Cancel / Save.
- Permissions: "Allow or deny stuff just here. Neutral uses role settings." Left: ROLES list (@everyone + added roles)
  and "+ Add a role" dropdown; right: role name, Search permissions, groups GENERAL (View Channel) and TEXT (Send
  Messages, Add Reactions, Attach Files, Send Voice Messages, Embed Links, Use Big Text, Mention @everyone, Manage
  Messages (+ skip slowmode), Create Threads, Send Messages in Threads, Manage Threads); each row ✕ / neutral / ✓.
- Webhooks: explainer (anyone with URL can post, keep secret), New webhook, Make a post, "0 of 10", list.
- Webhook row: avatar (upload), name (80; new ones get a random fun name), "Not used yet"/last used, URL shown once
  ("Copy it now, you won't see it again"), Copy, New URL (rotate), Delete (confirm: URL stops working, posted
  messages stay). Limit 10 per channel.
- "Make a post" = embed builder posting through a webhook (creates one if none): Post as (webhook) dropdown, 😀 Emoji,
  Import JSON / Copy JSON, Text above the boxes (2000), Boxes (embeds) with ↑ ↓ ✕: colour, title (256), text (4096,
  markdown), More: title link, author line (256), big picture URL, small picture URL (top right), footer (2048); Add
  heading; Add box; LINK BUTTONS (emoji, label 80, https URL) Add button; live PREVIEW (webhook name + BOT tag);
  Cancel / Post. Default sample is a Welcome box + a rules box + Terms/Guidelines buttons.

#### Server menu items (detail)
- Invite people: "Invite friends to <server>": search friends list with invite buttons, "or send a server invite link"
  field + Copy, "Your invite link never expires." (link yapin.gg/invite/<10 chars>).
- Lock Server: popover "Lock for how long? Nobody new can join and only mods can chat." 15 min | 1 hour | 8 hours |
  1 day | Cancel. (Server Profile offers 15 min / 1 hour / a day.)
- Change Nickname: "Only shown in this server. Leave empty to use the username." (32) Cancel/Save.
- Open a Ticket (appears when Tickets bot on): warning box (not for bugs/feedback/suggestions; link "Report a bug or get
  verified instead"), "What is it about?" textarea (300), must tick "This isn't a bug report, feedback or a
  suggestion", Cancel / Open ticket.
- Notification Settings: popover "Default for <server>": All messages (ping every message) | Only @mentions (you, your
  roles, replies) | Nothing (no pings; direct @you still badges). Mute Server separate item.
- Create Category: name (40, placeholder Information).
- Channel list rows: hover shows pencil (Edit channel) + trash (Delete channel). Category headers have +.
- Enabled bots are listed in the member list under "BOTS - N"; bot members' menu: Profile, Remove from server.
- Voice channel edit: same Overview incl. Stage, Text only, No GIFs, Read-only, Slowmode (voice channels have a text
  chat, "Open chat in <name>"); Permissions: GENERAL View Channel; VOICE Connect, Speak ("Off means they join muted");
  TEXT CHAT same text list. No webhooks tab.

#### Message context menu (in a server channel, as owner)
Add Reaction · Reply · Create thread · Edit message · Forward · Copy text · Copy message link · Translate ·
Reaction roles… · Pin message · Delete message.
- Reaction roles…: "React with the emoji, get the role. Take the reaction off, lose it." rows of role dropdown (Pick a
  role | roles) + emoji; "Add another one:" quick emoji ✅🎮🎨🎵📢🔴🟢🔵⭐🔥 + Pick an emoji; Cancel / Save.

#### Helper reply to !help
"Helper commands: !8ball question · !roll or !roll 2d6 · !flip · !choose a | b | c · !afk reason · !rank · !top"

#### Not seen yet (needs a second account in the community)
Kick / ban / timeout / voice-ban dialogs on a member, member role picker, Manage Members > Add Members flow,
"They apply, you approve" application queue, onboarding as a new member, ticket channel itself.

## 2. What Meldiq already has (API 0.66.1, `plans-v2` worktree; web `floating-redesign`)

Server evidence is from `meldiq_android/.claude/worktrees/plans-v2/server/src` (the main meldiq_android checkout is on
an old internal-beta commit).

| Area | Meldiq today | Gap |
| --- | --- | --- |
| Menu | Invite, Sparks, Settings (submenu), Create channel/category, Mute, Notifications (`ui/community/communityMenu.tsx`) | Settings is a submenu, not the wide window; no Promote, Bots, Lock, Change Nickname, Open a Ticket items |
| Invites | Up to 30 days (`contracts/http/orgs.ts:308`) | Never-expiring link, friends picker, vanity slug at 5 members |
| Profile | Icon, banner, name (80), community tag, public/private | Name 100, links, verification level, new-account gate, template from my community, discovery tags + 5-member rule |
| Lock / raid | "Pause joining" 1h/6h/24h/7d, activity alerts at 10 joins/10 min | Lock also limits chat to mods; 15 min/1 h/8 h/1 day; auto-lock (60 joins/min) and auto-slowmode (30 msgs/6 people/10 s) |
| Join | Join questions + applications | Same idea; keep |
| Rules channel | Have (rules list + must-agree) | Keep |
| Lobby | Community guide on Home (welcome, tasks, resources) | About (md 2000), main channels (6), FAQ (10), who runs it, header with counts, whole live editor (templates, look, sections, leaderboard, feed URL, giveaways, live now, pick your roles) |
| Theme | Accent presets + hex | Background tint, member opt-out in Appearance, readability nudge |
| Channels | Text, voice, forum, announcement; overwrites incl. per-member; slowmode (same 9 steps); archive | Stage, Text only, No GIFs, read-only "who can post" roles on any text channel, slowmode at create, 3-state permission rows with search |
| Webhooks | None | Per-channel webhooks (10), one-time URL, rotate, embed builder ("Make a post"), Manage Webhooks permission |
| Sparks (= Supercharge) | Levels 2/5/8 Sparks, $0.99 each, emoji 100/200/500 | Reference: 2/7/14 at $2.99, emoji 100/150/250 (pricing is an owner decision) |
| Promote | None (Discover sorts by members) | Paid Boost / Super / Mega + Promoted row (owner decision: prices, Stripe) |
| Emoji | Have, plus stickers | Check use in other communities and DMs |
| Official bots | None | Welcomer, Helper, Levels, Logger, Starboard, Giveaways, Tickets, Alerts, Wordy; per-community bot name/picture; Bots+ |
| Own bots | Have (`parity-devapps`, merged in plans-v2) | Community bot directory: browse, categories, sort |
| Roles | Create, colour, hoist, icons, templates, clone, archive, deny column | Gradient colour, auto-assign (everyone / joined before date), mentionable roles, reorder, @everyone row, Copy role ID |
| Permissions | 29 keys (`permissions/catalog.ts`) | Add: Manage Webhooks, Change Nickname, Embed Links, Add Reactions, Use External Emoji, Create Polls, Use Big Text, Create Threads, Send in Threads, Manage Threads, Read Message History, Mute Members, Move Members; make Manage Messages, Mention @everyone and Administrator real keys |
| Onboarding | Questions → roles and channels, required per question | Must finish before chatting, starting channel, redo from menu |
| Moderation | Bans, timeouts, reports (handle/dismiss), audit log with filters (~60 actions) | Voice bans, inline delete/ban on reports, audit field diffs, 90-day retention check |
| Reaction roles | None | Message menu → Reaction roles… |
| Tickets | None | Setting + bot panels + Open a Ticket |
| Nickname | Member "title" | Real per-community nickname |
| Notifications | All / mentions / none + more | Keep |

Meldiq-only features stay (Discord import, deny column, announcement channels, archive, role templates).

## 3. Build order

Server on a new meldiq branch `community-parity` from `plans-v2` (0.66.1 → 0.67.0); web on `floating-redesign`
(merge `landing-plans` first). Android follows each API batch.

1. **A, foundations.** Settings as the wide window with the reference rail; the 13 new permission keys and the
   3-state channel rows; per-community nickname; role gradient, auto-assign, mentionable, reorder; channel Stage,
   Text only, No GIFs, read-only roles, slowmode at create; voice bans; real lock + auto-lock + auto-slowmode;
   verification level; new-account gate; never-expiring and vanity invites; links; background tint + opt-out;
   onboarding must-finish + starting channel; menu items in the reference's order.
2. **B, lobby.** About, main channels, FAQ, who runs it, header; the live editor (templates, look, sections,
   leaderboard, feed URL).
3. **C, posting tools.** Channel webhooks, the embed builder, reaction roles, tickets.
4. **D, official bots.** One built-in bot runtime, then the nine bots with per-community look; Bots+ behind Mojo.
5. **E, discovery.** Tags, the 5-member rule, template from my community, community bot directory, Promote.

Owner decisions: Spark thresholds and price (keep 2/5/8 at $0.99 or match 2/7/14 at $2.99); Promote and Bots+
prices; a YouTube Data API key for Alerts. Not yet seen in the reference (needs a second account in the community):
kick/ban/timeout/voice-ban dialogs, member role picker, applying to join, onboarding as a new member, a ticket channel.
