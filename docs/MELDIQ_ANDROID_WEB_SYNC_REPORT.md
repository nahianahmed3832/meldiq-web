# Meldiq Android → Web synchronization report

Started 2026-10-20. This report tracks the web against the **latest Android code**, including work not yet committed.
`MELDIQ_WEB_FEATURE_PARITY.md` is the full feature inventory against the committed release.

## 1. Which Android is the reference

| Source | Revision | What it is | Used as |
|---|---|---|---|
| `internal-beta` (the designated development and release branch; `origin/HEAD`) | `35aa4b5`, versionCode 10, **0.2.3-beta** | The last committed and released app | **Baseline.** The full inventory was taken against it and is unchanged: no commit has landed since |
| Main checkout `/Volumes/code_files/griip_message` | `35aa4b5` + uncommitted `build.gradle.kts` | Owner's bump to versionCode 11, **0.2.4-beta**; no code change | The next release's number |
| Worktree `.claude/worktrees/orbit-integrations` (branch `worktree-orbit-integrations`) | `35aa4b5` + **uncommitted round 7** (edited 2026-10-20 00:41–00:56 UTC+8; its session is still running) | Round 7 slice A ("built, not yet phone-tested") and the call/channel bug fixes (`docs/MELDIQ_ROUND7_PLAN_2026-10-19.md`, `docs/MELDIQ_CALL_BUGS_2026-10-20.md`) | **Latest Android behaviour.** Matched here wherever it works against the deployed server; anything that needs its undeployed server changes is listed as a backend blocker |
| Old worktrees (`orbit-round-2/3/4`, `lucid-sanderson`, `sleepy-leavitt`) | 2026-10-17/18, package `com.griipbuddy.orbit` | Pre-rebrand experiments, never merged (e.g. self-service account deletion) | **Not used**: not on the designated branch |

The other session's files were only read (`git show`, `git diff`, `cat`). Nothing in the shared checkout or the
worktrees was changed.

**Server.** Production runs API **0.7.1**, the same code as `35aa4b5`. Round 7 also changes the server; none of these
changes are deployed:

- `POST /v1/calls` refuses text channels with 409 `text_channel_no_calls`.
- Public channels auto-join by default.
- Channel repair CLI.
- Voice-room events in the activity feed.

Branch `oauth-web-return` (`54b9eff`) holds the web OAuth return; it isn't deployed either.

## 2. Status key

| Status | Meaning |
|---|---|
| **Already matched** | Web behaviour agrees with the latest Android code, checked in the code, not just by a screen existing |
| **Missing in Web** | In Android, absent in the browser |
| **Out of sync** | In both, but behaviour or data contract differs |
| **Regression** | Worked in the browser before, broken now |
| **Android incomplete** | The Android feature itself is unfinished or unverified |
| **Browser limitation** | Needs a safe browser-specific alternative |
| **Backend blocker** | Needs server functionality that isn't deployed |

Verification levels are as in the inventory: implemented, unit, live (real server code, reference client playing the
phone), browser (Playwright), by hand, device. **No item is device-verified.**

## 3. Differences found and what was done

| ID | Android source | Feature or fix | Android files | Backend | Web before | Classification | Web change | Security | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| S-01 | round 7 | Contact cards become Meldiq **profile cards**: name, user id, username; never phone numbers | `Models.kt`, `RichRules.kt` (`profileCard`, `clean`), `ProfileCards.kt` | none (payload fields `userId`, `username`) | Sent typed cards with phones and emails; dropped `userId`/`username` on receipt; received cards weren't cleaned | **Out of sync** (contract) | Attach › Share a profile… (yours or people you talk to, searchable); card with View profile (the server's privacy rules apply) and Message; received cards cleaned as the phone does (numbers dropped from a profile card); wire form without empty lists; typed-card dialog removed; old cards still show | No address-book or number data leaves the device; malformed ids fall back to a plain card | `profile-cards` (the phone's `RichRulesTest` cases), `live-rich` (both directions through the server) | Implemented, automated, runtime-tested |
| S-02 | round 7 | Text channels have no call buttons; calls happen in voice rooms | `ConversationScreen.kt`, `CallsScreen.kt` | 409 `text_channel_no_calls` (round 7 server, undeployed; its message is shown as is) | Voice and video buttons in every channel | **Out of sync** | Call buttons only in direct messages and groups; a call already running in a text channel can still be joined from its banner | — | e2e call tests (DMs) unchanged | Implemented, runtime-tested |
| S-03 | round 7 bug 6 | Public channels reach every member; clicking an unjoined channel joins it | `WorkspaceScreen.kt`; server `orgs.ts` default | `autoJoin` (0.7.1 already accepts it) | Org-wide public channels were created opt-in, so members never saw them | **Out of sync** (the bug itself) | Public channels are created with `autoJoin: true`, which fixes it on today's production server; an unjoined channel's name in Workspace › Channels joins and opens it. Existing opt-in channels need the round 7 server's `channel-access-repair` (owner's step) | Private channels stay invite-only | `live-roles-apps` › channel access (existing member, later member, private stays hidden) | Implemented, automated |
| S-04 | round 7 bug 7 | Faster call setup | `CallManager.kt`, `CallTimeline.kt` | none | Caller waited for the key message before connecting; callee joined, then waited; 250 ms key polling | **Out of sync** | The key message goes out while the caller connects, and a send failure ends the call with the reason. The callee asks to join while waiting for the key. 50 ms key polling | Key rules unchanged (creator, or someone connected in a voice room; first key wins) | `call-setup` (would hang on the old order), `call-live`, `live-voice-rooms`, e2e calls | Implemented, automated. Not timed: no before/after measurement |
| S-05 | round 7 bug 3 | Mirror only your own front camera | `CallMediaPolicy.kt`, `CallOverlay.kt` | none | Your own video was always mirrored, including a phone browser's back camera | **Out of sync** | `mirrorPreview`: mirrored unless the camera reports `environment` (laptop webcams don't report it, and face you) | Local drawing only | `call-rules` | Implemented, automated. Back camera not tried on a phone browser |
| S-06 | round 7 | Pin button in the header with a count; pinned list, newest first, jump, unpin | `PinnedMessages.kt`, `ConversationChrome.kt` | pin controls | Pins only in Details, and only from loaded messages | **Out of sync** | Header pin button with its count; Pinned panel (`#/…/pinned`) from everything kept on this browser; a click loads older messages if needed and jumps; Unpin where you may post. The Details list is gone, as on the phone. Order is by message time: neither app records when something was pinned | — | `live-rich` (pins from the phone, unpin reaching the phone) | Implemented, automated, runtime-tested |
| S-07 | round 7 | Bulk save: pick files across messages, save them to a folder; 200 files / 4 GiB per batch; clashing names numbered; stop and retry | `BulkSave.kt`, `BulkSaver.kt`, `BulkSelection.kt` | per-file download (membership-checked) | One file at a time | **Missing in Web** (browser adaptation) | Details › Media and files › Select files to save. Pick or Select all, then Save to a folder… (Chromium's folder picker; elsewhere each file goes to downloads). One file at a time, with progress, Stop and Retry. Files already in the folder are never overwritten | Each file decrypted and verified locally; no server archive | `bulk-save` (the phone's `BulkSaveTest` cases), `live-rich` (two files saved decrypted next to an existing file, a missing one reported) | Implemented, automated, runtime-tested (selection; the OS folder dialog itself wasn't driven) |
| S-08 | round 7 | Composer: attach and emoji step aside while typing | `ComposerAux.kt` | none | Always shown | **Browser limitation** (not adopted) | None: on a desktop the box has room for both, and the buttons stay where keyboard users expect them | — | — | Documented |
| S-09 | 35aa4b5 | Message info: status, sent, accepted by relay, delivered to, read by, encryption | `ConversationScreen.kt` (`infoFor`) | none (receipts on this device) | A "Read by N" tooltip only | **Missing in Web** | Message menu › Message info on your own messages, with the phone's fields and wording (channels: "Receipts aren't collected in channels") | — | Receipts are covered by `live`; the dialog was checked by hand | Implemented, runtime-tested |
| S-10 | 35aa4b5 | Translate a received message on the device | `MessageTranslator.kt`, `MessageBubble.kt` | none | Not offered | **Missing in Web**, with a **browser limitation** | Message menu › Translate… where the browser has an on-device translator (Chromium's built-in Translator and LanguageDetector); consent the first time; English, Simplified Chinese or Bengali; shown under the message as "Translated in this browser", with Copy and Show original only. Elsewhere it isn't offered: the text is never sent to a service. Browser calls are time-limited and fail with one plain message | Text never leaves the device | `translate` (stand-in APIs: detection, same language, unavailable pairs, browser errors, hanging model) | Implemented, automated. By hand, the option appears, but this test browser couldn't load a model ("Model not available"), so **no real translation was seen** |
| S-11 | 35aa4b5 | Invite QR code with a new invitation; invite links and messages accepted when joining | `OrgScreens.kt` (`qrBitmap`), `InviteScan.kt` (`InviteCodes`) | none | Code only; links not parsed; codes not checked before sending | **Missing in Web** | QR code (`meldiq://invite/CODE`, the phone's format) beside a new code; the join box takes the code, the link or the whole shared message, and refuses look-alike characters with the phone's message. Library `qrcode-generator` 2.0.4 (MIT, no dependencies, pinned) | Codes only; a web address is never followed | `invite-codes` (the phone's `InviteScanTest` cases); by hand the QR decoded to `meldiq://invite/M895-ETWP-FYR6` with the browser's own barcode reader | Implemented, automated, runtime-tested. Scanning a QR with the browser's camera: not built (the phone does that) |
| S-12 | 35aa4b5 | Notifications: group notifications (mentions still notify), message sound, call ringtone on/off | `SettingsStore.kt`, `SettingsScreens.kt` | none | One switch plus message text | **Missing in Web** | Settings › Notifications: Group notifications, Message sound (the system notification's sound), Incoming call ringtone | — | `live-rich` (groups quiet; mention and DM notify) | Implemented, automated, runtime-tested (settings shown) |
| S-13 | 35aa4b5 | Chats: download photos automatically; links: ask every time | `SettingsStore.kt` | none | Photos always loaded; links asked only when misleading | **Missing in Web** (adapted) | Appearance › Download photos automatically (off: each photo waits for a click; videos and files always wait) and Ask before opening links (every link shows its destination first). Android's "on Wi-Fi only" isn't offered: desktop browsers don't say which network they're on | Ask-first shows the real destination | — | Implemented, runtime-tested (settings shown) |
| S-14 | 35aa4b5 | Message layout: stream (default) or bubbles | `SettingsStore.kt`, `MessageBubble.kt` | none | Stream only | **Missing in Web** | Appearance › Message layout: Stream or Bubbles (yours on the right in the accent's tint) | — | — | Implemented, runtime-tested (a layout bug with your own messages was found by hand and fixed) |
| S-15 | 35aa4b5 | Your Meldiq network address (`@name:server`), to copy | `SettingsScreens.kt` | `GET /v1/federation/info` | Not shown | **Missing in Web** | Settings › Profile shows it with Copy where the server federates. Production doesn't, so nothing shows there | — | `live-federation` (a federating and a plain server) | Implemented, automated |
| S-16 | 35aa4b5 | Connect your account to an app; send a message to an app (Jira issue, calendar event); share from an app | `AppDetailScreen.kt`, `ShareFromApp.kt` | OAuth return to `meldiq://` only | Not offered | **Backend blocker** | None. Branch `oauth-web-return` (`54b9eff`) is ready but not deployed, and has no feature flag the web could detect | — | — | Blocked |
| S-17 | 35aa4b5 | Background notifications | UnifiedPush / FCM | no Web Push (VAPID) | Tab open only | **Backend blocker** | — | — | — | Blocked |
| S-18 | 35aa4b5 | Sending link previews | `LinkPreview` | needs a fetcher | Received previews show | **Backend blocker** (browsers can't fetch other sites) | — | — | — | Blocked |
| S-19 | 35aa4b5 | Languages (Simplified Chinese, Bengali) | `AppLanguage.kt`, `android/i18n` | none | English only | **Missing in Web** | Not this round: every interface string would first need to move into a catalogue | — | — | Deferred |
| S-20 | round 7 plan | Video rooms, conferences, presence states, friends, workforce, stories, live location (slices B–F) | plan only | not built | — | **Android incomplete** (planned, not built) | Nothing to match | — | — | — |

"Automated" means the named tests were run and passed. "Runtime-tested" means checked by hand in Chromium against a
local 0.7.1 server. **No item is cross-device verified on a physical phone.**

Everything else in `MELDIQ_WEB_FEATURE_PARITY.md` (accounts, recovery codes, Later, polls, stickers, roles, apps,
voice rooms, …) was checked again against `35aa4b5` and the round 7 diff. It is **Already matched**: round 7 doesn't
touch it.
## 4. Compatibility and security findings

- **Encryption.** Nothing in the protocol changed.
  - Profile cards are new fields inside the same end-to-end encrypted payload.
  - Older Android apps (0.2.3) ignore the two new fields and show the name; the fallback text names the person and
    their username.
  - Calls keep the per-call key in encrypted control messages. The round 7 ordering changes only *when* the
    caller's key message is sent, not who may send or accept it.
- **Privacy.** The web no longer offers typed contact cards with phone numbers and emails. A received profile card is
  stripped of any numbers, whatever the sender put in. Translation never sends text off the device; where the
  browser can't translate on the device, the option isn't shown.
- **Authorization.** Everything new goes through endpoints the server already checks:
  - joining channels;
  - membership-checked attachment downloads, one per file in a bulk save;
  - `/v1/users/:id` with the server's profile privacy;
  - `/v1/federation/info`.
  
  `autoJoin` is a field the server validates.
- **One backend.** No new storage or API. Settings that only affect this browser live with its other preferences, as
  the phone keeps them on the phone. The 1 GB file limit is unchanged (the server's `fileMaxBytes`).
- **Realtime.** No new event types. Pins, profile cards and notification filtering run on the existing frames
  (`queue` envelopes and controls); `live-rich` shows pins from the phone reaching the browser and back without a
  reload.

## 5. Tests run (2026-10-20, sync pass)

| Suite | Result |
|---|---|
| Typecheck (`tsc -b`), lint, format | clean |
| Unit and live (`npx vitest run`, server code of API 0.7.1) | **42 files, 320 passed**, 0 failed |
| New this pass | `profile-cards` 3, `call-setup` 2, `bulk-save` 5, `invite-codes` 4, `translate` 4, `live-federation` 1; additions to `live-rich` (profile cards, pins, bulk save, group notifications), `live-roles-apps` (channel access), `call-rules` (mirroring) |
| Browser (`npx playwright test`, 4 projects, LiveKit) | 36 passed, 3 skipped (deliberate), 1 failed: the known Chromium "video call from the phone app" intermittent, the first call after LiveKit starts. Same failure in the two previous full runs, before this pass's call changes |
| Call suite run twice more (all browsers) | **18 passed, 2 skipped, 0 failed**, both times |
| Production build | passes; secret scan of the bundle clean |
| By hand (Chromium, local 0.7.1 server) | No call buttons in a text channel; pin count and Pinned panel; Message info; profile card sent, View profile, Message; Media and files selection (Select all, click to select); invitation QR (decoded with the browser's barcode reader); new Appearance and Notifications settings; bubbles layout (a layout bug found and fixed). Translate is offered, but this browser couldn't load a model, so it failed with the plain message |

**Cross-device:** none. No physical Android phone was used, and round 7 itself is not phone-tested yet.

## 6. Next steps

1. **Physical phone with round 7's test APK** (`artifacts/meldiq-test-2026-10-20-r7.apk` in that worktree) against the
   web:
   - profile cards both ways;
   - pins and unpins;
   - a call each way (setup feels quicker);
   - a back-camera preview in a phone browser;
   - a public channel made on the web appearing on the phone.
2. **Translation in a desktop Chrome** where the built-in model downloads: translate a message into each of the three
   languages.
3. **When round 7 is committed:** compare its final diff with this report and redo anything that changed.
   - Its server change (`text_channel_no_calls`, auto-join default, `channel-access-repair`) needs your approval to
     deploy.
   - The repair needs a dry run reviewed first.
4. **OAuth for the web** (`oauth-web-return`): add a feature flag the web can detect, then build Connect, Send to app
   and Share from app.
5. **Languages:** move the web's interface strings into a catalogue, then reuse `android/i18n` for Chinese and Bengali.
