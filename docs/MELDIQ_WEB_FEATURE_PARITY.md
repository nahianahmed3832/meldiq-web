# Meldiq Web ↔ Android feature parity

Updated 2026-10-19. It supersedes `ORBIT_WEB_PARITY.md`, whose detailed notes still apply where this file doesn't repeat
them.

## Sources

- **Android app:** `internal-beta` at `f92e59a` (app commit `0cded9c`, versionName 0.2.1-beta) in the server repository
  (github.com/nahianahmed3832/griip-mesage). Its screens, data and repository code were read.
- **Server:** API 0.5.0 plus `server-patches/0001` and `0002`. This is the exact build running in production since
  2026-10-19 10:25 UTC; the server's own suite gave 409 passed and 10 skipped.
- **Unchanged since the last audit:** neither the Android app nor the server gained features since `ORBIT_WEB_PARITY.md`
  was written. The newer `0cded9c` changed the app only (workspace settings, personal sections, thread replies), and the
  web already had all three.

## Status

| Status | Meaning |
|---|---|
| **Done** | Built, and tested against a real server |
| **Built** | Implemented, with the limits of its testing stated |
| **Partial** | The named part is missing |
| **Missing** | Not in the browser |
| **Blocked** | Needs something outside this repository, which is named |
| **Phone only** | Deliberately not offered in a browser, with the reason |

## Verification levels

| Level | Meaning |
|---|---|
| **live** | Vitest against the real server, with the server's reference client playing the phone, byte-compatible with Android |
| **browser** | Playwright in Chromium, Firefox, WebKit and phone-width Chromium |
| **unit** | Unit test |
| **by hand** | Looked at in the running app |
| **device** | Against the real Android app. **No row has this level yet**; the physical-phone test is still pending |

"New" marks what this round added or fixed.

## 1. Accounts, devices and sessions

| Feature | Android | Backend | Web before | Web now / missing | Dependencies, security | Status | Verified |
|---|---|---|---|---|---|---|---|
| Sign up, verify email, sign in, refresh | `StartScreens`, `AccountRepository` | `/v2/auth/*` | Done | — | scrypt, hashed codes, rotating refresh tokens | Done | live, browser |
| Set up this browser with the recovery key | `DeviceSetupScreens`, `RecoveryCode` | `POST /v2/account/devices` | Done | **New:** a setup session ended elsewhere (e.g. removed in the phone's session list) now returns to sign-in with an explanation; before, every attempt failed with 401 (`MELDIQ_WEB_STATUS.md` §1) | Key typed locally, never sent; another account's key refused before sending | Done | live, browser (regression tests fail on the old code) |
| Set up by approving on the phone | `ProfileScreens` › Approve new device | `/v1/pairing*`, then `/v2/account/devices` | Done | Same fix as above | Seed sealed with HPKE to this browser | Done | live |
| Returning browser: sign in again with device proof | `AccountRepository` | `/v2/auth/login` + `device` | Done | — | Proof signed by the device key | Done | live |
| Forgot / reset password | `StartScreens` | `/v2/auth/password/*` | Built | — | Reset revokes all sessions | Built | browser (request step) |
| Change password, rename account | `AccountSettings` | `/v2/account/password`, `PATCH /v2/account` | Built | — | Other sessions revoked | Built | by hand |
| Sessions list, end a session | `AccountSettings` | `/v2/account/sessions` | Done | — | — | Done | live |
| Move a pre-2.0 account | `LegacyMoveScreens` | `/v2/migration/legacy/*` | Done | — | Identity-key signature, single-use ticket | Done | live |
| Devices list, remove a device; a removed browser signs out | `ProfileScreens` | `/v1/devices`, `devices.changed` | Done | — | — | Done | live, browser |
| Start fresh (new identity) | `DeviceSetupScreens` | `/v2/account/identity/reset` | Phone only | — | Destroys history on every device | Phone only | — |
| Several accounts in one browser | Settings › Accounts | — | Missing | Missing | Separate key stores per account | Missing (use another browser profile) | — |
| Legacy username sign-up, server picker | `SignUpScreen`, `ServersScreen` | `/v1/auth/register` | Phone only | — | Being retired; the web uses its deployment's server | Phone only | — |

## 2. Workspaces and administration

| Feature | Android | Backend | Web before | Web now / missing | Dependencies, security | Status | Verified |
|---|---|---|---|---|---|---|---|
| Switch workspace; selection follows the account | `WorkspaceSwitcher` | `GET /v2/workspaces`, `PUT /v2/account/preferences` | Partial | **New:** adopted when the app opens, saved on every switch (account browsers) | Switching grants nothing | Done | live |
| Create, join (code), leave, delete a workspace | `NewActions`, `JoinWorkspace`, `WorkspaceSettings` | `/v1/orgs*`, `/v1/invites/*` | Done | QR scanning: phone only (codes can be typed) | Owner-only delete after typing the name | Done | live |
| Workspace name, description, photo | `WorkspaceSettings` | `PATCH /v1/orgs/:id`, `/photo` | Done | — | Owners and admins | Done | live |
| Members, roles, titles, removal | `RoleViews`, `ManageSheets` | `/v1/orgs/:id/members*` | Done | — | Offered actions mirror `roles.ts` | Done | live |
| Invitations | `ManageSheets` | `/v1/orgs/:id/invites` | Done | — | — | Done | live |
| Branches and teams: create, archive, restore | `ScopeAdminViews` | `/v1/orgs/:id/branches`, `/teams` | Done | — | — | Done | live |
| Branches and teams: rename, members, managers and leads | `ScopeAdminViews` | `PATCH /v1/branches/:id`, `/v1/teams/:id`, `…/members/:userId` | Missing | **New:** Workspace › Branches & teams › Manage | `canManageBranch`, `canManageTeam`; refusals shown | Done | live (a non-manager is refused with 403) |
| Departments: add, rename, delete, put a team in one | `ScopeAdminViews` | `/v1/branches/:id/departments`, `/v1/departments/:id`, `PATCH /v1/teams/:id` | Missing | **New:** in the branch's and team's Manage dialog | Branch managers; grants no access | Done | live |
| Channels: create, access mode, archive, restore, browse, join, leave | `ChannelDetailsSections` | `/v1/orgs/:id/channels`, `PATCH /v1/conversations/:id` | Done | — | Scope managers change the mode | Done | live |
| Channels and groups: rename, topic, add people | `ChannelDetailsSections`, `ManageSheets` | `PATCH /v1/conversations/:id`, `PUT …/members/:userId` | Partial | **New:** Details › Edit and Add people (only when `canManage`) | New members get messages from then on (E2EE) | Done | live (a non-admin is refused; the new member receives a message sent after) |
| Workspace change log | `ActivityFeedScreen` | `GET /v1/orgs/:id/activity` | Done | — | — | Done | live |
| Custom roles, permission catalogue | In progress elsewhere (not committed) | not committed | Blocked | — | — | Blocked: no committed server API | — |
| User groups, group mentions | Not built in the product | — | — | — | Needs a protocol change | Not in the product | — |

## 3. Home, people and navigation

| Feature | Android | Backend | Web before | Web now / missing | Status | Verified |
|---|---|---|---|---|---|---|
| Home, DMs, Activity; unread and mention counts; drafts | `WorkspaceHomeScreen` | read receipts | Done | — | Done | live, browser |
| Starred, sections, collapsed, notification levels (synced) | `NavPreferences` | `/v1/me/preferences/:workspaceId`, `prefs.updated` | Done | — | Done | live |
| Archive and mark read/unread (this device) | `ChatActionsSheet` | — | Done | — | Done | live |
| Find people by name or @username | `ContactsScreen` | `/v1/users/search` | Done | — | Done | live |
| Find someone by phone number | `ContactsScreen` | `/v1/users/by-phone` (their privacy setting) | Partial (no screen) | **New:** New message accepts `+country number`; a local number gets a hint | Done | live (not found until they allow it), unit |
| Find someone on another server (`@name:server`) | `FEDERATION_PROTOCOL.md` | `/v1/federation/resolve` | Missing | **New:** New message accepts `@name:server` when the server federates | Built (**production doesn't federate**: `federation: null`) | unit |
| Search conversations, people, messages (local, E2EE) | `SearchScreen` | `/v1/users/search` | Done | — | Done | live, by hand |
| Activity: mentions, missed calls, thread replies, change log | `ActivityFeedScreen` | `/v1/orgs/:id/activity` | Done | — | Done | live |

## 4. Messaging

| Feature | Android | Protocol | Web before | Web now / missing | Status | Verified |
|---|---|---|---|---|---|---|
| Send, receive, history, paging; replies, threads; edit, delete; reactions; pins; mentions, `@everyone` | `ConversationScreen`, `MessageBubble` | envelopes, controls | Done | **New:** the composer empties at once, so typing straight on starts a new message (before, it joined the one still sending) | Done | live, browser |
| Read and delivered receipts, typing, presence | `ConversationViewModel` | `receipt`, `typing`, `presence` | Done | — | Done | live |
| Link warnings (look-alike, hidden destination, IP, http, long chains) | `LinkRules.warning`, `LinkOpener` | — | Missing | **New:** the same checks and words; a warned link asks first | Done | unit (the phone's cases) |
| Sending link previews | `LinkPreview` | payload `link` | Missing | Previews received from the phone show | Blocked: browsers can't fetch other sites' pages; would need a server-side fetcher | — |
| Contact cards, locations | `RichViews` | payload `contact`, `location` | Done | — | Done | live |
| Animated emoji: show, send, on/off | `RichViews` Animoji, Settings › Chats | payload `animoji` | Missing (shown as text) | **New:** same 20 emoji and motions; Appearance › Animated emoji; respects reduced motion | Done | live (both ways), by hand |
| Forwarding (files re-encrypted) | message menu | `forwarded` | Done | — | Done | live |
| Voice messages | `VoiceViews` | attachment `voice` | Done | — | Done (recording by hand only) | live (wire format) |
| Identity change hold and review; safety numbers | `ConversationInfoScreen` | key-change events | Done | — | Done | live |
| Block someone | `PrivacyScreen` › Blocked | `/v1/blocks` | Partial (unblock only) | **New:** Details of a DM › Block / Unblock | Done | live (blocked messages don't arrive; others do) |
| Conversation details: about, members, pins, notifications, leave | `ConversationInfoScreen` | | Done | Rename, topic and add people above | Done | live |
| Message text size | Settings › Chats | — | Missing | **New:** Appearance › Text size (messages and the message box) | Done | unit, by hand |
| Chat wallpaper | Settings › Chats | — | Phone only | — | Phone only (the web keeps the calm design-system surface) | — |

## 5. Files and media

| Feature | Android | Backend | Web before | Web now / missing | Status | Verified |
|---|---|---|---|---|---|---|
| Encrypted files, images, video; chunked 1 GB; direct S3 parts | `AttachPanel`, `AttachmentRepository` | `/v1/attachments*`, `/uploads*` | Done / Built | — | Done, but **production needs the S3 CORS rule** for browsers (`MELDIQ_WEB_STATUS.md` §4) | live (30 MB through the API; S3 parts against a simulated store) |
| Media and files of a conversation | `MediaGallery` | — | Partial (8 recent files) | **New:** Details › Media and files: photos and videos grid, files list, decrypted on demand | Done | unit, by hand |
| Storage | `StorageScreen` | — | Missing | **New:** Settings › Storage: what this browser keeps, and asking it to keep the data (the device keys live there) | Done | by hand |
| Camera capture, QR scanning | camera, `InviteScanner` | — | Phone only | — | Phone only | — |

## 6. Calls

| Feature | Android | Backend | Web | Status | Verified |
|---|---|---|---|---|---|
| 1:1 voice and video, ring, answer, decline, busy, hang up; media E2EE and verification code | `CallManager`, `CallOverlay` | `/v1/calls*`, LiveKit | Built | Built | browser (LiveKit's native SDK as the far side; media decrypted both ways). **Not device-verified** |
| Group calls, screen sharing, device choice, minimised call | `CallTiles`, `CallControls` | LiveKit | Built | Built | browser, with simulated media |
| Call history, missed calls | `CallsScreen` | `/v1/conversations/:id/calls` | Done | Done | live |

## 7. Profile, privacy, notifications, settings

| Feature | Android | Backend | Web | Status | Verified |
|---|---|---|---|---|---|
| Profile fields, photo, privacy (who sees and finds you) | `EditProfileScreen`, `PrivacyScreen` | `/v1/users/me*` | Done | Done | live |
| Notifications while a tab is open; synced levels | settings | — | Done | Done | by hand |
| Background notifications (no tab open) | UnifiedPush | `/v1/devices/current/push` | Missing | Blocked: needs Web Push (VAPID) on the server | — |
| Appearance: theme, colour plate, text size, animated emoji | Settings | — | Done | Done | unit, by hand |
| Languages (Simplified Chinese, Bengali) | `AppLanguage` | — | Missing | Missing: English only | — |
| Encrypted backup and restore | `BACKUP.md` | — | Phone only | Phone only (the browser restores server history) | — |

## 8. Connectors and federation

- **Connectors:** Google Drive, Microsoft Graph, calendar, GitHub, Jira and Notion are **Blocked**. No connector code is
  committed in the server repository (`worktree-orbit-integrations` is still at `0cded9c`), so there's no API for the web
  to call. Nothing is shown in the browser until the server advertises the feature.
- **Federation:** DMs with people on other servers work like any other DM. Finding them by address is new and Built, but
  production has federation turned off.

## Not in the browser, and why

| Feature | Reason |
|---|---|
| Several accounts in one browser profile | Missing |
| Languages other than English | Missing |
| Sending link previews | Blocked: needs a server-side fetcher |
| Background push | Blocked: needs Web Push (VAPID) on the server |
| Custom roles | Blocked: the server code isn't committed |
| Connectors | Blocked: the server code isn't committed |
| Start fresh, wallpaper, camera and QR, encrypted backup, legacy username sign-up, server picker | Phone only by design |
