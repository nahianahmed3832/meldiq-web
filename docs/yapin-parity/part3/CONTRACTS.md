# Part 3 domain contracts

Current local source and exact revisions: [SOURCES.json](completion/SOURCES.json). These contracts are implemented/tested in controlled Web/API fixtures; production/native release remains separate. The canonical API schema is generated in the API repository. The current Web contract pin is recorded in validation.json.

## Social and preferences

Request notes use the existing connection request API: at most 300 Unicode code points, recipient-only while pending, removed on accept/decline/cancel/block. Old clients omitting notes remain valid. Quick reactions use existing account preferences: 3–5 distinct permitted choices, revision-aware saves and omission preservation. Thread follow preferences are account-owned, private and synced; explicit false overrides implicit participation without changing conversation membership.

## Messages, history and search

The existing server message/control endpoint, IDs, ordering and paired history cursors remain canonical. Text is currently server-readable/searchable. Edits, global deletions and pins confirm before Web local mutation; edit/delete retry IDs survive a failed attempt in their owning editor/confirmation. Read boundaries remain click-time snapshots. Native filtered search applies current membership/history/suspension and filters before paging; missing/error states never imply a successful empty answer.

Markdown uses the existing safe token renderer, preserves authorized mentions/custom emoji and never treats message text as HTML. Long-message expansion uses the shared reading-position hook and retains focus/full copied text. Colon completion uses existing Unicode/current-community assets and consumes option-selection keys before send.

## Polls and quizzes

New managed polls reserve private definitions/answer keys before publication, sanitize public message metadata and provide a plain readable fallback. `GET /v1/polls/:id`, `PUT /v1/polls/:id/vote` and `POST /v1/polls/:id/close` enforce current scope/options/expiry. Answers are null until close/expiry; anonymous public entries have no account-derived identifier. The server stores identified ballots for validation. Global deletion/account deletion settle private data; duplicate message retries settle the accepted stored payload. Legacy name-hiding remains a UI-only privacy choice. `poll.updated` contains IDs/revision only.

## Community threads

`GET/PATCH /v1/threads/:id`, `POST /v1/threads/:id/delete`, `PUT /v1/threads/:id/follow` and `GET /v1/me/thread-preferences` expose current authority/state. Root authors close/reopen; `threads.manage`/channel managers additionally lock/unlock. A lock closes the thread; unlocking does not implicitly reopen it. Replies/edits/votes cannot bypass a closed/locked/deleting community thread. Existing DM thread history is preserved without inventing DM moderator authority.

Deletion stores explicit parent intent, current actor/device, target, cursor, interruption and revision. Batches use existing deletion controls, rechecking current authority before each target. Text parents remain and forum parents are deleted last. New replies stop when deletion starts. Resume uses current authority; no global grant bit is exposed. The queue follows the current single-writer workspace architecture; multi-node concurrency/full failover is not certified. `thread.updated` and private `thread.preference` contain IDs/state only.

## Community, roles, forum and audit

Native authorized directory pages filter before limit with totals/cursors. Bulk role requests validate all targets first, exclude protected owners and preserve hierarchy/delegation. Role icons reference validated same-community emoji; removed/invalid assets fall back safely. Required/restricted forum tags are server-enforced, channel/options saves are atomic, and authorized forum filtering/sort/gallery share stable paging. Voice-associated text uses the same conversation and independent text/voice authority, with no automatic audio join.

Audit diffs allow bounded administrative metadata/permissions and exclude message content, credentials and private report/application evidence. Expanded channel metadata remains hidden without channel access. Whole-community reports have a distinct community target, duplicate protection and private operator review; no sanction is automatic. Partner applications are owner-private with an explicit checklist, manual `partners.review` review, stale-write protection and no self-review or automatic badge/role.

## Events and lobby

`events.manage` is a constrained community grant; organizer/owner rights remain and visibility is rechecked. External locations need an authorized visibility channel, are rendered as safe text/HTTPS and are never fetched. Single-occurrence and series edits/cancellation are explicit, including independent future RSVP snapshots and atomic rollover. Optional covers use existing validated image storage and cleanup. Lobby ordering is independent per desktop/phone until explicit link/reset; template cancellation writes nothing. Existing viewer scoping, role safety, theme opt-out and card services remain canonical.

## Canonical permission mapping

Competitor names do not create new grants. The retained owner/admin and disconnect-only decisions are explicit differences.

| Register row | Reference name | Meldiq canonical authority |
| --- | --- | --- |
| YAP-PERM-001 | manage_channels | `channels.manage` |
| YAP-PERM-002 | manage_roles | `roles.manage` |
| YAP-PERM-003 | manage_emojis | `expressions.manage` |
| YAP-PERM-004 | manage_server | `workspace.edit` |
| YAP-PERM-005 | manage_webhooks | `webhooks.manage` |
| YAP-PERM-006 | manage_events | `events.manage` |
| YAP-PERM-007 | view_audit_log | `audit.view` |
| YAP-PERM-008 | create_invite | `members.invite` |
| YAP-PERM-009 | change_nickname | `members.nickname` |
| YAP-PERM-010 | manage_nicknames | `members.nicknames` |
| YAP-PERM-011 | kick_members | `members.remove` |
| YAP-PERM-012 | ban_members | `members.ban` |
| YAP-PERM-013 | timeout_members | `members.timeout` |
| YAP-PERM-014 | send_messages | `messages.post` |
| YAP-PERM-015 | embed_links | `messages.embed` |
| YAP-PERM-016 | attach_files | `messages.attach` |
| YAP-PERM-017 | send_voice_messages | `messages.voice` |
| YAP-PERM-018 | add_reactions | `messages.react` |
| YAP-PERM-019 | use_external_emojis | `messages.external_emoji` |
| YAP-PERM-020 | create_polls | `messages.polls` |
| YAP-PERM-021 | use_headings | `messages.big_text` |
| YAP-PERM-022 | mention_everyone | `messages.mention_all` |
| YAP-PERM-023 | manage_messages | `messages.manage` |
| YAP-PERM-024 | create_threads | `threads.create` |
| YAP-PERM-025 | send_in_threads | `threads.post` |
| YAP-PERM-026 | manage_threads | `threads.manage` |
| YAP-PERM-027 | read_history | `messages.history` |
| YAP-PERM-028 | connect | `voice.connect` |
| YAP-PERM-029 | speak | `voice.speak` |
| YAP-PERM-030 | mute_members | `voice.mute_members` |
| YAP-PERM-031 | move_members | `voice.move_members` |
| YAP-PERM-032 | administrator | `owner/admin constrained roles` |

## Deployment boundary

Migrations are additive local source/harness changes, not production writes. PostgreSQL poll/thread tables are private to the API role with RLS/direct-client revocation. Route authority remains mandatory. Original auth/session/key, entitlement and media/call security boundaries remain; no server-resistant E2EE or completed native interoperability is implied. [Owner decisions](completion/OWNER_DECISIONS.json), [per-row evidence](completion/ROW_EVIDENCE.json) and [validation](validation.json) define accepted scope.
