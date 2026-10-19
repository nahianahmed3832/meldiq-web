# Orbit Web: mobile-feature parity inventory

Every feature of the Android app (Orbit 0.2.2-beta, `internal-beta` f92e59a, API 0.5.0), what the browser needs from the
server for it, and where Orbit Web stands. Sources: the Android UI and data code, `server/src`, the server's tests and
`docs/*.md` in the Orbit repository (github.com/nahianahmed3832/griip-mesage). Paths below are in that repository unless
they start with `src/`, `test/` or `e2e/` (this one).

**Status** — *Done*: built and tested in the browser against a real server. *Partial*: the core works, the stated part
doesn't. *Missing*: not in the browser yet. *Blocked*: needs something outside this repository (named). *Phone only*:
deliberately not offered in a browser (reason given). "Device" (cross-device) is **not verified** for any row until the
physical-phone test (`ORBIT_WEB_STATUS.md` §9) has been run.

Realtime frames the server sends (`server/src/hub.ts`, `ws.ts`): `hello`, `queue` (+ `backlog`), `queue.drained`,
`typing`, `presence`, `call`, `conv.updated`, `org.updated`, `org.deleted`, `prefs.updated`, `devices.changed`, `pong`.
Everything inside a conversation (messages, edits, deletions, reactions, pins, receipts, call keys) travels as an
end-to-end encrypted envelope in `queue`; the server can't read or index it.

## 1. Accounts, devices and sessions

| Feature | Android | Server | Security | Web |
|---|---|---|---|---|
| Sign up with email and password (Orbit 2.0) | `screens/account/StartScreens`, `AccountRepository` | `POST /v2/auth/register`, `/email/verify`, `/email/resend` | scrypt; codes hashed; enumeration-safe answers; per-network limits | **Missing** |
| Sign in with email and password; session refresh | `SignIn…`, `ApiClient` (401 → refresh) | `/v2/auth/login`, `/v2/auth/refresh` (rotating refresh token), `/v2/auth/logout` | access 15 min, refresh 60 d idle; reuse of an old refresh token revokes | **Missing** |
| Device setup after sign-in: first device (new identity, recovery key shown once) | `DeviceSetupScreens` | `POST /v2/account/devices` with `identityKey` | identity key never leaves the device | **Missing** |
| Device setup with the recovery key | `DeviceSetupScreens`, `RecoveryCode` | `POST /v2/account/devices` | recovery key typed locally, never sent | **Missing** |
| Device setup by approving from another device (pairing) | `screens/profile/ProfileScreens` (Approve new device) | `/v1/pairing*`, then `POST /v2/account/devices` binds | identity seed sealed with HPKE to the new device | **Partial**: pairing works (v1 session); binding to an Orbit 2.0 account is missing |
| Returning device (keys present): sign in with device proof | `AccountRepository` | `/v2/auth/login` with `device` | signature by the device key | **Partial**: v1 device-key sign-in works while `LEGACY_LOGIN=on` |
| Start fresh (new identity, old devices revoked) | `DeviceSetupScreens` | `POST /v2/account/identity/reset` | password required; contacts see a new security code | **Phone only**: destroys history for every device; kept on the phone where the recovery key is shown |
| Forgot / reset password | `StartScreens` | `/v2/auth/password/forgot`, `/reset` | reset revokes all sessions | **Missing** |
| Change password, rename account | `AccountSettings` | `POST /v2/account/password`, `PATCH /v2/account` | other sessions revoked | **Missing** |
| Sessions list and sign-out of a session | `AccountSettings` | `GET/DELETE /v2/account/sessions` | | **Missing** |
| Legacy account move (username + recovery key → email account) | `LegacyMoveScreens`, `LegacyMigration` | `/v2/migration/legacy/verify`, `/complete` | Ed25519 by the identity key over `griip-legacy-migration-v1`; ticket single use | **Missing** |
| Legacy (v1) sign-up with username | `SignUpScreen` | `/v1/auth/register` (`LEGACY_REGISTRATION`) | | **Phone only**: being retired; the web uses Orbit 2.0 accounts |
| Devices list, remove a device, identity key and fingerprint | `ProfileScreens` | `/v1/devices`, `DELETE /v1/devices/:id`, `devices.changed` | | **Done** |
| Removing this browser elsewhere signs it out and erases it | — | `devices.changed`, 4401 | | **Done** |
| Several accounts on one device | Settings › Accounts | — | separate key containers | **Missing** (one account per browser profile; use another browser profile) |
| Server choice (debug/test builds) | `ServersScreen` | `/v1/server-info` | | **Phone only**: the web app talks to the server it is deployed with (`config.json`) |

## 2. Workspaces and administration

| Feature | Android | Server | Security | Web |
|---|---|---|---|---|
| Personal workspace + organisations; switcher; selected workspace synced | `WorkspaceSwitcher` | `GET /v2/workspaces`, `PUT /v2/account/preferences` | switching grants nothing (`authz.ts`) | **Partial**: switcher works from `/v1/orgs`; the synced selection is missing |
| Create a workspace | `NewActions`, `OrgScreens` | `POST /v1/orgs` | | **Missing** |
| Join with an invite code (preview, accept) | `JoinWorkspace`, `InviteScan` (QR) | `/v1/invites/preview`, `/accept` | | **Missing** (QR scanning: **phone only**, a code can be typed or pasted) |
| Workspace settings: name, description, photo | `WorkspaceSettings` | `PATCH /v1/orgs/:id`, `PUT/DELETE/GET /v1/orgs/:id/photo` | owners/admins | **Missing** |
| Leave a workspace | `WorkspaceSettings` | `DELETE /v1/orgs/:id/members/me` (`permissions.canLeave`) | not the last owner | **Missing** |
| Delete a workspace | `DeleteWorkspace` | `DELETE /v1/orgs/:id` | owner | **Missing** |
| Members directory, search, roles, titles, removal | `RoleViews`, `ManageSheets` | `/v1/orgs/:id/members`, `PATCH`/`DELETE …/members/:userId` | `roles.ts` (`orgRoleChangeRefusal`, `titleChangeAllowed`, `removalAllowed`) | **Partial**: list only |
| Invitations: create, list with states and creators, revoke | `ManageSheets` | `/v1/orgs/:id/invites`, `DELETE /v1/invites/:id` | admins see all, others their own | **Missing** |
| Branches, teams, departments: create, rename, members, managers, archive/restore, archived list | `ScopeAdminViews` | `/v1/orgs/:id/branches`, `/teams`, `/v1/branches/:id*`, `/v1/teams/:id*`, `/v1/departments/:id`, `GET /v1/orgs/:id/archived` | scoped managers | **Missing** |
| Channels: create, rename, topic, access mode (public/private/announcement), archive/restore, members | `ChannelDetailsSections` | `POST /v1/orgs/:id/channels`, `PATCH /v1/conversations/:id`, `…/members*` | scope managers only change the mode | **Partial**: browse and join only |
| Workspace change log (audit events) | `ActivityFeedScreen` | `GET /v1/orgs/:id/activity` | members see events about places they can see | **Done** |
| Custom roles and permission catalogue | in progress in another session (`orbit-integrations` worktree, uncommitted) | `server/src/permissions/`, `routes/roles.ts` (uncommitted) | | **Blocked**: not committed in the Orbit repository yet |
| Org user groups and group mentions | not built (needs a protocol change, `WORKSPACE_ADMINISTRATION.md` §8) | — | | **Not in the product yet** |

## 3. Home, navigation and conversation list

| Feature | Android | Server | Web |
|---|---|---|---|
| Home / DMs / Activity | `WorkspaceHomeScreen`, `FloatingNavBar` | — | **Done** (rail) |
| Starred conversations, custom sections, collapsed groups, mute — synced across devices | `HomeCustomSections`, `NavPreferences` | `GET/PUT /v1/me/preferences/:workspaceId` (revision, 409), `prefs.updated` | **Missing** (mute and collapse are per browser today) |
| Archive a chat (local), mark read/unread (local) | `ChatActionsSheet`, `SwipeableChat` | — (phone-local) | **Missing** |
| Unread counts, mention badges | `ChatListRules` | read receipts | **Done** (per device, as on the phone) |
| Drafts | `HomeComponents` (Drafts card) | — | **Done** (per browser) |
| New DM, new group | `NewActions` | `POST /v1/conversations/dm`, `/group` | **Partial**: DM only |
| Contacts (people you share a chat with), find by username / phone | `ContactsScreen` | `/v1/users/search`, `/v1/users/by-phone` (owner's setting) | **Partial**: search by name/username; phone lookup missing |
| Search (conversations, people, messages in local history) | `SearchScreen` | `/v1/users/search` (people); messages local only (E2EE) | **Done** |
| Activity: mentions, missed calls, change log, thread replies | `ActivityFeedScreen`, `ThreadActivityRules` | `/v1/orgs/:id/activity` | **Partial**: mentions and change log; missed calls and thread replies missing |
| Connection banner | `ConnectionBanner` | WebSocket state | **Done** |

## 4. Messaging

| Feature | Android | Server / protocol | Web |
|---|---|---|---|
| Text, history, paging | `ConversationScreen` | envelopes; `/v1/history/items` | **Done** |
| Replies (swipe), quoted reply, thread replies | `SwipeToReply`, `ReplyTarget` | payload `replyTo`, `threadId` | **Done** |
| Edit, delete for everyone | `MessageBubble` menu | controls `edit`, `delete` | **Done** |
| Reactions | `MessageBubble` | control `reaction` | **Done** |
| Pins | `ChannelDetailsSections` | control `pin` | **Done** |
| Mentions, `@everyone` (server-attested) | `MentionViews`, `MentionRules` | `mentions`, `mentionAll` + server mark | **Done** |
| Read and delivered receipts; typing; presence and last seen (privacy) | `ConversationViewModel` | controls `receipt`; `typing`; `presence` | **Done** |
| Links: http(s) only, look-alike warning, sender-side previews | `LinkRules`, `LinkOpener` | payload `link` | **Partial**: http(s) only and received previews; the warning dialog and sending previews are missing (browsers can't fetch other sites' pages without a proxy) |
| Contact cards (receive / send) | `RichViews`, Attach › Contact | payload `contact` | **Partial**: received cards shown; sending missing |
| Locations (receive / send) | `RichViews`, Attach › Location | payload `location` | **Partial**: received locations open OpenStreetMap; sending missing |
| Animated emoji | `RichViews` | payload `animatedEmoji` | **Missing** (shown as text fallback) |
| Forwarding (files re-encrypted for the destination) | message menu › Forward | new message, `forwarded` | **Partial**: "Forwarded" shown on received messages; forwarding missing |
| Voice messages: record, preview, send, play | `VoiceViews` | attachment `voice`, `durationMs`, `audio/mp4` | **Partial**: shown as a voice file that downloads; inline playback and recording missing |
| Identity change: hold, review, accept; safety numbers | `ConversationInfoScreen` | key-change events | **Done** |
| Held / undecryptable messages | `MessageRepository` | | **Done** |
| Blocked people | `PrivacyScreen` › Blocked | `/v1/blocks` | **Missing** |
| Call history lines in conversations | `CallHistory` | `GET /v1/conversations/:id/calls`, `attended` | **Missing** |
| Conversation details: about, access, notifications, members, pins, files | `ConversationInfoScreen`, `ChannelDetailsSections` | | **Partial**: members, safety numbers, pins; files tab and access card missing |
| Message text size, wallpaper | Settings › Chats | — | **Missing** (text size); wallpaper **phone only** |

## 5. Files and media

| Feature | Android | Server | Web |
|---|---|---|---|
| Send/receive encrypted files, images, video | `AttachPanel`, `BatchComposer`, `AlbumGrid` | `POST /v1/attachments` (small), multipart `/v1/attachments/uploads*` (16 MiB parts, presigned, resumable), `GET /v1/attachments/:id` (302 to a 5-minute URL) | **Partial**: up to 25 MB, single upload |
| 1 GB per file (`files-1g`, `fileMaxBytes`) | `AttachmentRepository` | multipart uploads, 24 h session | **Missing** |
| Media viewer and gallery | `MediaViewer`, `MediaGallery` | | **Partial**: inline images and video; a gallery per conversation is missing |
| Camera capture, QR scanning | `InviteScanner`, camera | | **Phone only** (a browser can attach photos from disk; QR codes can be typed) |
| Storage use, clear cache | `StorageScreen` | | **Missing** |

## 6. Calls

| Feature | Android | Server | Web |
|---|---|---|---|
| 1:1 voice and video, ringing, answer, decline, busy, hang-up | `CallManager`, `CallOverlay` | `/v1/calls*`, `call` frames, LiveKit | **Built, not merged** (`c9b7fb0`, commit on the Orbit repository's `claude/strange-mclaren-5d8fdb` branch; to be ported here) |
| Media end-to-end encryption, badge, verification code | `CallVerification`, `MediaSecurityTracker` | `call_invite` / `call_key_request` controls | **Built, not merged** (as above) |
| Group calls, tiles, joining a running call | `CallTiles`, `GROUP_CALL_TILES.md` | | **Built, not merged** (one-to-one tested only) |
| Screen sharing | `CallControls` | LiveKit | **Missing** |
| Device choice (microphone, camera, speaker) | audio routes (UI-003) | | **Missing** |
| Minimised call | `MiniCallPanel` | | **Built, not merged** |
| Call history | `CallsScreen` | `/v1/conversations/:id/calls` | **Missing** |

## 7. Profile, privacy, settings and notifications

| Feature | Android | Server | Web |
|---|---|---|---|
| Profile: display name, names, username, bio, birthday, phone | `EditProfileScreen` | `PATCH /v1/users/me` | **Partial**: display name and bio |
| Profile photo (not E2EE) | `EditProfileScreen`, `UserAvatar` | `PUT/DELETE /v1/users/me/photo`, `GET /v1/users/:id/photo` | **Missing** (initials only) |
| Privacy: who sees each field, who can find you, read receipts, typing | `PrivacyScreen` | `PUT /v1/users/me/privacy` | **Missing** |
| Notifications: on/off, groups, text in notifications, per-chat mute | `NotificationHealthViews`, settings | — | **Partial**: browser notifications while a tab is open; synced mute missing |
| Background delivery (UnifiedPush) | `UnifiedPushDelivery` | `/v1/devices/current/push` | **Not available**: needs Web Push on the server (VAPID); not built |
| Encrypted backup and restore | `BACKUP.md` | | **Phone only**: the browser restores server history instead |
| Language (English, Simplified Chinese, Bengali) | `AppLanguage` | | **Missing** (English only) |
| Appearance | Cocoa design system | | **Done** (Ivory and Cocoa) |

## 8. Federation

| Feature | Android | Server | Web |
|---|---|---|---|
| People on other Orbit servers (`@name:server`), DMs with them | `FEDERATION_PROTOCOL.md` | `/v1/federation/resolve`, `/fed/v1/*` (server to server) | **Partial**: federated DMs arrive and work like others; finding someone by `@name:server` is missing |

## 9. Integrations (connectors)

Google Drive, Microsoft Graph, calendar, GitHub, Jira and Notion: **Blocked**. No connector code is committed in the Orbit
repository. Another session is building the framework (`server/src/integrations/`, registry, OAuth, tokens, webhooks,
jobs) in the uncommitted `orbit-integrations` worktree. The web screens will follow its committed API; nothing is shown
in the browser until the server advertises the feature.

## 10. Discrepancies with the brief

- **Database**: the brief describes MongoDB as the established store. Verified: SQLite is authoritative; accounts and
  personal preferences *can* live in MongoDB (`MONGODB_DOMAINS`), and production has no MongoDB yet
  (`ORBIT_WORKSPACE_MONGODB_REPORT_2026-10-19.md`). The browser never talks to a database either way.
- **Framework**: the brief prefers Next.js. Orbit Web is a Vite + React SPA: all content is end-to-end encrypted, so
  server rendering has nothing to render, and the keys must stay in the browser. Kept (see `ORBIT_WEB_ARCHITECTURE.md`).
- **Server-side search, group mentions, message search on the server**: impossible by design (E2EE); search is local.
