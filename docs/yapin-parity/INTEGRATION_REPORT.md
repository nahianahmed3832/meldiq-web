# Coordinated integration report

Status: active candidate, 5 November 2026. No production deployment or production database mutation occurred. The broader bot platform is included. This report records the current checkpoint; it is not release acceptance.

## Source candidates

| Component | Source | Current boundary |
| --- | --- | --- |
| Web | `a0a27ff82f9cf07bf157245271d513c66bbd9ae5` | Parts 2/3, current compact navigation, scoped bot platform, consent, rich controls, encrypted bot voice, separately approved file sharing and SDK downloads. The ordinary Web export and 12 normal account/input journeys pass; final coordinated artifacts remain pending. |
| API | `031089388da4430fedfd7c85de1dd8c80964886e` | Implementation742cc188; later tests/docs only. Production-derived API plus selected Part 2/3 commits and additive bot features. Held latency ancestors remain excluded. |
| API qualification | `43d837cbb30c2b25a7643bae37cf8fd68add8404` | Additional tests and explicit backend harness corrections only; no runtime or contract difference from the API pin. |
| Windows | `1c1bb378f36e1ba10b85230b910261ca441bb92a` | Committed Web import with 39 documented native adaptation entries. Development build and isolated macOS Electron smoke pass. Physical Windows acceptance is pending. |
| Android | `3d5f6bb1436acd24cb2281ffd01ad4e6376c1fca` | Isolated bot-voice source checkpoint. The sole combined workspace compiles; complete native source integration remains open. |
| Admin | `8a10c4b` | Current-API contracts and33 unit cases pass using explicit MELDIQ_SERVER_DIR; lint/build pass. Full operator journeys remain pending. |

The Android checkpoint applies its BOT label to the committed predecessor's tile layout. The working folder retains the owner's newer uncommitted UI and existing changes. The combined working source, rather than a standalone APK from that checkpoint, was compiled. See [native source receipt](part4/evidence/android-bot-voice-source-checkpoint.json).

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
| Web | 149 files, 996 cases passed, one existing skip. Two crypto cases pass after the internal error-code correction. |
| Browser | 28 combined bot journeys pass across four projects. Eight current file/SDK checks across Chromium, Firefox, WebKit and phone-width: explicit approval, encrypted upload/publication, matching human plaintext download, withdrawal and SDK integrity. Later disclosure/camera/SDK checks pass 12 cases across those four projects. Fifteen additional replay checks use an actual native peer continuously publishing a known tone with DTX disabled across Chromium, Firefox, WebKit, phone-width and iPhone-width. These are bounded browser/native-SFU samples, not physical-device or instantaneous-revocation proof. |
| Gateway capacity | 100 actual authenticated sockets receive 40 messages each; per-bot/address/global limits and slot reuse pass. Same-process loopback qualification, not production capacity. |
| Ordinary Web export | Built with test-device linking disabled;12signup/recovery/session/input checks pass across four browser projects.477files; no source maps or uncompiled TypeScript. Archive identity is recorded separately. |
| Android | Compilation and 20 selected call/crypto/fixture cases passed. Node and Android open each other's synthetic HPKE packets and reject changed context. |
| Windows | 109 shell cases and 999 embedded-Web cases passed, with one skip. The explicit current API path also enables the contract-source comparison that was previously skipped. Typecheck, lint, build, localization and isolated Electron smoke passed. |
| Admin | 33 cases pass against current API contracts via explicit MELDIQ_SERVER_DIR. Lint and build pass. Earlier default-path32pass/1skip is superseded; full operator journeys remain open. |
| Localization | 28 catalogs, 6,305 keys, zero structural errors or hardcoded candidates. Linguistic review remains pending. |

The local browser stage uses disposable loopback PostgreSQL with all 34 additive migrations and hosted Auth/Realtime test stubs. It does not prove hosted provider behavior. The SDK ZIP pins API `031089388da4430fedfd7c85de1dd8c80964886e` and contains 13 files, 240,495 bytes, SHA-256 `e182cb81a15d0570a3eb3a0397570495a490779e2eac44739519b7d78df6ec6c`.

Exact receipts: [broader regression/capacity](part4/evidence/bot-broader-regression-checkpoint.json), [current ordinary export](part4/evidence/bot-media-disclosure-web-normal-artifact.json), [files and events](part4/evidence/bot-files-checkpoint.json), [media](part4/evidence/bot-voice-media-checkpoint.json), [saved-grant probe](part4/evidence/bot-media-replay-checkpoint.json), [native integration](part4/evidence/native-integration-checkpoint.json), and [progress](part4/PROGRESS.md). Earlier failed diagnostics are not counted as clean passes. Physical-device checks remain pending by owner choice.

## Open work

Remaining implementation/qualification includes remaining attachment/client and native event/adapter variants, empty-room bot initiation, complete native integration and same-candidate journeys, the durable age/policy acceptance ledger, and the remaining Part 4 register review. Full performance, remaining coordinated release artifacts, staging journeys, backup/restore and rollback rehearsal remain release gates. Live provider consent and real buyer/payment evidence are separate from mock or local API checks.

Frankfurt remains the authoritative deployment/database target. No extra regional app hop, region, destructive migration, quota/pricing change, hosted bot execution, recording, soundboard, paid promotion or creator settlement was added. Existing Google/Discord login, charcoal/lime branding, Meldling, native safeguards and disabled card capabilities are preserved.
