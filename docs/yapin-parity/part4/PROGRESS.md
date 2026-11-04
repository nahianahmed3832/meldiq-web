# Part 4 integration journal

Work active; no production changes.

- Created isolated integration branches in Web and API, preserving the dirty shared workspaces.
- Web integrates Part 2/3 commits and current production compact navigation (1153ca0).
- API starts from production cc61eb40 and selectively integrates 598f7c1d, 30e85347, d20408ce and 9b0b6e54. Held latency ancestors 4084dcaf–bd20d747 are deliberately excluded; formatting-only conflicts normalized before reconciliation.
- Initial integrated Web baseline: 147 test files, 983 passed, one skipped. API typecheck passed.
- Fixed capture-before-mute on silent join/rejoin and serialized push-to-talk release while microphone opening; focused tests pass. Full validation is still running.
- Six optional product groups explicitly deferred by owner; physical-device checks remain pending.

## Scope expansion

The owner explicitly selected a broader bot platform after the 99-row contract review (10 existing equivalents, 89 expansion rows). Those 89 rows remain in scope, not deferred. Preserve six earlier product deferrals. Work continues on dedicated bot authentication, explicit installation approval intersected with current role/channel authority, native domain-controller adapters, durable scoped events/replay, token-revoked gateway behavior and existing developer/community UI. No production deployment, new hosted-code execution, recording or blanket admin grants.

Validation checkpoint: Web 989 passed/one skip; PostgreSQL 107 suites, 785 passed/one skip; full legacy/API broad run 2,106 passed/five failures/25 skips, all five failures corrected in a 20-case rerun; normal non-test-linking PostgreSQL registration passes Chromium/Firefox/WebKit/phone; 11 original media/call browser passes plus three corrective/new passes; Android three integrated fixture-decoder checks pass; Windows current source integration typechecks and 109 shell tests pass, build/localization and dependency review ongoing.

## Broader platform checkpoint

API migration105/PG026, requested manifests, revision-checked installation approval, an allowlist of native controller adapters, preserved original lifecycle hooks, and bot credential separation are implemented. Three focused PostgreSQL suites pass20cases, including the original11 bot cases, five policy/authority cases and four contract checks. Architecture ownership was corrected to use public Authz membership checks; schema/architecture rerun is running. General events/gateway, DM consent, rich interactions and approval UI remain active work.

Windows imports the committed unified Web source40f594e while preserving39 documented native adaptations (safeStorage, OAuth/Discord handoff, checkout verification, native notifications, links, mute/DTX media behavior). Typecheck/109 shell tests pass and the integrated renderer build now succeeds. Native-only labels preserve available older translations with English fallback for added vocabulary; linguistic review remains pending. Shared Web28-language checks pass after allowing the legitimate identical Quiz label in de/it/nl/pl. Dependency audit retains Firebase/Firestore gRPC findings to assess against the actual renderer inventory; do not blindly downgrade Firebase using npm audit fix.

First bot slice committed: API40b5935089bd8c9870fc2d365229630c6f02b79b; Webscope/SQL7abb48d. Policy+architecture+schema14cases pass; bot/contracts20cases pass. Windows renderer build succeeds; its full embedded-Web run has988passes,1expected skip and one frame-audit expectation mismatch after preserving native DTX behavior. The existing native regression tests were three-way merged for that behavior and are being rerun. Derived webhook credential revocation and commit-ordered replay are explicit open security work before feature acceptance or release.

## Durable replay and credential checkpoint (2026-11-05)

API18a135c0 adds an API-private commit-ordered PostgreSQL journal, bot-bound encrypted cursors, seven-day ID-only replay, native history/collection adapters and a dedicated versioned bot gateway. The gateway covers identify/resume, heartbeat, presence, event batches and bounded request/response operations. Shared wake-up scans avoid one database polling loop per socket; ordinary user sockets and device credentials remain separate. Current token, plan, installation, native role/channel and history checks apply. An order-dependent permission fingerprint found by real-send testing was corrected with canonical grant ordering.

Bot-created webhooks and invitations retain denial bindings after deletion. Current scopes/roles, token revisions and installation identity apply; reinstalling a bot cannot revive a prior installation's secrets. Invitation creation rechecks its token revision inside the serialized write, including rotation after asynchronous preparation. Suspension and current plan locks apply to bot invitations. Human-created credentials retain their native behavior.

Ten PostgreSQL suites pass48cases, including gateway real-send/resume, user-token rejection, socket caps, rotation/uninstall closure, replay privacy/revocation, private journal RLS/rollback ordering, bot-invitation races, webhook credentials, original bots, policy, contracts, architecture and schema. Typecheck passes. Earlier failed diagnostic runs are not counted as completed validation. This is a source checkpoint, not broader-platform completion or production acceptance. DM consent, rich interactions, remaining REST surfaces, SDKs, permission review UI, capacity checks and full staging remain active.
