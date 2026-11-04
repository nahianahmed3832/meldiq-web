# Part 3 verification record

4 November 2026, Asia/Shanghai. Full commands, source commits, environments and durable result summaries are in [validation.json](validation.json). Individual browser outcomes are in [browser-cases.json](validation/browser-cases.json). Feature acceptance is limited by the [212 row review](FEATURE_REVIEW.md).

| Final verification | Result | Limits |
| --- | --- | --- |
| Non-live Web unit tests | 144 files, 975 passed, 1 expected skip | No production requests |
| PostgreSQL domain/API/authority | 52 files, 467 passed, 1 Mongo-only skip | Existing bootstrap/migrations, isolated PostgreSQL 17, legacy delivery |
| Legacy adapter regressions | 4 files, 34 passed | SQLite plus explicit MongoDB history fixture |
| Dedicated MongoDB relationships | 17 passed | Real local MongoDB replica-set adapter, including retry and cancel race |
| Legacy activity | 14 passed | Includes the MongoDB collection-persistence check skipped by the PG-only run |
| Built-browser workflows | 51 unique passed, 13 expected skips | 64 scheduled cases; Chromium desktop 1440x900 / phone CSS 412x839, synthetic API/peers |
| Lint, format, i18n, API typecheck | Passed | i18n: 0 structural errors, 0 hardcoded source candidates |
| Normal production build | Passed | NEXT_PUBLIC_MELDIQ_TEST_LINKING=0; includes Web TypeScript, Next static export and service worker |
| Package/register validation | See validation manifest | All 568 IDs and both prior ownership sets must reconcile |

## Reproduced defects

1. Delaying the local conversation read while receiving a later message caused mark-read to clear its unread/mention and send through its timestamp. The before-fix test failed with unread/mentions 0 and upTo 200, where 1 and upTo 100 were required. The fixed real queue/store regression passes.
2. A repeated friend accept returned 404 after the first successful accept. It now preserves timestamp, emits one event for concurrent retries and does not recreate a removed request. All three relationship adapters passed.
3. A synthetic platform-suspension authority denial blocked scoped history/search but leaked the message through global search. The new aggregate filtering regression passes on PostgreSQL and SQLite. No real community was suspended.

Search error conflation and fixed-24-hour after-date arithmetic were also corrected. Browser failure/retry/no-match and local DST/calendar boundary tests pass.

## Initial failures and fixture corrections

The initial PostgreSQL tests included raw SQLite-only sealed-report inspection/retention writes, a MongoDB-only variant without a Mongo URI, an expected SQLite backend label under PostgreSQL, a raw deletion-table query, and invalid leaderboard invite FK/uniqueness fixtures. Corrections use the existing repositories and real fixture communities and preserve the assertions. PostgreSQL-specific selection does not remove the ordinary SQLite/MongoDB matrices. The Mongo collection inspection runs and passes separately.

Initial browser failures observed the retired messages endpoint rather than message-collections, expected /home rather than the canonical /lobby entry, selected both the reaction and add-reaction buttons, used old logout labels, or used a wrong label in the new search test. Observers/selectors were corrected. The pixel-anchor, ordering, count, controlled peer, stale-opening, logout-erasure and server-restoration assertions were preserved. A combined run had 41 pass / 10 fail / 13 skip before the two final corrected specs passed all 12 of their cases. De-duplicated final results are 51 pass / 13 skip, with no remaining failure.

The browser phone skips were already explicit desktop-only navigation/community/hover/panel cases. No physical device, Firefox/WebKit, real provider, actual push delivery, payment or production deployment acceptance is inferred.

## Visual review and preservation

Saved screenshots are synthetic local fixtures. The 1440 and 412 CSS-width search views were inspected. Text, result highlighting and controls remain legible. Desktop shared shell and full-width phone search are retained. Canonical teal/cream Meldling and Meldiq default palette are unchanged. No Google/Discord auth, official icon/handler, profile-privacy or palette source changed relative to Part 2.

No production account, message, sanction, schema or infrastructure changed. Local test services are stopped after verification; test data/logs remain under /tmp/meldiq-part3 for reproducibility during this workstation session.
