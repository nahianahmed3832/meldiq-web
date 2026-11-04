# Part 3 completion report — messaging, social and communities

4 November 2026, Asia/Shanghai. **183 of the original 185 pending rows now pass the recorded local Web/API acceptance scope.** The other two have explicit external prerequisites below. All 16 owner choices are resolved: 12 enabled/retained outcomes are accepted locally and four features remain deferred as approved. Together with the previous 11 acceptances, the 212 owned rows are **206 ACCEPTED, 2 IMPLEMENTED_NOT_ACCEPTED and 4 approved DEFERRED_DECISION**. No production deployment or migration occurred.

The [master register](../FEATURE_REGISTER.csv), [row evidence](../part3/completion/ROW_EVIDENCE.json), [dispositions](../part3/feature-dispositions.json) and [validation manifest](../part3/validation.json) reconcile. Original competitor verification/existing-capability columns and the other 356 rows are unchanged. Acceptance means the identified controlled local cases; it does not certify every native/provider/production condition.

## 1. Features implemented

Implemented recipient-only request notes; account-synced quick reactions; protected forum gallery/filtering/paging and required/restricted tags; associated voice-channel text without an audio join; validated role icons; private partner applications and operator review; whole-community reports; redacted administrative before/after changes; event covers and delegated event management. Retained disconnect-only voice movement and constrained owner/admin delegation.

Added missing managed polls/quizzes with server-enforced options, expiry, membership, hidden correct answers until voting closes and anonymous public projections. Added community-thread author close/reopen, delegated-manager lock/unlock and resumable bounded deletion. Added colon emoji completion, normal-message Markdown and long-message expansion using existing catalogs/rendering/components.

## 2. Features improved

Search filters run before native database paging, including edits/deletes, sender/mention/channel/attachment/pin/date constraints and deterministic cursor ties. Member directories filter/page natively with totals, safe loaded-member selection and atomic role changes. Event occurrence versus series edits/cancellation and independent future RSVPs are explicit. Lobby desktop/phone ordering, linking/reset, keyboard controls and template cancellation are explicit.

Message edits, deletion and pins confirm through the existing API before local mutation; failures preserve original content and the owning draft/confirmation. Repeated attempts retain control IDs; late edit acknowledgements preserve newer edits/deletion. Long-message expansion preserves the reading anchor through focus/layout changes. Friends, lookup/group/global search and Activity distinguish failed requests from empty answers and support retry. Unfollow preferences sync per account, override implicit Activity participation and suppress ordinary thread wake-ups while preserving direct mentions.

## 3. Existing features reused

Reused the shared application shell, charcoal/lime Meldiq theme, canonical teal/cream Meldling, Google/Discord identities and login handlers, account/device/session model, history windows/cursors, outbox, message-control pipeline, role resolver, moderation/report/audit stores, media validation, community/lobby/event services, notifications and Embers rules. No duplicate social or messaging backend was created. Ordinary top-level sends gain no additional application network hop.

## 4. Database changes

Ten additive local SQLite migrations (095–104) and matching PostgreSQL migrations (016–025) add request notes, event covers, role icons, community report targets, partner applications, audit changes, forum-tag policy, event-occurrence overrides, managed polls/ballots and thread lifecycle/preferences. PostgreSQL poll/thread tables have RLS and direct-client grants revoked; API projections apply current membership/history/authority checks. Lobby ordering remains validated existing JSON settings. No production schema was changed.

## 5. API changes

New poll state/vote/close, thread state/change/delete/follow/preferences, partner submission/operator review and related existing domain extensions are recorded in [contracts](../part3/CONTRACTS.md). OpenAPI/realtime schemas and Web fixtures were regenerated; Web pins API `9b0b6e5493695a3bec1d620b0d7fac6f320238c0`. Legacy polls stay readable; older apps receive managed-poll text fallbacks. New native interactive controls remain an integration task.

## 6. UI changes

All controls use the shared panels, buttons, dialogs, confirmation, focus behavior and original assets. New flows include retryable notes/preferences, event cover/occurrence/location choices, forum controls, member selection previews, role assets, private partner/report workflows, audit details, poll/quiz creation/results and thread management. Keyboard/touch/desktop and tablet/phone CSS widths are covered by the listed browser cases. Physical safe areas, keyboards, notification receipt and capture are separate checks.

## 7. Permission and privacy changes

`events.manage` delegates event management without bypassing channel visibility. `partners.review` is a constrained sensitive operator permission, super-admin by default; self-review is denied and approval grants no badge/role/entitlement. Thread authors manage their own community threads; canonical thread managers moderate them. Deletion stores explicit parent intent, checks current authority per target and uses scoped internal grants. Text parents remain; forum parents are deleted last.

Request notes are at most 300 Unicode code points, recipient-only and removed when requests end. Audit changes allow administrative metadata and redact private content/credentials/evidence. Community reports go privately to Meldiq operators with duplicate protection and no automatic sanction. Anonymous poll projections omit voter identity; the server retains account-linked ballots to enforce votes. Current messages/polls are server-readable, and global message deletion follows existing journal/projection retention; private poll keys/ballots are erased. No server-resistant E2EE claim is made.

## 8. Files and source

| Repository | Immutable source | Workspace |
| --- | --- | --- |
| Web | `fe6f294dc7ba2963df8f7ca8ca421e17c5118ab5` | `/Volumes/code_files/meldiq_web_part3_ecosystem` |
| API | `9b0b6e5493695a3bec1d620b0d7fac6f320238c0` | `/Volumes/code_files/meldiq_part3_api` |
| Operator console | `8a10c4bae41fcac023f849a582fdd95f97ab8457` | `/Volumes/code_files/meldiq_part3_admin` |

All use `codex/meldiq-part3-ecosystem`. [File inventory](../part3/files.json) records exact paths. [Source and patch receipts](../part3/completion/SOURCES.json) include bases, heads and SHA-256 hashes for companion patches 0017–0019. Apply only to their recorded compatible bases. The original dirty application checkout was preserved; shared documentation is synchronized separately.

## 9. Tests executed

Native PostgreSQL domain/API/authorization, SQLite/Mongo adapter regressions, Web unit/protocol/permission tests, built Chromium workflows, operator-console tests/browser workflows, typecheck, lint, formatting, 28-locale structural checks, normal production build with test-linking disabled, artifact-tool register reconciliation and package validation. Full commands, suites and result files are in the [validation manifest](../part3/validation.json).

## 10. Results

| Check | Recorded result |
| --- | --- |
| Web unit | 147 files; 983 passed, 1 existing skip |
| Native PostgreSQL | 96 files; 686 passed, 1 Mongo-only skip, deduplicated broad run plus corrected settings-suite rerun |
| Current poll/thread/settings legacy + architecture | 4 files; 31 passed |
| Built browser | 134 unique passes, 15 existing skips across 149 file/title/project cases; no unresolved failure |
| Operator console | 7 files; 33 unit passes; 2 desktop/phone-width workflow passes |
| Typecheck/lint/format/build | Passed; normal build uses `NEXT_PUBLIC_MELDIQ_TEST_LINKING=0` |
| i18n | 6,292 keys in 28 locales; zero structural/hardcoded-source errors; native-speaker review pending |

Overlapping reruns are not added to unique totals. Earlier failures are retained and explained in [QA](../part3/QA_REPORT.md), including the actual deletion-cursor and expansion-anchor bugs. Browser notifications use controlled service-worker/transport fixtures and do not establish physical receipt. Existing skips are listed per case in the evidence.

## 11. Known bugs and limits

No unresolved failure remains in the recorded local acceptance cases. This is bounded evidence, not a guarantee about untested environments. Current production reconciliation, real browser-model output, real provider consent, OS/hardware output, native interaction updates, hosted Auth/Realtime and multi-node/load/restart capacity are not certified. Thread management is scoped to community threads; existing DM thread history remains compatible. Persisted deletion interruption/resume is tested; a full production crash/failover exercise is not claimed.

## 12. Partially completed features

- **YAP-NOTIFY-007:** physical installed-client/background push, permission, receipt, tap routing and logout/revocation remain pending by the owner’s explicit choice. Web/API fixture checks passed.
- **YAP-MOD-019:** Meldiq operator Web/API review and permission checks passed. Authorized Yapin platform-staff reference access is unavailable, so direct observation of its restricted administrator experience remains unverified.

## 13. Remaining features and decisions

Four owner-approved deferrals remain: SOCIAL-018 comments/likes, CHANNEL-018 future per-channel thread settings, MOD-018 staff applications and NOTIFY-013 streak freezes. Preserve current privacy/moderation and Embers rules. They require no new answer for this scope. All 16 choices are recorded in [OWNER_DECISIONS.json](../part3/completion/OWNER_DECISIONS.json); unanswered decisions: **zero**.

## 14. Part 4 dependencies

Reconcile the then-current production Web/API/native source and overlay before integration. Review/apply the additive migrations in an authorized controlled rollout; keep application rollback compatible with persisted data. Consume the current message/history/role/event/report contracts in native/media/call/bot integrations. Verify real installed-client push, native poll/thread controls, provider/OS behavior, media revocation and relevant capacity/failover gates. Keep billing/provider capabilities behind their existing gates. Use the verified normal build and obtain deployment authorization only for a concrete reviewed release; this handoff has not deployed anything.
