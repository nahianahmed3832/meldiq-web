# Coordinated integration report

Status: active candidate, 5 November 2026. No production deployment or production database mutation occurred. The broader bot platform is included. This report records the current checkpoint; it is not release acceptance.

## Source candidates

| Component | Source | Current boundary |
| --- | --- | --- |
| Web | `f8e378b29bf3cadbf6bf8f5f7c25a2a228f553b0` | Parts 2/3, current compact navigation, scoped bot platform, consent, rich controls, encrypted bot voice, separately approved file sharing and SDK downloads. Full-screen call connection details and the configured-lobby mobile channel drawer are integrated. Forty-five ordinary email/media/poll/navigation/icon journeys pass on five projects against the compiled API; test-only follow-up `b92182e` is separate. |
| API | `031089388da4430fedfd7c85de1dd8c80964886e` | Implementation742cc188; later tests/docs only. Production-derived API plus selected Part 2/3 commits and additive bot features. Held latency ancestors remain excluded. |
| API qualification | `43d837cbb30c2b25a7643bae37cf8fd68add8404` | Additional tests and explicit backend harness corrections only; no runtime or contract difference from the API pin. |
| Windows | `a4694825e52dda88af62264ae8cfd1cf47bb2a32` | Committed Web import with 39 documented native adaptation entries. Development build and isolated macOS Electron smoke pass. Physical Windows acceptance is pending. |
| Android | `5dc08d81bef51c2dc1114d387ccfb176d8189866` | Immutable combined source and current API contracts; 1,019 JVM passes/12 skips, device-test compilation and checked side-by-side debug APK. Installed/native UI acceptance remains open. |
| Admin | `8a10c4b` | Current-API contracts and33 unit cases pass using explicit MELDIQ_SERVER_DIR; lint/build pass. Full operator journeys remain pending. |

The Android candidate snapshots the sole combined workspace without changing its original branch or index. All 2,122 source hashes match. The APK excludes 1,197 development contract captures and preserves all 24 runtime assets byte for byte, including the sticker catalog. Three current realtime frame types now decode; thread preferences update the local projection. Full managed-poll/thread UI and bidirectional/reconnect follow synchronization remain open. See [combined native source receipt](part4/evidence/android-combined-source-checkpoint.json).

## Included bot behavior

The candidate adds requested scopes and revision-checked installation approval intersected with current native authority. Bot credentials remain separate from human sessions and sockets. Native adapters cover community administration, current message history, reactions, pins, moderation, invitations, expressions, events and webhooks. Derived credentials retain revocation/installation bindings. Private PostgreSQL events support bounded durable replay and a dedicated versioned gateway. JavaScript and Python preview clients are pinned to the generated native contract.

Personal bot messaging requires recipient consent and current access. Rich posts, buttons, selects and forms use source-bound private interactions, native content restrictions and commit-time publication checks. Community voice uses an approved public-key manifest, a separate bounded media lease, human-sealed room keys and durable media-removal metadata. Existing active local rooms are supported; empty-room bot initiation remains outstanding. The receive grant covers room audio, camera video, screen shares and other in-call content. Microphone-only limits apply to publishing. Current approval/SDK text discloses that distinction; saved-token probes observe application-side removal, without claiming provider JWT invalidation. Fifteen continuous-source replay checks across five browser projects decode no matching revoked source tone; some probes still receive nonmatching frames. An earlier WebKit probe received 25 frames of undetermined content. Instantaneous revocation and all failure timings remain unverified.

Community file uploads/downloads require separate approved scopes, current native post/attach/history authority and the captured installation identity. Interrupted uploads and withdrawn streams refuse publication or close storage readers. Human browser downloads decrypt to the original bytes. The optional in-memory JavaScript helper is limited to64 MiB; native quotas and larger direct/chunk protocols remain unchanged. The attachment-v2 relay can see keys, so this is not server-resistant E2EE.

The 99-row bot matrix now has 98 native source counterparts marked `IMPLEMENTED_NOT_ACCEPTED` and one approved destination-move deferral. These are overlapping operation/event/frame rows, not 98 accepted user journeys. Yapin API behavior remains `UNVERIFIED_DOCS`. See [the matrix](part4/BOT_CONTRACT_MATRIX.json).

## Validation

| Scope | Result |
| --- | --- |
| API regression | Earlier focused bot/native batches pass. The fresh complete PostgreSQL-default run passes1,908cases across235files with23cases/four files skipped. Broader failed diagnostics and bounded corrections are recorded separately. See the regression receipt below. |
| API file/SDK regression | 9 files, 71 cases passed; latest installation follow-up:4 files, 24 cases, including 11 file cases. Counts overlap. |
| API native events and administration | 3 files, 22 cases passed, including native member/invite and voice journal variants. Voice event checks use an SFU control-plane stand-in. Earlier event/gateway/SDK batch:21 cases; counts overlap. |
| Web | 150 files, 998 cases passed, one existing skip. Two crypto cases pass after the internal error-code correction. |
| Browser | 28 combined bot journeys pass across four projects. Eight current file/SDK checks across Chromium, Firefox, WebKit and phone-width: explicit approval, encrypted upload/publication, matching human plaintext download, withdrawal and SDK integrity. Later disclosure/camera/SDK checks pass 12 cases across those four projects. Fifteen additional replay checks use an actual native peer continuously publishing a known tone with DTX disabled across Chromium, Firefox, WebKit, phone-width and iPhone-width. These are bounded browser/native-SFU samples, not physical-device or instantaneous-revocation proof. |
| Gateway capacity | 100 actual authenticated sockets receive 40 messages each; per-bot/address/global limits and slot reuse pass. Same-process loopback qualification, not production capacity. |
| Ordinary Web export | Current runtime: 45 passing ordinary email/media/poll/navigation journeys on five browser projects, using compiled API and test-linking disabled. 478 files, no source maps/raw TypeScript. SHA-256 `97659798b81d74c9fd05126f73a34208941f006ae5597e25790bfa6708bd62fd`. Earlier 12 signup/recovery/session/input checks remain historical scoped evidence. |
| Android | Combined source: 1,019 JVM passes, 12 skips across 195 files, device-test compilation and debug APK pass. All source hashes and runtime assets verified. Initial missing-frame diagnostic (1,018 passes/one failure) corrected; device tests compiled but not executed. Prior selected HPKE interoperability evidence retains its narrower scope. |
| Windows | 109 shell cases and 1,001 embedded-Web cases passed, with one skip. The explicit current API path also enables the contract-source comparison that was previously skipped. Typecheck, lint, build, localization and isolated Electron smoke passed. The initial one-second locale wait failed once; six focused cases and a fresh four-worker full run pass. |
| Admin | 33 cases pass against current API contracts via explicit MELDIQ_SERVER_DIR. Lint and build pass. Earlier default-path32pass/1skip is superseded; full operator journeys remain open. |
| Localization | 28 catalogs, 6,305 keys, zero structural errors or hardcoded candidates. Linguistic review remains pending. |

The local browser stage uses disposable loopback PostgreSQL with all 34 additive migrations and hosted Auth/Realtime test stubs. It does not prove hosted provider behavior. The SDK ZIP pins API `031089388da4430fedfd7c85de1dd8c80964886e` and contains 13 files, 240,495 bytes, SHA-256 `e182cb81a15d0570a3eb3a0397570495a490779e2eac44739519b7d78df6ec6c`.

Exact receipts: [broader regression/capacity](part4/evidence/bot-broader-regression-checkpoint.json), [current ordinary export/compiled API](part4/evidence/integrated-icons-normal-artifact.json), [API source/compiled archives](part4/evidence/broader-bot-api-artifact.json), [files and events](part4/evidence/bot-files-checkpoint.json), [media](part4/evidence/bot-voice-media-checkpoint.json), [saved-grant probe](part4/evidence/bot-media-replay-checkpoint.json), [native integration](part4/evidence/native-integration-checkpoint.json), and [progress](part4/PROGRESS.md). Earlier failed diagnostics are not counted as clean passes. Physical-device checks remain pending by owner choice.

Local encrypted recovery now passes against 308 fixture tables and cold runtime files, including sealed reports/cursor keys, returning human access, live messages, original downloads, preserved human integrations/withdrawn consent and quarantined bot/derived credentials. Tracked predecessor source `cc61eb40` also passes bounded ordinary/denial checks with current local dependencies and a local route-hold proxy. Seven real CLI refusal checks pass. See [application recovery](part4/evidence/recovery-application-checkpoint.json), [database recovery](part4/evidence/recovery-database-checkpoint.json), [guard checks](part4/evidence/recovery-guard-check.json), and the API recovery guide. Exact production container/overlay, fresh-cluster role globals, actual provider recovery and production proxy behavior remain open.

## Open work

Remaining implementation/qualification includes remaining attachment/client and native event/adapter variants, empty-room bot initiation, complete installed-native integration and same-candidate journeys, the durable age/policy acceptance ledger, and the remaining Part 4 register review. Full performance, remaining coordinated release artifacts, staging journeys, backup/restore and rollback rehearsal remain release gates. Live provider consent and real buyer/payment evidence are separate from mock or local API checks.

Frankfurt remains the authoritative deployment/database target. No extra regional app hop, region, destructive migration, quota/pricing change, hosted bot execution, recording, soundboard, paid promotion or creator settlement was added. Existing Google/Discord login, charcoal/lime branding, Meldling, native safeguards and disabled card capabilities are preserved.
