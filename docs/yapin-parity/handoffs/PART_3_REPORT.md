# Part 3 report — messaging, social and communities

4 November 2026, Asia/Shanghai. Work is isolated on `codex/meldiq-part3-ecosystem` in `/Volumes/code_files/meldiq_web_part3_ecosystem` and `/Volumes/code_files/meldiq_part3_api`. All **212 Part 3 rows** have a disposition. This is a local implementation/verification handoff, not a production release or a claim of 212 completed features. Exact counts and final results are in [validation](../part3/validation.json), with every remaining criterion in [feature dispositions](../part3/feature-dispositions.json).

Read [baseline](../part3/baseline.json) and [frozen domain contracts](../part3/CONTRACTS.md) before integrating. Web starts at Part 2 `e62fb19`; API starts at `598f7c1d`. A new automated public config request returned HTTP 403, so exact current runtime identity was not freshly established. Preserve the last verified Part 1 release and reconcile its overlay again for Part 4.

## 1. Features implemented

- `during:YYYY-MM-DD` search syntax uses the viewer's local calendar day, intersecting other date bounds. Shared syntax help includes it. This is a filter over retrieved/loaded candidates, not an exhaustive new search service.
- Search has distinct loading, failure, retry and no-match states, with query retention and stale-result suppression, using Part 2's existing `StatePanel`.
- Retry-safe recipient acceptance transitions in all three relationship adapters, with unchanged API response shape and no schema additions.

## 2. Features improved

- **Unread race fixed:** a deterministic test previously produced unread/mentions zero and a receipt through a message arriving after the click. Snapshotting the message boundary and queuing the counter change before yielding preserves that later unread/mention and bounds the receipt.
- **Friend acceptance fixed:** a lost response/repeated accept previously returned 404. A conditional pending-to-accepted transition now returns accepted on retry, keeps the original timestamp, emits one change for concurrent retries and never resurrects a removed request.
- **Aggregate authorization fixed:** a synthetic suspension previously denied direct history but still returned its text in global search. Global search and unread summaries now apply the same current membership authority.
- **DST date bounds fixed:** `after:` advances a calendar day rather than a fixed 24 hours, tested against 23- and 25-hour days. `during:` excludes the following midnight.
- Existing browser regressions now observe the active message-collections endpoint, canonical lobby navigation, unique reaction controls and Part 2 logout labels. Their delivery, pagination, pixel-anchor, revocation and server-history assertions remain.

## 3. Features already present and reused

Reuse existing DM/group send/edit/delete/reply/reaction/mention/typing/poll/thread pipelines, sealed controls, server acknowledgements, deterministic history cursors, disjoint search windows, separate pins/files/media/thread collections, server history and outbox/snapshot behavior. No duplicate messaging framework was built.

Reuse friends/requests/blocking/privacy/presence, community creation/discovery/invites/templates/branding/onboarding, channels/categories/forums, role hierarchy and effective permissions, moderation/reports/audits, notification inheritance/pause/Activity, Embers/levels/leaderboards, events/meetings and lobby cards/editor/feed. Source presence and related suite success do not automatically accept each UI or native criterion; see the row-level limits.

Meldiq remains the charcoal/lime default. Canonical teal/cream Meldling assets and branded expressions are preserved. Google and Discord login, their official icons and handlers remain unchanged.

## 4. Database changes

None to application schemas or production data. Tests use an owned PostgreSQL 17 cluster on loopback, with the existing bootstrap and all existing migrations. Each API harness creates and drops its own database. Legacy per-device delivery is explicitly selected, matching the observed runtime; this is not a hosted Supabase Auth/Realtime certification.

Relationship acceptance is a conditional update, not an insert/upsert. Test fixtures use existing adapter APIs for sealed reports, retention timestamps and deletion checks, select the actual backend, and seed valid invite communities/unique joiner-community pairs. No assertion was removed to obtain a pass. MongoDB-specific persistence inspection remains separately labelled and runs in the legacy adapter checks.

## 5. API changes

No endpoint, wire schema, auth method or catalog change. Internal `RelationshipStore.acceptConnection` is implemented for PostgreSQL, SQLite and MongoDB. The existing accept route is idempotent for already accepted pairs. Aggregate server-message routes now filter by `Authz.isMember`, closing suspension disclosure. Source and patch paths are in [validation](../part3/validation.json).

## 6. UI changes

Only the conversation search asynchronous states and literal date-syntax help changed. Shared shell/router/settings/dialogs, brand assets and authentication were reused. The retry button keeps the typed query; a failed fetch no longer reports no matches. Existing local filter-only limitations are documented rather than hidden.

## 7. Permission changes

Canonical permission semantics are unchanged. A current membership check is now also applied by aggregate search/summary. Existing tests exercise outsider/member/guest/moderator/owner roles, explicit denies, category/channel/member overrides, self-escalation, hierarchy, private channels, text-only/no-GIF/read-only policy, onboarding role safety, timeouts, moderation and privacy projections.

29 direct permission leads retain their Meldiq mapping. Separate `manage_events`, cross-channel movement and blanket administrator remain explicit decisions; no unsafe grant was added. Final media/call/bot/native enforcement remains Part 4.

## 8. Files modified

[File inventory](../part3/files.json) records every Web/API changed file. Application edits are limited to Web `src/sync/engine.ts`, `src/sync/searchQuery.ts`, `src/ui/chat/SearchPanel.tsx`, `src/i18n/syntax.ts`; API relationship routes/adapters and server-message aggregate routes. Remaining changes are regression tests, fixture portability and this handoff/register package. The original dirty application checkout was preserved.

## 9. Tests executed

[Validation manifest](../part3/validation.json) records commands, environments and log files. Coverage includes full non-live Web unit tests, lint/typecheck/format/i18n, PostgreSQL domain/API/authorization tests, SQLite/MongoDB adapter regressions and static-build browser workflows at desktop and phone widths. Browser media fixtures are synthetic; no real users, sanctions, provider consent, purchases or physical devices were involved.

## 10. Test results

Final results: **Web 975 passed / 1 skipped (144 files); PostgreSQL 467 passed / 1 Mongo-only skip (52 files); 51 unique built-browser cases passed / 13 expected skips (64 cases)**. SQLite/explicit MongoDB regressions passed 34, dedicated MongoDB relationships passed 17, and legacy activity passed 14. Lint, API typecheck, formatting, i18n and the normal test-linking-disabled build passed. Retries are not summed as distinct tests. Initial failures and their corrections are retained in the QA record: three state/authorization defects were reproduced before fixes, search error conflation and DST arithmetic were corrected, stale endpoint/selectors were updated and PostgreSQL fixtures were made valid without weakening assertions. Expected skips are explicitly explained.

## 11. Known bugs and limits

- Text search is capped at 100 server candidates without pagination; sender/date/attachment filters operate locally and filter-only queries do not search complete history. Combined mention/channel/pinned filters are not a complete server search implementation.
- Read receipts retain the existing numeric timestamp granularity; history pagination separately uses timestamp-plus-ID. This part does not introduce a cross-client read-marker protocol migration.
- Event, audit, optional program and voice-adjacent parity limits are concrete in the row dispositions. No current production defect is inferred from local fixture behavior without evidence.
- Exact current production overlay, all physical/native workflows and final installed-client background push remain unverified.

## 12. Partially completed features

All `IMPLEMENTED_NOT_ACCEPTED` rows identify the existing behavior, related evidence and remaining acceptance. Important partial areas are exhaustive filtered search, full moderation/report reviewer lifecycle, structured audit details, member bulk UX, native/media revocation, event versus meeting parity, responsive lobby ordering and real notifications. Existing UI smoke tests are not a substitute for their full acceptance matrix.

## 13. Remaining features

`DEFERRED_DECISION` rows explicitly identify missing product/authority/retention contracts: request notes, comments/likes, editable quick reactions, partner/staff programs, forum gallery, voice-associated text, speculative thread settings/role icons, standalone community reports, structured audit diffs, chat freeze policy, event covers, separate event-management grant, cross-channel movement and a blanket administrator bit. Preserve existing alternatives until these are approved; no fake functionality or invented backend was added.

The register retains every stable ID, original competitor verification and historical Meldiq-existing-status value. Only Part 3 implementation/testing/gap/notes fields changed; the other 356 rows remain unchanged.

## 14. Dependencies for Part 4

1. Reconcile the current production predecessor and newer overlay with both source commits/companion patch. Do not deploy a stale whole checkout or restore an old customer database.
2. Consume the frozen message/history/social/community/permission contracts. Preserve Google/Discord and Part 2 profile privacy/brand changes.
3. Enforce the same authority on uploads, range/tickets/downloads, bots and live tracks; test revocation in flight, private scope, timeout/read-only and switched/revoked accounts.
4. Accept real media/calls/expressions/native interoperability, installed push and provider consent on actual devices. Mock/local checks are clearly bounded.
5. Define approved optional event/audit/program/reward contracts before enabling their remaining features. No new product approval is implied by this handoff.
6. Run immutable production builds with test-linking disabled, verify the accepted release matrix, deploy only authorized scope, monitor and keep application-artifact rollback compatible with new customer writes. This Part 3 did not deploy or migrate production.
