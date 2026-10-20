# Meldiq Web ↔ Android feature parity

Updated 2026-10-20 (second pass: Android round 7 and the remaining `35aa4b5` gaps; third pass: round 7 slices C1–C8, section R7; see `MELDIQ_ANDROID_WEB_SYNC_REPORT.md` for the S-numbers). It replaces the 2026-10-19 version of this file; `ORBIT_WEB_PARITY.md` still holds older detail.

## Sources

- **Android app:** `internal-beta` at `35aa4b5` in the server repository (github.com/nahianahmed3832/griip-mesage). Every
  screen under `android/app/src/main/java/com/meldiq/android/ui` and the rules and repositories behind them were read
  (read-only `git show`; the shared checkout wasn't touched).
- **Server:** API **0.7.1**, the build in production since 2026-10-20 (deployed by another session, with the WebSocket
  first-frame patch). The live tests below run against that server's own code, started in-process.
- The server's `docs/FEATURE_INVENTORY.md` is a 2026-10-16 audit and predates most of these screens, so this inventory
  was built from the app itself.

## How to read the tables

**Android** says what the phone has: **Implemented**, **Partial** (the phone's own limit is named), or **Planned** (shown
as "coming soon", nothing built).

**Web** says what the browser has:

| Status | Meaning |
|---|---|
| **Done** | Built, and tested against the real server |
| **Built** | Implemented; the limits of its testing are stated |
| **Partial** | The named part is missing |
| **Unsupported on web** | Deliberately not offered in a browser, with the reason |
| **Backend blocked** | Needs a server change, which is named |
| **Missing** | Not built |

**Verified** is the strongest evidence for the row:

| Level | Meaning |
|---|---|
| **live** | Vitest against the real server, with the server's reference client playing the phone (byte-compatible with Android) |
| **browser** | Playwright in Chromium, Firefox, WebKit and phone-width Chromium |
| **unit** | Unit test, often the phone's own cases |
| **by hand** | Looked at in the running app |
| **device** | Against the real Android app on a phone. **No row has this level**: the physical-phone test is still pending |

Two browser tabs or the reference client are not proof of interoperability with a physical phone; they prove the
protocol, which the phone shares.

"**New**" marks what the 2026-10-20 round added.

## ACC · Accounts, devices and sessions

| ID | Feature | Android | Backend | Web | Gaps, security | Tests | Verified |
|---|---|---|---|---|---|---|---|
| ACC-01 | Sign up, verify email, sign in, refresh | Implemented · `StartScreens`, `AccountRepository` | `/v2/auth/*` | Done | scrypt, hashed codes, rotating refresh tokens | `live-accounts`, `e2e/accounts` | live, browser |
| ACC-02 | Set up this browser with the recovery key | Implemented · `DeviceSetupScreens` | `POST /v2/account/devices` | Done | Key checked locally, never sent; a setup ended elsewhere returns to sign-in | `live-accounts`, `e2e/accounts` | live, browser |
| ACC-03 | Set up by approving on the phone | Implemented · `ProfileScreens` › Approve | `/v1/pairing*` | Done | Seed sealed with HPKE to this browser | `live` | live |
| ACC-04 | Returning browser signs in with device proof | Implemented · `AccountRepository` | `/v2/auth/login` + `device` | Done | — | `live-accounts` | live |
| ACC-05 | Forgot / reset password | Implemented · `StartScreens` | `/v2/auth/password/*` | Built | Reset revokes all sessions | `e2e/accounts` (request step) | browser |
| ACC-06 | **New:** Account recovery with a recovery code (lost email) | Implemented · `AccountRecoveryScreens` | `/v2/auth/recover/start`, `/complete` (`recovery-codes`) | Done | Restores account access only, never the encryption keys (the page says so). Wrong or used codes refused; rate limits are the server's | `live-accounts` › recovery codes (synthetic codes) | live |
| ACC-07 | **New:** Recovery codes: count, make a new set, revoke | Implemented · `RecoveryCodesSettings` | `/v2/account/recovery-codes` | Done | Behind the password; codes shown once (copy, download), never logged | `live-accounts` | live |
| ACC-08 | **New:** Sign in again after the account's email changed | Implemented | `/v2/auth/login` | Done | The new email is saved to this browser's record | `live-accounts` | live |
| ACC-09 | Change password, rename account | Implemented · `AccountSettings` | `/v2/account/*` | Built | Other sessions revoked | — | by hand |
| ACC-10 | Sessions list, end a session | Implemented · `AccountSettings` | `/v2/account/sessions` | Done | — | `live-accounts` | live |
| ACC-11 | Move a pre-2.0 account | Implemented · `LegacyMoveScreens` | `/v2/migration/legacy/*` | Done | Identity-key signature, single-use ticket | `live-accounts` | live |
| ACC-12 | Devices, remove a device; a removed browser signs out | Implemented · `ProfileScreens` | `/v1/devices`, `devices.changed` | Done | — | `live`, `e2e/cross-device` | live, browser |
| ACC-13 | Start fresh (new identity) | Implemented · `DeviceSetupScreens` | `/v2/account/identity/reset` | Unsupported on web | Destroys history on every device; kept to the phone | — | — |
| ACC-14 | Several accounts or servers in one app | Implemented · `ServersScreen` | — | Unsupported on web | One account per browser profile: keys live in that profile's storage. Use another profile | — | — |
| ACC-15 | Legacy username sign-up | Implemented · `SignUpScreen` | `/v1/auth/register` | Unsupported on web | Being retired | — | — |
| ACC-16 | **New:** First-run introduction, replayable from About | Implemented · `IntroScreen` | — | Built | Shown once per browser (local convenience); nothing asks for permissions | — | by hand (Chromium: five pages, Coming soon, Get started) |

## WS · Workspaces and administration

| ID | Feature | Android | Backend | Web | Gaps, security | Tests | Verified |
|---|---|---|---|---|---|---|---|
| WS-01 | Switch workspace; selection follows the account | Implemented · `WorkspaceSwitcher` | `/v2/workspaces`, `/v2/account/preferences` | Done | — | `live-nav` | live |
| WS-02 | Create, join with a code, leave, delete | Implemented · `NewActions`, `JoinWorkspace` | `/v1/orgs*`, `/v1/invites/*` | Done | QR scanning is phone-only (codes can be typed) | `live-workspace` | live |
| WS-03 | Name, description, photo | Implemented · `WorkspaceSettings` | `PATCH /v1/orgs/:id`, `/photo` | Done | — | `live-workspace` | live |
| WS-04 | Members, base roles, titles, removal | Implemented · `RoleViews` | `/v1/orgs/:id/members*` | Done | Every refusal comes from the server | `live-workspace` | live |
| WS-05 | Invitations | Implemented · `ManageSheets` | `/v1/orgs/:id/invites` | Done | — | `live-workspace` | live |
| WS-06 | Branches, teams, departments | Implemented · `ScopeAdminViews` | `/v1/branches`, `/v1/teams`, `/v1/departments` | Done | — | `live-workspace` | live |
| WS-07 | Channels: create, access, archive, browse, join, leave, rename, add people | Implemented · `ChannelDetailsSections` | `/v1/orgs/:id/channels`, `PATCH /v1/conversations/:id` | Done | — | `live-workspace`, `live-manage` | live |
| WS-08 | **New:** Custom roles: catalogue, templates, create, edit on revision, archive, delete, assign | Implemented · `RolesScreen`, `RoleEditorSheet` | `/v1/orgs/:id/roles`, `/v1/roles/:id*` (`custom-roles`) | Done | Anti-escalation is the server's: the editor offers only what you hold; a stale revision is refused (409 `stale`); members get 403 | `live-roles-apps` | live |
| WS-09 | **New:** Audit log, filtered, paged | Implemented · `AuditScreen` | `/v1/orgs/:id/audit` | Done | `audit.view` only; never message content | `live-roles-apps` | live |
| WS-10 | **New:** Transfer ownership | Implemented · `TransferOwnershipSheet` | `/v1/orgs/:id/ownership` | Done | Exact workspace name; the previous owner becomes an admin | `live-roles-apps` | live |
| WS-11 | **New:** Usage and limits | Implemented · `UsageScreen` | `/v1/orgs/:id/usage`, `/plan` | Done | `workspace.usage.view`; no plan exists, so none is offered | `live-roles-apps` | live, by hand |
| WS-12 | Workspace change log (Activity) | Implemented · `ActivityFeedScreen` | `/v1/orgs/:id/activity` | Done | — | `live` | live |
| WS-13 | Invitation QR code; invite links and shared messages accepted when joining | Implemented · `OrgScreens.qrBitmap`, `InviteCodes` | — | Done (sync S-11) | QR in the phone's link format; look-alike characters refused | `invite-codes` | unit, by hand (QR decoded) |
| WS-14 | Public channels reach every member; an unjoined channel joins on a click (round 7 bug 6) | Implemented · `WorkspaceScreen`; server default | `autoJoin` | Done (sync S-03) | Existing opt-in channels need the server's repair command | `live-roles-apps` | live |

## HOME · Home, people and navigation

| ID | Feature | Android | Backend | Web | Gaps, security | Tests | Verified |
|---|---|---|---|---|---|---|---|
| HOME-01 | Home, DMs, Activity; unread and mention counts | Implemented · `WorkspaceHomeScreen` | — | Done | — | `live`, `e2e` | live, browser |
| HOME-02 | Starred, custom sections, collapsed, notification levels (synced) | Implemented · `HomeCustomSections` | `/v1/me/preferences/:id` | Done | — | `live-nav` | live |
| HOME-03 | Archive, mark read/unread (this device) | Implemented · `ChatActionsSheet` | — | Done | — | `live-nav` | live |
| HOME-04 | **New:** Drafts & sent | Implemented · Home › Drafts & sent | — | Done | This browser's drafts and sent messages only | `live-rich` | live |
| HOME-05 | **New:** Get started checklist | Implemented · `HomeStart` | — | Built | Checked off from real state; hidden per browser | `ui-logic` (the phone's rules) | unit, by hand |
| HOME-06 | Find people: name, @username, phone number, `@name:server` | Implemented · `ContactsScreen` | `/v1/users/*`, `/v1/federation/resolve` | Done (federation Built) | Production has federation off | `lookup`, `live` | live, unit |
| HOME-07 | Search: conversations, people, messages | Implemented · `SearchScreen` | `/v1/users/search` | Done | Message text is searched locally (E2EE) | `live`, by hand | live |
| HOME-08 | **New:** Search in one conversation | Implemented · `ConversationViewModel` search | — | Done | Local only; a result loads older pages to show it in place | `live-rich` | live, by hand (match highlighted, jump focuses the message) |
| HOME-09 | Activity: mentions, missed calls, thread replies, change log | Implemented · `ActivityFeedScreen` | — | Done | — | `live`, `threads` | live |

## MSG · Messaging

| ID | Feature | Android | Protocol | Web | Gaps, security | Tests | Verified |
|---|---|---|---|---|---|---|---|
| MSG-01 | Send, receive, history, replies, threads, edit, delete, reactions, pins, mentions | Implemented · `ConversationScreen` | envelopes, controls | Done | — | `live`, `live-actions`, `e2e` | live, browser |
| MSG-02 | Receipts, typing, presence | Implemented | `receipt`, `typing`, `presence` | Done | — | `live` | live |
| MSG-03 | **New:** Polls: create, vote, change vote, close (creator only), results | Implemented · `Polls` | payload `poll`; controls `vote`, `poll_close` | Done | Limits as `PollRules`; a non-creator's close and votes on a closed poll are ignored; forwarded polls drop votes | `polls-stickers`, `live-rich` | live (both ways) |
| MSG-04 | **New:** Stickers: picker, send, receive | Implemented · `Stickers` | payload `sticker` | Done | The shared catalogue file, unchanged; a malformed reference falls back to text | `polls-stickers`, `live-rich` | live (both ways) |
| MSG-05 | Animated emoji | Implemented · `RichViews` | payload `animoji` | Done | Respects reduced motion | `live-extras` | live |
| MSG-06 | Link warnings | Implemented · `LinkRules`, `LinkOpener` | — | Done | — | `link-rules` | unit |
| MSG-07 | **New:** Music and video cards (YouTube, Spotify, SoundCloud, Vimeo) with an on/off setting | Implemented · `MediaCards`, `MediaLinks` | — | Done | Recognised from the address only; nothing fetched, no embedded player | `media-links` (the phone's rules) | unit, by hand |
| MSG-08 | Sending link previews | Implemented · `LinkPreview` | payload `link` | Backend blocked | Received previews show. Making one needs a server-side fetcher (a browser can't read other sites) | — | — |
| MSG-09 | Contact cards as Meldiq **profile cards** (round 7: name, user id, username, never numbers); locations | Implemented · `ProfileCards`, `RichRules` | `contact`, `location` | Done (sync S-01) | Old cards with numbers still show; a profile card's numbers are dropped | `profile-cards`, `live-rich`, `live` | live, by hand |
| MSG-10 | Forwarding | Implemented | `forwarded` | Done | Files re-encrypted | `live` | live |
| MSG-11 | Voice messages | Implemented · `VoiceViews` | attachment `voice` | Done | Recording checked by hand | `live` | live |
| MSG-12 | Identity change hold, review, safety numbers | Implemented | — | Done | — | `live` | live |
| MSG-13 | **New:** Conversation security sheet (padlock) | Implemented · `ConversationSecuritySheet` | — | Done | Only facts that apply; the browser always encrypts call media | `conversation-security` (the phone's rules) | unit, by hand |
| MSG-14 | Block / unblock | Implemented · `PrivacyScreen` | `/v1/blocks` | Done | — | `live-manage` | live |
| MSG-15 | Message text size | Implemented | — | Done | — | unit | unit, by hand |
| MSG-16 | Chat wallpaper | Implemented | — | Unsupported on web | The web keeps the design-system surface | — | — |
| MSG-17 | Translation of received messages on the device | Implemented · `MessageTranslator` (ML Kit) | on-device | Built (sync S-10) | Only where the browser has an on-device translator (Chromium's built-in); otherwise not offered. No real translation seen yet: the test browser couldn't load a model | `translate` | unit |
| MSG-18 | Swipe to reply | Implemented · `SwipeToReply` | — | Unsupported on web | Reply is in the message menu | — | — |
| MSG-19 | Message info (status, sent, relay, delivered to, read by, encryption) | Implemented · `ConversationScreen` | receipts | Done (sync S-09) | — | `live` (receipts) | by hand |
| MSG-20 | Pin button in the header, pinned list with jump and unpin (round 7) | Implemented · `PinnedMessages` | pin controls | Done (sync S-06) | Ordered by message time | `live-rich` | live, by hand |
| MSG-21 | Message layout: stream or bubbles | Implemented · `MessageLayout` | — | Done (sync S-14) | — | — | by hand |
| MSG-22 | Composer buttons step aside while typing (round 7) | Implemented · `ComposerAux` | — | Unsupported on web (sync S-08) | Desktop has room; not adopted | — | — |

## LATER · Saved items and reminders

| ID | Feature | Android | Backend | Web | Gaps, security | Tests | Verified |
|---|---|---|---|---|---|---|---|
| LATER-01 | **New:** Save for later, mark done, remove; synced | Implemented · `LaterScreen` | personal preferences document (`saved-items`) | Done | The list is only changed on purpose; other preference writes keep it | `live-later` | live (both ways) |
| LATER-02 | **New:** Reminders: create, edit, snooze, complete, dismiss, repeat | Implemented · `RemindersScreen`, `ReminderEditor` | `/v1/reminders*` (`reminders`) | Done | Sealed with the account's reminder key (AES-256-GCM, HKDF of the identity seed): the server can't read them; the phone can | `live-later`, `reminder-rules` (node-crypto interop) | live |
| LATER-03 | **New:** A saved message with a time gets the phone's server reminder | Implemented · `syncLater` | `/v1/reminders` | Done | Same id derivation as the phone | `live-later` | live |
| LATER-04 | **New:** Reminders go off in the browser, once | Implemented | `reminder.due` | Done | System notification only with the tab open (no Web Push) | `live-later` | live |
| LATER-05 | **New:** Browsers set up before reminders: unlock with the recovery key | — (phones derive at setup) | — | Done | A wrong account's key is refused | `live-later` | live |

## FILE · Files and media

| ID | Feature | Android | Backend | Web | Gaps, security | Tests | Verified |
|---|---|---|---|---|---|---|---|
| FILE-01 | Encrypted files, images, video; up to 10 per message; chunked up to 1 GB | Implemented · `AttachPanel`, `BatchComposer` | `/v1/attachments*`, `/uploads*` | Done | **Production needs the S3 CORS rule** for direct browser parts | `live-large`, `large-files` | live |
| FILE-02 | **New:** Album grid for several photos, viewer steps through them | Implemented · `AlbumGrid` | — | Done | — | `media-links` › albums (the phone's layout) | unit, by hand (two photos, viewer steps 1 of 2 → 2 of 2) |
| FILE-03 | **New:** Photo quality Standard / HD / Original | Implemented · `BatchComposer` | — | Built | Standard and HD re-encode upright, so metadata (location) isn't sent; GIFs never re-encoded; Original says it keeps details. Video compression: phone only | `photo-quality` | unit, by hand (Chromium: 3000×2000 → 1600×1067 and 2400×3200 → 1200×1600, sent as .jpg) |
| FILE-04 | Media and files of a conversation | Implemented · `MediaGallery` | — | Done | — | `gallery` | unit, by hand |
| FILE-05 | Storage | Implemented · `StorageScreen` | — | Done | — | — | by hand |
| FILE-06 | Camera capture, QR scanning, share from other apps | Implemented | — | Unsupported on web | Files can be picked, pasted or dropped | — | — |
| FILE-07 | Bulk save: select files, save them to a folder (round 7) | Implemented · `BulkSave`, `BulkSaver` | per-file download | Done (sync S-07) | Folder picker in Chromium; downloads elsewhere; existing files never overwritten | `bulk-save`, `live-rich` | live, by hand (selection) |
| FILE-08 | Download photos automatically (on/off) | Implemented · `AutoDownload` | — | Done (sync S-13) | No "Wi-Fi only": desktop browsers don't say | — | by hand |

## CALL · Calls and voice rooms

| ID | Feature | Android | Backend | Web | Gaps, security | Tests | Verified |
|---|---|---|---|---|---|---|---|
| CALL-01 | 1:1 and group calls, ring, answer, decline, busy; E2EE media and verification code | Implemented · `CallManager`, `CallOverlay` | `/v1/calls*`, LiveKit | Built | No unencrypted fallback | `call-live`, `call-keys`, `e2e/calls` | live, browser (LiveKit native SDK as far side). **Not device-verified** |
| CALL-02 | Screen sharing, device choice, minimised call | Implemented | LiveKit | Built | — | `e2e/calls` | browser |
| CALL-03 | Call history, missed calls | Implemented · `CallsScreen` | `/v1/conversations/:id/calls` | Done | — | `live`, `messaging-extras` | live |
| CALL-04 | **New:** Voice rooms: create, Home › Voice rooms with who's in each, banner, Join; nobody rings | Implemented · `VoiceRooms` | `voice` channels, `/v1/calls` (`voice-rooms`) | Done | Not an announcement channel; no call entries in the room's history | `live-voice-rooms` | live, by hand (create, Voice rooms list, banner; Join needs a media server, so not clicked by hand) |
| CALL-05 | **New:** Raise hand, queue in order | Implemented · `CallOverlay` | `/v1/calls/:id/hand` | Done | — | `live-voice-rooms` | live |
| CALL-06 | **New:** Moderation: mute microphone, lower hand, remove (room managers) | Implemented · `PeoplePanel` | `/v1/calls/:id/moderate` | Done | Server checks `canManageConversation`; only the person can unmute | `live-voice-rooms` (stand-in media server) | live |
| CALL-07 | **New:** A room's key passed on by anyone connected | Implemented · `CallKeyVerifier` | — | Done | Accepted only from the creator or someone the server lists as connected, in the room's conversation; first key wins | `call-keys`, `live-voice-rooms` | live, unit |
| CALL-08 | Faster call setup: key sent alongside connecting, join and key wait in parallel (round 7 bug 7) | Implemented · `CallManager` | — | Done (sync S-04) | Not timed | `call-setup`, `call-live` | live, unit |
| CALL-09 | Mirror only your own front camera (round 7 bug 3) | Implemented · `CallMediaPolicy` | — | Built (sync S-05) | Back camera not tried on a phone browser | `call-rules` | unit |
| CALL-10 | No call buttons in text channels (round 7) | Implemented · `ConversationScreen` | 409 `text_channel_no_calls` (undeployed) | Done (sync S-02) | — | e2e calls | browser, by hand |

## APP · Apps and integrations

| ID | Feature | Android | Backend | Web | Gaps, security | Tests | Verified |
|---|---|---|---|---|---|---|---|
| APP-01 | **New:** App directory, states, install, request, decline, turn off/on, uninstall | Implemented · `AppsScreen`, `AppDetailScreen` | `/v1/orgs/:id/integrations*` (`integrations`) | Done | Credentials never reach the browser | `live-roles-apps` | live |
| APP-02 | **New:** Incoming webhooks: create (secret once), rotate, delete | Implemented · `HooksCard` | `/v1/orgs/:id/integration-hooks*` | Done | Secret shown once; a rotated secret stops the old one | `live-roles-apps` | live |
| APP-03 | **New:** Workflows list | Implemented · `WorkflowsPanel` | `/integrations/workflows` | Built | — | — | by hand |
| APP-04 | **New:** App updates in a channel, live | Implemented · `AppUpdates` | `/v1/conversations/:id/integration-events`, `integration.event` | Done | Server-visible, labelled so (not E2EE). Fixed: event ids are strings | `live-roles-apps` | live |
| APP-05 | Connect your own account to an app (OAuth) | Implemented · `AppDetailScreen` | `INTEGRATIONS_APP_RETURN_URL` | Backend blocked | The server returns to `meldiq://integrations` only; a browser needs a per-client return such as `https://web.meldiq.app/#/…` | — | — |
| APP-06 | Share an item from a connected app | Implemented · `ShareFromApp` | provider search | Backend blocked | Needs APP-05 | — | — |

## SET · Profile, privacy, notifications, settings

| ID | Feature | Android | Backend | Web | Gaps, security | Tests | Verified |
|---|---|---|---|---|---|---|---|
| SET-01 | Profile, photo, privacy (who sees and finds you) | Implemented · `EditProfileScreen`, `PrivacyScreen` | `/v1/users/me*` | Done | — | `live` | live |
| SET-02 | Notifications with a tab open; synced levels | Implemented | — | Done | — | by hand | by hand |
| SET-03 | Background notifications (no tab open) | Implemented · UnifiedPush / FCM | `/v1/devices/current/push` | Backend blocked | Needs Web Push (VAPID) on the server | — | — |
| SET-04 | Appearance: theme, colours, text size, animated emoji, music and video cards | Implemented | — | Done | — | unit | unit, by hand |
| SET-05 | Languages (Simplified Chinese, Bengali) | Implemented · `AppLanguage` | — | Missing | English only | — | — |
| SET-06 | Encrypted backup and restore | Implemented | — | Unsupported on web | The browser restores the server's encrypted history | — | — |
| SET-07 | Notification health checks (battery, OEM) | Implemented · `NotificationHealthViews` | — | Unsupported on web | Android-specific | — | — |
| SET-08 | Notifications: group notifications, message sound, call ringtone | Implemented · `SettingsStore` | — | Done (sync S-12) | Sound is the system notification's | `live-rich` | live, by hand |
| SET-09 | Links: ask every time | Implemented · `LinkOpening.ASK` | — | Done (sync S-13) | Opening "in the app" doesn't apply in a browser | — | by hand |
| SET-10 | Your Meldiq network address, to copy | Implemented · `SettingsScreens` | `/v1/federation/info` | Done (sync S-15) | Production doesn't federate | `live-federation` | live |

## R7 · Round 7 slices C1–C8 (uncommitted Android, undeployed server)

The phone's round 7 C1–C8 live in the `orbit-integrations` worktree and need its server, which isn't deployed. The web
is built and tested against a copy of that server (`live-r7-*` tests skip themselves on 0.7.1) and shows each screen only
when the server advertises its feature and the person holds the permission, so **production shows none of them yet**.

| ID | Feature | Android | Backend | Web | Gaps, security | Tests | Verified |
|---|---|---|---|---|---|---|---|
| R7-01 | Service health for platform admins (S-21) | Implemented · `ServiceHealthScreen` | `/v1/platform/me`, `/v1/admin/health` | Done | Platform admins only; "not measured" shown as such | `live-r7-ops` | live |
| R7-02 | Universal search: filters, server sections, paging, recent searches (S-22) | Implemented · `SearchScreen` | `GET /v1/search` (`search`) | Done | Messages are searched on this browser only (encrypted); recent searches kept on this browser | `universal-search`, `live-r7-search` | live |
| R7-03 | Workflows: templates, editor, test, on/off, runs, cancel (S-23) | Implemented · `WorkflowsScreen`, `WorkflowRules` | `/v1/orgs/:id/workflows…` (`workflows`) | Done | `workflows.manage`; run with the owner's rights | `workflow-rules`, `live-r7-workflows` | live |
| R7-04 | Documents: edit on revision, comments, versions, sharing, archive, export (S-24) | Implemented · `DocumentsScreen`, `DocRules` | `/v1/orgs/:id/documents…` (`documents`) | Done | Server-readable, and labelled so; restricted documents 404 for others | `document-rules`, `live-r7-documents` | live |
| R7-05 | Workspace templates and guest policy (S-25) | Implemented · `WorkspaceC5Screens` | `/v1/workspace-templates`, `/apply-template`, `/guest-policy` | Done | Adds only what's missing; `workspace.edit` | `live-r7-c5` | live, by hand |
| R7-06 | User groups; Add a group to a channel (S-25) | Implemented | `/v1/orgs/:id/groups`, `/v1/conversations/:id/add-group` (`groups`) | Done | A group grants nothing; each member checked like a single add; guests can't see groups | `live-r7-c5` | live |
| R7-07 | Guest end dates on People and invitations (S-25) | Implemented | `/members/:id/expiry`, invite `guestDays` (`guest-expiry`) | Done | Capped by the policy's maximum | `live-r7-c5` | live |
| R7-08 | Meetings in voice rooms: invite people and groups, answer, edit on revision, cancel, .ics, live updates, starting-soon notice (S-25) | Implemented · `MeetingRules` | `/v1/orgs/:id/meetings`, `/v1/meetings/:id…`; frames `meeting.updated`, `meeting.soon` (`meetings`) | Done | Invitees must be able to open the room; titles are server-readable | `meeting-rules`, `live-r7-c5` | live, by hand |
| R7-09 | API keys and outgoing webhooks (S-26) | Implemented · `DeveloperScreen` | `/v1/orgs/:id/api-keys`, `/webhooks…` (`developer-api`) | Done | `developers.manage`; token and signing secret shown once, never stored | `live-r7-developer` | live, by hand |
| R7-10 | Measured usage (30 days) and where limits come from (S-27) | Implemented · `AdminScreens` (Usage) | `/v1/orgs/:id/usage` `metered`, `/plan` | Done | Counts and sizes only | `live-r7-usage` | live, by hand |
| R7-11 | Workspace usage and own limits for platform admins (S-27) | Not on the phone (web extra) | `/v1/admin/usage`, `/v1/admin/orgs/:id/limits` | Done | Platform admins only; audited by the server | `live-r7-usage` | live |
| R7-12 | AI: switch and provider, writing help, catch-up, document summary, ask documents, workflow drafts (S-28) | Implemented · `AiScreen`, `AiSheets`, `AiRules` | `/v1/orgs/:id/ai…` (`ai`) | Built | Off until the server has a provider and an admin turns it on; consent on every request; catch-up sends only what this browser decrypted. Tested with a stand-in provider inside the test server; no real provider has been called | `ai-rules`, `live-r7-ai` | live (stand-in provider) |

## PLAN · Planned on Android, not built anywhere

| ID | Feature | Android | Web |
|---|---|---|---|
| PLAN-01 | People and HR: directory, attendance, shifts, leave | Planned ("coming soon" in the intro) | Not built; nothing to match |
| PLAN-02 | Voice rooms: stage roles, recording, guest invite links | Not built (docs/VOICE_ROOMS.md) | Not built |
| PLAN-03 | Call key rotation when people join or leave | Not built (D-06) | Not built |

## Blocked or deliberately absent, in one place

| What | Why | What would unblock it |
|---|---|---|
| Connecting your account to an app, sharing from it | Server returns OAuth only to `meldiq://` | A per-client return URL on the server (needs approval) |
| Background push | No Web Push on the server | VAPID keys and a Web Push sender |
| Sending link previews | Browsers can't fetch other sites | A server-side preview fetcher |
| Translation outside Chromium | The phone translates on the device; only Chromium has a built-in on-device translator | Other browsers shipping one; a translation service would see plaintext (a product decision) |
| Languages other than English | Not built | Translating the web strings |
| Start fresh, several accounts, wallpaper, camera and QR, share sheet, encrypted backup, swipe, battery checks | Phone only by design | — |
