# Part 3 verification record

Current results and commands are in [validation.json](validation.json); immutable sources/patches in [SOURCES.json](completion/SOURCES.json); each owned criterion and its actual case names in [ROW_EVIDENCE.json](completion/ROW_EVIDENCE.json). Earlier files in validation/ and timestamped completion journal entries are historical checkpoints.

| Verification | Result |
| --- | --- |
| Final Web unit execution | 147 files, 983 passed, 1 existing skip |
| Native PostgreSQL domain/API | 96 files, 686 passed, 1 Mongo-only skip across broad run plus corrected settings rerun |
| Current SQLite/Mongo poll/thread/settings + architecture | 4 files, 31 passed |
| Unique built-browser cases | 134 passed, 15 existing skips, zero unresolved failures across baseline/corrective runs |
| Operator console | 33 unit passes in 7 files; 2 desktop/phone-width browser passes; lint/build passed |
| API typecheck, Web lint/format, production build | Passed; normal build disables test-linking |
| Locale structure | 28 locales, 6,292 keys, zero structure/hardcoded-source errors; native-speaker review remains pending |

## Failure history and fixes

The initial thread worker repeatedly processed deletion tombstones and inflated its count. It now persists target/cursor settlement and finishes a 29-reply cleanup; text parents remain and forum parents are deleted last. The expansion geometry test found a 391px desktop reading jump. Explicit before/after layout intent now keeps the existing viewport anchor through focus/ResizeObserver changes; the same geometry assertion passes at desktop/tablet/phone widths.

Architecture checks rejected newly introduced private-module/table accesses. Public owning interfaces replaced them; no allowlist growth was used. The older settings suite unconditionally selected memory/Mongo adapters during a native PG run. Its adapter selection follows the existing PG convention; all 14 native cases and the legacy variants pass. The PG aggregate is therefore deduplicated across the broad run and that corrected rerun, not described as one clean whole execution.

Snapshot edit/delete actions now reject to their owning editor while preserving former notices, waiting cleanup and original content. Their tests retain those assertions and additionally assert rejection. The first default-high-parallel Web run timed out in the i18n negative-fixture test; the final bounded two-worker execution passes all 147 files without increasing timeouts or removing assertions.

Browser observers were corrected for a closed tablet drawer, Mac shortcut, the edited label sharing a class with Sent, and the existing lowercase emoji label. Those corrections retained the required behavior checks. Failure logs and passing receipts are saved under completion/evidence; overlapping attempts are not summed.

## Bounds

Browser phone widths/reference protocol clients and controlled service-worker/wake fixtures do not prove physical push. Real provider consent/model output/OS hardware behavior and native distribution remain unverified. No real payment or customer moderation/report action occurred. All original competitor verification labels remain unchanged. The two pending rows and four approved deferrals are explicit in [FEATURE_REVIEW.md](FEATURE_REVIEW.md).
