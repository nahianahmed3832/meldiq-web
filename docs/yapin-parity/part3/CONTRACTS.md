# Part 3 domain contracts

Status: locally implemented and tested source; production/native acceptance remains Part 4. Source parents and isolated worktrees are recorded in [baseline](baseline.json). Read the per-row limits in [feature dispositions](feature-dispositions.json).

## C-SOCIAL

Keep `/v1/connections`, message requests, privacy choices and the existing group membership APIs. `POST /v1/connections/:userId/accept` retains `{state: "accepted"}`. Recipient-only pending transitions use `RelationshipStore.acceptConnection(recipient, from, at)` in PostgreSQL, SQLite and MongoDB. It never upserts. Repeated/concurrent acceptance succeeds without resetting `accepted_at` or emitting a duplicate `connections.updated`. Deleted/declined requests cannot be recreated by a stale accept. Self-request, blocked and outsider denial remain server-owned. No profile comments or request-note field was introduced.

Part 2 profile-layout visibility remains authoritative: social cards may not reuse the owner's hidden About/Links/Connections projection for peers. Google/Discord login, device identity, sessions, passkeys and key storage are unchanged.

## C-MESSAGE / C-HISTORY

Reuse `Engine`, `Receiver`, `Compose`, durable server acknowledgement, per-device queue and existing outbox/snapshot behavior. Message identity and wire payloads are unchanged. History uses paired `(serverTs,id)` cursors, a 60-item newest main page and separate message collections for pins, threads, files and media. Around/search windows remain detached until explicitly returning to latest. Ordinary opening/reopening/reload starts at newest; an active reader retains a pixel anchor across prepends, arrivals and late layout changes.

`Engine.markRead` snapshots the newest incoming text and queues the local counter reset before its first yield. Later arrivals queue behind that reset and are excluded from the click's receipt. Existing numeric `upTo` and encrypted control/self-only audiences remain compatible; no new cross-client marker type was added. Channel/large-group receipt suppression and disabled-receipt preferences remain unchanged. Same-timestamp read-marker granularity remains the existing timestamp protocol, unlike history's paired cursor.

Text is currently stored by the server and searchable. Do not describe this as server-resistant message E2EE. Part 3 does not change Part 4's attachment encryption/security boundary.

## Search

`GET /v2/messages/search` and `/v2/messages/summary` filter stored membership IDs through current `Authz.isMember`, including existing platform suspension. Direct scoped history/search retain the same authority. This adds local checks, with no extra service hop.

Inline search surfaces real loading/error/no-match states through Part 2 `StatePanel`, preserves the query and retries explicitly. Failed server search must not become an empty successful result. Existing 200ms debounce and stale-result cancellation remain.

`before:`, `after:` and new `during:YYYY-MM-DD` use local calendar boundaries. `during` is `[local midnight,next local midnight)`, including 23/25-hour DST days; date predicates intersect regardless of token order. Invalid dates remain literal query text. These filters still narrow loaded/retrieved candidates. The server text endpoint returns at most 100 candidates without a cursor; it is not an exhaustive filtered-search API. Mention/in/pinned predicates and filter-only historical pagination remain gaps.

## C-COMMUNITY / C-PERMISSIONS

Reuse the canonical organization resolver, catalog, role hierarchy, explicit deny rules, category/channel/member overwrites and membership reconciliation. The 29 direct Yapin permission leads map to existing Meldiq keys, not new grants. Keep organizer/room-manager event authority; no independent `manage_events` bit. `voice.move_members` currently disconnects, and does not authorize cross-channel movement. Keep owner/admin base roles and constrained `roles.delegate`; no blanket administrator permission was invented.

Part 4 must call the same authoritative checks when issuing or revoking media tickets, call tokens/tracks, bot actions and community entitlements. Frontend visibility is never sufficient. Private channels, timeout/read-only/text-only/no-GIF restrictions and nonprivileged auto/onboarding roles remain enforced by existing server paths.

## C-AUDIT / C-NOTIFICATIONS / C-POINTS

Keep existing audited actor/action/target/detail, private sealed reports, recipient routing and retention. A status resolution is not a sanction. Generic structured before/after changes, standalone community reports and staff recruitment require their own approved contracts.

Keep account pause, mute/category/channel inheritance, mention exceptions, Activity and per-conversation unread state. Global summary/search must use current authority. Foreground UI tests do not establish installed-client background push. Observed production Web Firebase configuration was absent; physical push/revocation remains Part 4.

Keep existing Embers ledger idempotency, earned totals, level conversion, credited-invite eligibility and privacy exclusions. Test fixtures now obey PostgreSQL's real community FK and one invite per `(org_id,joiner_id)`. No reward amount, paid benefit, leaderboard formula or freeze currency was changed.

## Existing events and lobby

Reuse both existing community event drafts and voice-room meetings; they are related but distinct models. Meetings already support invited accepted/declined/tentative responses, revision-checked organizer/room-manager edits, cancellation, weekly/biweekly/monthly/yearly recurrence and one starting-soon notice ten minutes ahead. These do not imply public Interested RSVP, external locations, covers, exact-start channel announcements or single-occurrence exceptions.

Reuse the current lobby editor, templates, layout fields, role cards, scoped activity, feed secret rotation and access-filtered cards. Bot/media/live publishers and native rendering remain Part 4 integration acceptance.

## Release compatibility

No schema/migration, new infrastructure, native Auth/Realtime cutover or production data change is required. Apply the companion API patch only on its recorded Part 2 parent after reconciling the current production overlay. Web/API runtime changes are compatible with current payloads. Part 4 must build immutable release artifacts, verify actual predecessor/provider/native behavior, deploy only the accepted scope and roll back application artifacts without restoring old customer data.
