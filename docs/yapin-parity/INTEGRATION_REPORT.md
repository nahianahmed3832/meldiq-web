# Coordinated integration report

Status: active candidate, 5 November 2026. No production deployment or production database mutation occurred. The broader bot platform is included. This report records the current checkpoint; it is not release acceptance.

## Source candidates

| Component | Source | Current boundary |
| --- | --- | --- |
| Web | `53b60ff3a8879c7437d9267bd47a7fff8d58fe6b` | Parts 2/3, current compact navigation, scoped bot platform, consent, rich controls, encrypted bot voice and SDK downloads. Normal release export remains pending. |
| API | `1460e9966746a05524653b4bdce203842dd8af56` | Production-derived API plus selected Part 2/3 commits and additive bot features. Held latency ancestors remain excluded. |
| API qualification | `cf826c33d8eec8b6188ee43d1073acccca2c86b9` | Additional tests only; no runtime or contract difference from the API pin. |
| Windows | `6c9edeef5358f4e5c05026e0150d611b67d866dc` | Committed Web import with 39 documented native adaptation entries. Development build and isolated macOS Electron smoke pass. Physical Windows acceptance is pending. |
| Android | `3d5f6bb1436acd24cb2281ffd01ad4e6376c1fca` | Isolated bot-voice source checkpoint. The sole combined workspace compiles; complete native source integration remains open. |
| Admin | `8a10c4b` | Part 3 integration checkpoint. Final same-candidate regression remains pending. |

The Android checkpoint applies its BOT label to the committed predecessor's tile layout. The working folder retains the owner's newer uncommitted UI and existing changes. The combined working source, rather than a standalone APK from that checkpoint, was compiled. See [native source receipt](part4/evidence/android-bot-voice-source-checkpoint.json).

## Included bot behavior

The candidate adds requested scopes and revision-checked installation approval intersected with current native authority. Bot credentials remain separate from human sessions and sockets. Native adapters cover community administration, current message history, reactions, pins, moderation, invitations, expressions, events and webhooks. Derived credentials retain revocation/installation bindings. Private PostgreSQL events support bounded durable replay and a dedicated versioned gateway. JavaScript and Python preview clients are pinned to the generated native contract.

Personal bot messaging requires recipient consent and current access. Rich posts, buttons, selects and forms use source-bound private interactions, native content restrictions and commit-time publication checks. Community voice uses an approved public-key manifest, a separate bounded media lease, human-sealed room keys and durable media-removal metadata. Existing active local rooms are supported; empty-room bot initiation remains outstanding.

The 99-row bot matrix now has 98 native source counterparts marked `IMPLEMENTED_NOT_ACCEPTED` and one approved destination-move deferral. These are overlapping operation/event/frame rows, not 98 accepted user journeys. Yapin API behavior remains `UNVERIFIED_DOCS`. See [the matrix](part4/BOT_CONTRACT_MATRIX.json).

## Validation

| Scope | Result |
| --- | --- |
| API bot/native regression | 11 files, 70 cases passed. |
| API administration and policy | 3 files, 16 cases passed; overlaps the preceding batch. |
| Web | 149 files, 996 cases passed, one existing skip. Two crypto cases pass after the internal error-code correction. |
| Browser | 8 final checks across Chromium, Firefox, WebKit and phone-width: actual SDK integrity plus encrypted native RTC audio and observed disconnection after revocation. |
| Android | Compilation and 20 selected call/crypto/fixture cases passed. Node and Android open each other's synthetic HPKE packets and reject changed context. |
| Windows | 109 shell cases and 998 embedded-Web cases passed, with two skips. Typecheck, lint, build, localization and isolated Electron smoke passed. |
| Localization | 28 catalogs, 6,305 keys, zero structural errors or hardcoded candidates. Linguistic review remains pending. |

The local browser stage uses disposable loopback PostgreSQL with all 34 additive migrations and hosted Auth/Realtime test stubs. It does not prove hosted provider behavior. The SDK ZIP contains 12 files, 234,283 bytes, SHA-256 `b5fb45f33467a67ae843ae2ad6f1e684cc6dc8f8ff9b020339cb35dec7b976f7`.

Exact receipts: [media](part4/evidence/bot-voice-media-checkpoint.json), [native integration](part4/evidence/native-integration-checkpoint.json), and [progress](part4/PROGRESS.md). Earlier failed diagnostics are not counted as clean passes. Physical-device checks remain pending by owner choice.

## Open work

Remaining implementation/qualification includes bot attachment workflows, native event/adapter variants, empty-room bot initiation, complete native integration and same-candidate journeys, the durable age/policy acceptance ledger, and the remaining Part 4 register review. Full performance, ordinary release exports, staging journeys, backup/restore and rollback rehearsal remain release gates. Live provider consent and real buyer/payment evidence are separate from mock or local API checks.

Frankfurt remains the authoritative deployment/database target. No extra regional app hop, region, destructive migration, quota/pricing change, hosted bot execution, recording, soundboard, paid promotion or creator settlement was added. Existing Google/Discord login, charcoal/lime branding, Meldling, native safeguards and disabled card capabilities are preserved.
