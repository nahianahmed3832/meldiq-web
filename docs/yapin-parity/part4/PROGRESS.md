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
