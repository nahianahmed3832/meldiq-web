# Project control

Status: **Part 4 coordinated integration active; broader bot platform included; production/native release remains open**. Date: 5 November 2026, Asia/Shanghai. No production database/infrastructure mutation, destructive migration, multi-region change or deployment occurred.

Current integration: [source and validation](INTEGRATION_REPORT.md), [Part 4 checkpoint](handoffs/PART_4_REPORT.md), [release checklist](RELEASE_CHECKLIST.md) and [open execution report](FINAL_EXECUTION_REPORT.md). The master register retains all 568 IDs and original competitor verification. The current Part 4 reconciliation updates 135 owned rows and preserves 330 rows owned by other parts. Part 4 has 118 implemented-but-unaccepted rows, 14 approved deferrals, three active integration rows and 103 rows retaining their prior research/program-not-started state. These counts are not whole-project acceptance.

Prior local handoff: [Part 3 report](handoffs/PART_3_REPORT.md), [domain contracts](part3/CONTRACTS.md), [validation](part3/validation.json) and [212 row dispositions](part3/feature-dispositions.json). Part 3 counts remain **206 ACCEPTED, 2 IMPLEMENTED_NOT_ACCEPTED, 4 approved DEFERRED_DECISION**. The original 185 pending rows have 183 local acceptances; two external prerequisites remain. All 16 owner choices are resolved; the four deferrals were explicitly approved and require no current answer. ACCEPTED is the identified controlled Web/API scope, with production/native/provider bounds separate. The other 356 rows were unchanged at that handoff; subsequent Part 4 changes are recorded above. [Exact per-row cases](part3/completion/ROW_EVIDENCE.json) replace generic related-suite placeholders.

Part 2 handoff remains [available](handoffs/PART_2_REPORT.md), with [shared interfaces](part2/SHARED_INTERFACES.md) and 118 row dispositions. Its 19 local acceptances are unchanged. No local source-only or fixture result implies production deployment or all-client acceptance.

Owner decisions: minimum age **13+**; operator **GRIIPBUDDY LLC, Wyoming**, `contact@griipbuddy.com`, supplied Cheyenne address. [Prepared policies/release requirements](part2/legal/RELEASE_NOTES.md) replace the earlier unknown-age planning assumption, but the live policy and server acceptance ledger are not updated yet.

## Read order and source of truth

1. [Part 1 report](handoffs/PART_1_REPORT.md): totals, material findings and unfinished work.
2. [Current architecture](CURRENT_ARCHITECTURE.md): actual release identity and source drift.
3. [Feature register](FEATURE_REGISTER.csv): stable feature IDs, one owner, acceptance criteria and evidence.
4. [Journeys](USER_JOURNEYS.md), [screens](SCREEN_INVENTORY.md), [routes](ROUTE_INVENTORY.md), [evidence](EVIDENCE_INDEX.md).
5. [Roadmap](IMPLEMENTATION_ROADMAP.md), [decisions](DESIGN_DECISIONS.md) and [progress](EXECUTION_PROGRESS.md).

The CSV is the master feature register. The JSON records/counts are audit snapshots for reconciliation, not a competing implementation backlog. Update the CSV and progress documents together after work begins. Do not rerun a historical builder over later progress. IDs are permanent: append new IDs, retire with a reason and keep cross-references; do not renumber or delete rows to improve totals.

The register includes fine-grained permission keys, bot operations, bot events and gateway frames as separate surfaces alongside their parent product features. Counts represent register rows, not an independent count of wholly implemented products. A parent feature and its API operation must not be counted as two completed user journeys.

## Verification vocabulary

| Yapin status | Meaning |
| --- | --- |
| `VERIFIED_INTERACTION_CURRENT` | A bounded interaction was performed and its visible result checked on 4 November. It does not imply the entire acceptance criterion was tested. |
| `VERIFIED_WORKFLOW_HISTORICAL` | A bounded controlled workflow is supported by the earlier 1 November evidence. It was not silently rerun or promoted to a current result. |
| `OBSERVED_UI_CURRENT` | A screen or control was opened/read now. Saving, execution, delivery and server enforcement remain untested unless separately stated. |
| `OBSERVED_UI_HISTORICAL` | An earlier screenshot/text supports the visible control. Current availability and execution remain uncertain. |
| `UNVERIFIED_DOCS` | A public page, policy, roadmap, API schema or changelog claims it. Documentation was inspected; working behavior was not verified. |
| `UNVERIFIED_RESTRICTED` | A human step, second account, role, device, provider or payment prerequisite prevented execution. |
| `UNVERIFIED_NOT_FOUND` | Not located in the inspected surfaces. This does not prove product-wide absence. |

All three `UNVERIFIED_*` values explicitly satisfy the requirement to mark unverified behavior. Do not convert a screenshot into a passed interaction, a request start into a successful provider login, a plan card into a paid entitlement or health into delivery quality.

| Meldiq existing status | Meaning |
| --- | --- |
| `PRESENT_SOURCE` | A relevant source path or canonical capability was found. Exact runtime acceptance is outstanding. |
| `OBSERVED_LIVE_UI` | Current production UI was opened. The underlying provider workflow was not completed. |
| `PARTIAL` | Related implementation exists with a known capability, configuration, semantic or acceptance gap. Read the row before deciding whether code is needed. |
| `MISSING_IN_INSPECTED_WEB` | No equivalent found in the inspected deployed Web source. This is bounded to inspected source, not an assertion about every backend/native branch. |
| `INTENTIONAL_DIFFERENCE` | Current Meldiq policy/model differs; preserve it until an explicit decision. |
| `UNVERIFIED` | Insufficient evidence to establish the equivalent. Investigate rather than implementing a duplicate. |

No feature is marked newly broken merely because it lacks a test. No whole feature was freshly accepted end to end in Meldiq during this read-only audit.

`RESEARCH_REQUIRED` and `NOT_STARTED_IN_THIS_PROGRAM` describe this implementation program. They do not erase existing deployed code. Future implementation states may be `IN_PROGRESS`, `IMPLEMENTED_NOT_ACCEPTED`, `ACCEPTED`, `DEFERRED_DECISION` or `RETIRED_WITH_REASON`. Record test scenario, exact source, environment, result and evidence before `ACCEPTED`.

## Ownership boundaries

| Owner | Feature families | Explicit responsibility outside the headline categories | Shared-file rule |
| --- | --- | --- | --- |
| PART 2 | WEB, AUTH, PROFILE, LOOK, PREF, SHELL, TRUST | Public information architecture, creator identity/application UX, profile privacy presentation, shared accessibility primitives | Own shell/router/settings navigation and shared dialogs. Domain owners request a small interface change instead of rewriting the shell. |
| PART 3 | SOCIAL, MSG, SEARCH, COMM, CHANNEL, ROLE, MOD, NOTIFY, EVENT, LOBBY, GATE, PERM | Scheduled community events/RSVP, reward/activity policy, community and platform moderation | Own authoritative permission semantics, message history and social/community state. Shared media/call/button primitives remain Part 4. |
| PART 4 | VOICE, MEDIA, EXPR, BOT, BOTOPT, DEV, BILL, RELEASE, OPS, API, BOTEVENT, GATEWAY | All commerce lifecycle and entitlement contract work, status-service integration, native distribution and final release | Own media/call adapters, expression assets, bot/OAuth integration and billing. Part 2 hosts billing navigation; Part 3 supplies community authority. |

Every CSV row has exactly one `Owner` equal to its `Assigned implementation part`. Consultation and dependencies never create a second implementation owner. No human assignee is invented; the owner identifies the future conversation/part.

### Contract register

| Contract | Owning part | Content to freeze before consumers change |
| --- | --- | --- |
| C-AUTH | 2 | Existing account/device identity, session refresh/revocation, provider return handling, recovery/onboarding states; existing native clients remain compatible. |
| C-KEYS | 2 | Key restoration and verification boundary; account switch/logout must preserve or clear the correct protected stores. Changes need Part 3/4 protocol review. |
| C-SHELL / C-NAVIGATION | 2 | Stable destinations, back/focus behavior, mobile tabs, overlays, settings registry and scoped search hooks. |
| C-PROFILE | 2 | Global identity projections, draft/save semantics, visibility, community overrides and accessory rendering. |
| C-SOCIAL | 3 | Relationship and group state, DM eligibility, blocking and privacy projections. |
| C-MESSAGE / C-HISTORY | 3 | IDs, ordering, deterministic cursors, contiguous/disjoint windows, unread/read boundaries, outbox acknowledgements and optimistic failure behavior. |
| C-COMMUNITY / C-PERMISSIONS | 3 | Membership, effective permissions, hierarchy, owner-only powers, overrides and all content access checks. |
| C-AUDIT / C-NOTIFICATIONS / C-POINTS | 3 | Actor/reason/scope, notification inheritance and privacy, approved reward ledger behavior. Part 4 payment audit records use the same conventions. |
| C-CALL | 4 | Call state, silent joins, track consent, devices, measured quality and security verification. Part 3 retains moderation authority. |
| C-MEDIA | 4 | Drafts, original/optimized bytes, publication authorization, upload/retry, retention, playback and ticket/range/revocation behavior. |
| C-EXPRESSION | 4 | Membership-safe emoji/GIF/sticker catalog and ownership/favorites; Part 3 composer consumes it. |
| C-BOT / C-OAUTH | 4 | Credentials, scopes, review/install state, event delivery, interactions, consent and revocation; Part 3 remains domain authority. |
| C-ENTITLEMENTS / C-BILLING | 4 | Current catalog version/units/availability, server-owned purchases and grants, payment/webhook idempotency and effective community benefits. |
| C-RELEASE | 4 | Immutable source/artifact identity, accepted clients, current predecessor, deployment scope, monitoring and rollback compatibility. |

Contract IDs are dependencies, not invented current endpoints. Add concrete schema/function references as the owning part accepts each contract. Preserve the existing Next Pages static export, strict CSP and server-owned callbacks. Read the relevant installed `node_modules/next/dist/docs/` guide before code changes.

## Shared acceptance matrix

Each row's specific acceptance criterion is required. Apply the relevant additional cases below; mark irrelevant cases `N/A` with a reason rather than writing vacuous tests.

- Identity: owner, consenting peer, unrelated outsider, logged-out user, revoked/expired session, switched account and restored session.
- Authority: owner, moderator below target, ordinary member, guest, bot; inherited grants, explicit deny, channel override, multiple roles and higher-role targets.
- Async state: initial loading, settled empty, valid success, field validation, permission denial, feature disabled, quota/rate limit, timeout/offline, retry, cancellation and stale response.
- Durability: reload, reconnect, second device and concurrent update; repeated request/event must not duplicate sends, grants, charges or moderation actions.
- Reading/navigation: older history anchor, latest boundary, target jump, keyboard focus return, back navigation and unsaved draft recovery.
- Media/calls: cancel/deny capture, missing device, unsupported codec, silent initial join, disconnect/reconnect, revocation during transfer and measured output quality.
- Responsive/accessibility: desktop, 768px and 390px browser widths; keyboard and screen-reader names; physical phone safe areas/keyboard/capture/push remain separate tests.
- Billing: actual catalog offer/units, approved buyer and provider lifecycle, signed webhook verification, duplicate/reordered events, cancellation/refund/renewal/failure; mock checks are labelled.

Tests must run against isolated synthetic fixtures or explicitly authorized test accounts. This Part 1 does not authorize changing Meldiq production databases to obtain evidence. Do not contact unrelated Yapin users, install a bot, start recording, apply sanctions, make purchases or accept legal terms merely to complete a table.

## Investigation tickets that remain open

| ID | Required follow-up | Owner | Affected rows / gate |
| --- | --- | --- | --- |
| INV-001 | User completes new-account CAPTCHA/terms and verification; inspect first-ever onboarding without recording credentials. User said they will complete registration; completion is not yet confirmed. | PART 2 | AUTH-006–012; Journey J-01 |
| INV-002 | Controlled second account for friend/DM/group/block/privacy and role inheritance tests. | PART 3 | SOCIAL; ROLE; PERM; J-03–06 |
| INV-003 | User-assisted real Google/passkey/2FA/recovery, resend and expired/reused-link states. | PART 2 | AUTH; J-01–02 |
| INV-004 | Local profile/layout/avatar/preferences tested in Part 2; real provider consent, installed native projection, full audience/media matrix and conditional comment rollout remain open. | PART 2 | PROFILE; LOOK; PREF; comment domain consults Part 3 |
| INV-005 | Actual peer messaging, offline/reconnect, history windows and unread/read boundary acceptance on current Meldiq release. Historical defects are not presumed current. | PART 3 | MSG; SEARCH |
| INV-006 | Community non-owner join/onboarding, private/read-only/text/GIF gates, role conflicts and moderation enforcement. | PART 3 | COMM; CHANNEL; GATE; PERM; MOD |
| INV-007 | Events creation/RSVP/edit/end/recurrence and announcements with controlled participants. | PART 3 | EVENT |
| INV-008 | Actual multi-party voice/camera/screenshare, delivered quality, capture denial and physical devices. | PART 4 | VOICE; RELEASE; J-07 |
| INV-009 | Current authenticated media transfer/ranges/revocation, upload quotas/animation and older-client compatibility. | PART 4 | MEDIA; EXPR |
| INV-010 | Bot lifecycle beyond historical Helper help, third-party requested-permission review, webhook/OAuth and all documented API/events/frames. | PART 4 | BOT; DEV; API; BOTEVENT; GATEWAY |
| INV-011 | Real approved buyer/payment/3DS/signed-webhook/renewal/cancellation/refund evidence. Keep disabled card capabilities disabled. | PART 4 | BILL |
| INV-012 | Authorized Yapin platform administrator role; actual staff queues and cross-community actions remain inaccessible. | PART 3 | MOD-019; J-08 |
| INV-013 | Hosting-provider confirmation of API/LiveKit/ntfy compute location; reconcile user's Frankfurt baseline with owning deployment report. | PART 4 | Architecture; no relocation authorized |
| INV-014 | Exact backend source/overlay manifest against running API image, current schema/indexes and restore/SLO evidence through authorized read-only checks. | PART 4 | Architecture and C-RELEASE |
| INV-015 | Native Android/Windows installed-version parity, real OAuth return, push/capture/calls and Windows publisher signing. | PART 4 | RELEASE |
| INV-016 | Optional policies/products: clips/report recording, soundboard, paid creator economy, hosted bot code, blanket administrator semantics and new paid placement. | PART 4 | Decision gates; domain owners consulted |
| INV-017 | Public tutorial playback, external installers/SDK links and additional dynamic bot/invite/profile instances only where a scoped implementation needs them. | PART 4 | Route limits; do not repeat the whole site investigation |
| INV-018 | Current Web Firebase background configuration and actual foreground/background notification delivery. | PART 3 | NOTIFY-007; architecture |

Feature references without `YAP-` in the ticket table use the same stable prefixes as the CSV. Tickets are not a claim that every listed prerequisite must block unrelated work. Continue independently on already-evidenced features; revisit only the relevant unresolved scenario.

## Change and release control

Before implementation, record the then-current active image/source/configuration and dirty-tree status. Reconcile the 3cc3c03 baseline and preserve newer work. Claim a row and shared contract in progress notes before editing a shared file; hand consumers a concrete interface and test fixture. A consumer does not rewrite another part's domain to unblock itself.

For each future accepted feature record source revision, exact changed behavior, test environment, bounded cases/results and any remaining limitation. Production authorization is determined by subsequent user instructions; this research request authorizes no deployment or database mutation. Do not infer permission to migrate, enable native Supabase transport or replace a production database from the word parity.

Final integration requires the then-current release predecessor, immutable artifacts, compatible server and clients, completed relevant P0 cases, truthful public copy, monitoring and a version-aware rollback that does not overwrite later customer state. Documentation-only Part 1 validation is tracked separately from application validation.
