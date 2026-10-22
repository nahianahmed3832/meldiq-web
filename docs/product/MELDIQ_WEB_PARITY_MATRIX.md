# Meldiq Web parity matrix (Android batches B1–B16)

Updated 2026-10-22. One row per behaviour. **The web is not at full parity:** rows marked *not started*, *specified*,
*implementing* or *blocked*, and every row's "Known limitations" column, name what is missing or unverified.

## Sources and how this was checked

- **Android specification:** `meldiq_android/docs/product/MELDIQ_SESSION_HANDOFF.md` (2026-10-21/22, batches B1–B14)
  and the Android source it names. Read only; that checkout was not edited.
- **Web:** branch `claude/meldiq-web-android-parity-a6333c` of meldiq-web, commits `3fc900e` … `726841a`, merged with
  `main` (`67de053`, adds `df66b32`/`e9f8d2b`). Poll end times and answer emoji (`dbf67ce`) were already in `main`.
- **Server used for tests:** a copy of the server repository's current code (API **0.24.0**), started in-process by the
  live tests and as a local server on port 8188 for browser checks. Production runs **0.25.0** (adds the B14 voice
  channel refusal, which the web already respects). No production server, database or deployment was touched.
- **Automated:** `vitest` full suite after the merge (unit tests port Android's rule tests; `live-*` tests run the web
  engine against the real server code, with the reference client playing the phone). Playwright call e2e (Chromium,
  local LiveKit, the native `griip-bot` peer): **6 of 6 passed** on 2026-10-22.
- **By hand:** the in-app browser against the local server, at desktop width and at 375 px (phone emulation).
- **Not done anywhere in this round:** a physical phone, a real Android device talking to this web build, production,
  Safari and Firefox by hand, and a 1 GiB upload over a real network.

### Status words

| Status | Meaning |
|---|---|
| not started | Nothing built on the web |
| investigating | Being looked into; behaviour not decided for the web |
| specified | Behaviour decided (from Android), not built |
| implementing | Partly built |
| implemented | Built; type-checked and linted, without its own automated test or hand check |
| tested | Built and covered by automated tests against the real server code and/or checked by hand locally (named in Tests) |
| blocked | Needs something outside the web (named) |

"Tested" never means a phone or production test.

## Matrix

Columns: **ID** · **Android** · **Web** · **UI changes** · **Backend changes** · **Data and permissions** · **Tests** ·
**Responsive** · **Status** · **Known limitations**.

### A. Sign-in and recovery

| ID | Android | Web | UI changes | Backend changes | Data and permissions | Tests | Responsive | Status | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| AUTH-01 Recovery choices only behind help links (B1) | Approved (phone-tested by owner) | Sign in shows only email and password; "Having trouble signing in?" and "Can't access your email?" lead to the choices | None this round (already matched) | None | Key backup unlock by emailed code; recovery codes | Existing auth tests; seen by hand 2026-10-22 (sign-in, unlock by code) | Stacks on phone width | tested | Not tried against production this round |
| AUTH-02 Intro pages | Communities and roles pages replaced connectors and HR (2026-10-21) | Same five pages and copy | `IntroPages.tsx`; tagline "Your people, on every screen" | None | None (per-browser "seen" flag) | Seen by hand | Full-screen | tested | — |

### B. Navigation and shell

| ID | Android | Web | UI changes | Backend changes | Data and permissions | Tests | Responsive | Status | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| NAV-01 Community rail order (B2) | Approved | Drag order synced to every device | Sidebar rail | None (nav preferences) | `/v1/me/preferences/:id` `railOrder` | `live-nav`, `community-rules` | Rail at all widths | tested | — |
| NAV-02 Community notification level and Ignore @everyone (B2) | Approved | Community menu › Notifications | `NotifyDialogs` | None | NavPrefs `community {level, suppressEveryone}`; receiver drops @everyone when set | `community-rules`, `live-nav` | Dialog | tested | — |
| NAV-03 Timed mutes, category levels, hidden channels (B3) | Approved | Channel and category menus; level resolution timed mute → own → category → community | `CommunityPanel`, `NotifyDialogs` | None | NavPrefs `mutedUntil`, `categoryNotify`, `hidden` | `community-rules`, `live-nav` | Menus | tested | — |
| NAV-04 Unreads view (B5) | Built, not phone-tested | Activity › Unreads grouped by community | `Activity` | None | Local unread state | unit (`unreadGroups`) | List | tested | — |
| NAV-05 Community wording | Communities replace workspaces | "Community details", "Start or join a community", "Invite your friends", Events, hints | `useCommunityServer()` | None | Server feature `community-channels` | Seen by hand (Home, Get started) | — | tested | Other workspace wording remains on servers without `community-channels` by design; a full sweep of every string was not done |
| NAV-06 Motion (B16) | Planned after B14 (not built on Android yet) | Panels slide in, tab content fades, category channels rise, mic/Send swap; dialogs and menus already rose | `motion.css` with `--t-*`/`--ease-*` tokens | None | None | Seen by hand; reduced motion via the existing `base.css` rule | Same at all widths | implemented | Android's B16 isn't built yet, so the web follows the shared tokens, not a finished Android spec; reduced-motion behaviour not checked by hand with the OS setting |

### C. Communities

| ID | Android | Web | UI changes | Backend changes | Data and permissions | Tests | Responsive | Status | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| COM-01 Create from a starter template (B2) | Approved | Create community dialog with templates | `CreateCommunityDialog` | None | `community-templates` | `live-community-structure`; by hand | Dialog | tested | — |
| COM-02 Discovery, preview, join, apply (B4b) | Built | Discover dialog, preview, join or apply with answers | `DiscoverDialog` | None | `community-discovery`, `join-applications` | `live-moderation`, `live-community-structure` | Dialog | tested | — |
| COM-03 Community settings groups | Built | Settings grouped as on Android | `WorkspaceView` `COMMUNITY_GROUPS` | None | Permissions from the server (`canManageOrg` etc.) | by hand | Full page | tested | — |
| COM-04 Reports (B4) | Built | Report message or member; moderators see reports without the reporter | `ReportDialog`, `ReportsPage` | None | Sealed reports; reporter never shown | `report-rules`, `live-moderation` | Dialog | tested | — |
| COM-05 Security actions, audit filters, invite choices (B4) | Built | Pause invites and DMs, audit filter chips, uses and expiry | `ModerationPages`, `AuditPage`, `InvitationsPage` | None | `security-actions`, owner/admin only | `live-moderation` | Pages | tested | — |
| COM-06 Bans, timeouts, join applications (B4b) | Built | People menu: timeout, ban; Applications page | `PeoplePage`, `BansPage`, `ApplicationsPage` | None | Server enforces; composer locks while timed out | `live-moderation` | Pages | tested | — |
| COM-07 Guide and onboarding questions (B8b) | Built | Guide card on Home, onboarding banner and dialog, settings pages | `GuideOnboarding`, `GuidePages` | **Gap:** onboarding changes aren't broadcast (no `org.updated`) | Answers may grant roles (server) | `guide-rules`, `live-forum-guide` | Cards | tested | Other members see onboarding edits only after a refresh (server) |
| COM-08 Community emoji and stickers (B9) | Built | Upload, rename, remove; picker section; stickers; images shown only if the SHA-256 matches | `ExpressionsPage`, `EmojiPicker`, `CustomEmoji` | None | Managers only (403 for members); `customEmoji`/`customSticker` refs inside E2EE payload | `expression-rules`, `live-expressions` | Grid | tested | — |
| COM-09 Community emoji reactions (B12) | Built | `:name:` reactions in community channels only | `ReactionEmoji` | None | Receiver rejects `:name:` outside communities | `live-expressions` | — | tested | — |
| COM-10 Role hoist and member groups (B12) | Built | Hoisted roles group the member list | `RoleEditor`, `PeoplePage` | None | `role-hoist` | unit (`memberGroups`) | List | tested | — |

### D. Categories and channels

| ID | Android | Web | UI changes | Backend changes | Data and permissions | Tests | Responsive | Status | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| CH-01 Categories: create, rename, move, delete, collapse | Approved | Category menu; layout saved with `PUT /v1/orgs/:id/layout` | `CategoryDialogs`, `CommunityPanel` | None | Manage channels permission | `community-rules`, `live-community-structure`; by hand | Sidebar | tested | — |
| CH-02 Channel types and permission overwrites | Approved | Text, announcement, forum, voice; allow / inherit / deny per role | `ChannelDialogs`, `PermissionsDialog` | None | Overwrites enforced by the server | `community-rules`, `live-community-structure` | Dialogs | tested | — |
| CH-03 Slowmode with countdown (B3) | Approved | Composer countdown; outbox retries after the wait | `Composer`, outbox | None | `slowmode`; server enforces | `community-rules`, `live-moderation` | — | tested | — |
| CH-04 Channel browser (B3) | Approved | Browse channels | `CommunityPanel` | None | Visible channels only | `live-community-structure` | Dialog | tested | — |
| CH-05 Forums: guidelines, tags any/all, top reaction, follow (B8) | Built | Forum view, New post, Follow in the thread | `ForumView`, `SidePanel` | None | Title/tags inside E2EE payload | `forum-rules`, `live-forum-guide`; by hand | Cards | tested | Post list is built from this browser's newest 2,000 messages |
| CH-06 Threads list and message links (B5) | Built | Threads panel; copy message link; links open in the app | `ThreadsPanel`, `messageLinks`, `inAppLinks` | None | — | `message-links`, unit | Panel | tested | — |
| CH-07 Voice channels have no messages (B14) | Built (API 0.25.0 refuses them) | Note in place of the composer | `ConversationView` (`df66b32`, merged) | Production 0.25.0 refuses | — | by hand 2026-10-22 | — | tested | — |
| CH-08 Voice channel as a room page (B14) | Built: tiles, Join voice, Invite people, notices | Room page in place of the message list: who's in it (one tile full width, more two by two), Join voice or Open the call, Invite people, listen-only and no-permission notes, why Join is off; no search, pins or message box | `VoiceRoomView`, `voiceRoomRules` (replaces `VoiceRoomBanner`) | None | `voice.connect`, `voice.speak`; the server refuses messages (0.25.0) | `voice-room.test.ts`; e2e `voice-room.spec.ts` (Chromium and phone width: a native peer in the room, join, key exchange, Open the call) | Tiles two across at every width | tested | Tiles weren't looked at by hand with people in them (the local hand-check server has no calling); Invite people opens the community's invitations page, which needs the invite permission |

### E. Friends and people

| ID | Android | Web | UI changes | Backend changes | Data and permissions | Tests | Responsive | Status | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| FR-01 Connections (B6) | Built | Connections dialog: add, accept, remove | `ConnectionsDialog` | None | `connections` | `social-rules`, `live-social` | Dialog | tested | — |
| FR-02 Message requests and who may message you (B6) | Built | Request bar, requests list, Privacy › Messaging | `RequestBar`, `PrivacyPage` | None | `message-requests`; server decides | `live-social` | — | tested | — |
| FR-03 Presence modes, group photos (B6b) | Built | Presence dialog, group photo card | `StatusDialogs`, `GroupPhotoCard` | None | `presence-modes`, `group-photos` | `live-social` | — | tested | Do not disturb pausing notifications on a second device not checked (same as Android) |
| FR-04 Pronouns and profile card (B12) | Built | Profile page and profile dialog | `ProfilePage`, `ProfileDialog` | None | `pronouns` | `live-social` | Dialog | tested | — |

### F. Direct messages and groups

| ID | Android | Web | UI changes | Backend changes | Data and permissions | Tests | Responsive | Status | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| DM-01 Minimal header (B14) | Built | Avatar and name (open details), voice, video, search, one overflow (pins, security, details); channels unchanged | `ConversationView`, `ConversationMenu` | None | — | by hand at 1024 px and 375 px | Back arrow on phone | tested | — |
| DM-02 One-row composer (B14) | Built | + (attach menu), field, emoji, @ (wide screens), mic → Send | `Composer` | None | — | by hand; existing composer tests | @ hidden on phone | tested | Emoji sits beside the field, not inside it |
| DM-03 Details tabs with counts (B14) | Built: Members (groups) · Media · Pins · Links · Files | Same tabs: a group opens on Members, a DM on Media (no Members tab); settings below the tabs | `ConversationDetails`, `DetailsTabs`, `detailsRules` | None | Read from this browser's loaded messages | `gallery.test.ts`, `details-rules.test.ts`; by hand at 400 px: DM and group, Links | Tabs scroll sideways on phone; no page scroll | tested | Media, Files and Pins checked only empty; counts cover the loaded page of messages |
| DM-04 Details round actions Search · Mute · Profile/Add · Security (B14) | Built | Header (photo, name, @username or member count, presence) and round actions: Search, Mute/Unmute, Profile (DM) or Add (group managers), Security; Media, Files, Pins and Links open the message in the chat | `DetailsActions`, `DetailsHero`; `muteToggle` | None | Mute is the synced notification level (ends a timed mute; turns on when the community or category is off) | `nav-prefs.test.ts` (`muteToggle`); by hand: Mute and Unmute, Profile, Security, Add | Four or five across, fits 400 px | tested | — |
| DM-05 New group with this person (B14) | Built | Under the actions in a DM: New group, person pre-added | `NewGroupDialog initial` | None | — | by hand: a group created from it with the person in it | Dialog | tested | — |
| DM-06 Timeline media sizing and quiet call notes (B14) | Built | Not changed | — | — | — | — | — | not started | — |
| DM-07 Poll end times and answer emoji (B8) | Built | Same rules (`dbf67ce`, another session) | Polls | None | Inside E2EE payload | Poll tests in the suite | — | tested | — |
| DM-08 Long reply quotes on a phone | — | Fix: quote shortens instead of widening the message | `conversation.css` | None | — | by hand at 375 px | — | tested | — |

### G. Attachments

| ID | Android | Web | UI changes | Backend changes | Data and permissions | Tests | Responsive | Status | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| ATT-01 Files up to 1 GiB (B7) | No code change (checked) | Chunked encrypted uploads (`files-1g`, `chunked-attachments`) | None this round | None | Keys stay on devices; storage presigned by the server, no credentials in the browser | `large-files`, `live-large` | — | tested | A real 1 GiB upload over a real network is the owner's test; S3 CORS for production was pending |
| ATT-02 Files storage on MongoDB/AWS | — | — | — | **Gap:** the files domain isn't on MongoDB yet (server) | — | — | — | blocked | Server work |

### H. Emoji, reactions and stickers

Covered by COM-08 and COM-09; the full Unicode picker (search, categories, recent, skin tone) was already on `main`.

### I. Voice, video and screen share

| ID | Android | Web | UI changes | Backend changes | Data and permissions | Tests | Responsive | Status | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| CALL-01 Deafen (B10) | Built | Deafen pill; mic restored only if it was on; kept after reconnect | `CallStage`, `manager` | None | — | `call-controls`; e2e deafen (Chromium) passed | Pill row wraps | tested | Firefox and Safari not tried |
| CALL-02 Noise reduction (B10) | Built | Settings › Calls, from the next call | `CallsPage`, prefs | None | Per browser | `call-controls` | Page | tested | Quality depends on the browser's own processing |
| CALL-03 Pre-call check (B10) | Built | Level meter and camera preview; nothing sent | `CallsPage` (`PreCallCheck`) | None | Devices released on stop | `call-controls` (`micLevel`); page seen by hand | Page | implemented | The check itself wasn't run by hand (it asks for camera and microphone) |
| CALL-04 Camera switch front/back (B10) | Built | Not built | — | — | — | — | — | not started | Browsers list devices rather than front/back; a device picker would be the web form |
| CALL-05 Reconnect (B10) | Built | Existing reconnect | — | None | — | e2e "survives losing the network" passed | — | tested | — |
| CALL-06 Screen share modes and sound (B11) | Built | Text and apps / Motion and video; tab or system sound where offered; stop from the browser bar ends cleanly | `ShareDialog`, `livekitSession` | None | — | `call-controls` | Dialog | tested | Shared sound only where the browser offers it (Chromium); not checked by hand on a real screen share |
| CALL-07 Listen-only voice channels | Built | No microphone opened without `voice.speak`; no join without `voice.connect` | `manager`, `engine` | None | Server permissions | unit; e2e listen-only path | — | tested | — |
| CALL-08 Calls from the phone app | Built | Existing | — | None | E2EE media | e2e "video call from the phone app" | — | tested | Known intermittent: can stick at "Verifying encryption…" (passed this run) |

### J. Platform, admin and AI readiness

| ID | Android | Web | UI changes | Backend changes | Data and permissions | Tests | Responsive | Status | Known limitations |
|---|---|---|---|---|---|---|---|---|---|
| ADM-01 Super-admin controls hidden from community admins | Built | Service health and platform pages only for platform admins | — | None | Server checks platform admin | Existing tests (`makePlatformAdmin`) | — | tested | — |
| AI-01 No E2EE content to AI without consent | Consent per request (round 7 C8) | Same consent design, unchanged | — | None | Nothing sent without consent | Existing tests | — | tested | No new AI feature this round |
| PLAT-01 Web Push | Phone notifications | Notifications only while a tab is open | — | Needs a Web Push service | — | — | — | blocked | Server and service work |
| PLAT-02 Dates and interface in your language (B12) | Built (dates) | English only | — | — | — | — | — | not started | — |

## Open items, in order

1. DM-06 timeline media sizing and quiet call notes (the last B14 item on the web).
2. CALL-04 camera choice in a call; run the pre-call check by hand.
3. Server: broadcast onboarding changes; files domain on MongoDB; Web Push.
4. Owner checks: a phone with this web build, Safari and Firefox, a 1 GiB upload on a real network, production after an
   approved deployment.
