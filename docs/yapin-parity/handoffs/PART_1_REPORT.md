# Part 1 report — Yapin investigation and Meldiq requirements audit

Date: **4 November 2026**, Asia/Shanghai. Status: **research handoff prepared; audit remains incomplete**. Current browser observations are dated 4 November; imported controlled research is dated 1 November. No major application change, production deployment, infrastructure/database mutation or multi-region migration was performed.

The package provides a stable implementation foundation for Parts 2–4. They can use the recorded screens, observations, contracts and feature IDs, and repeat only the unresolved scenario relevant to their work. It does not claim every interaction, dynamic route or restricted workflow was exercised.

## 1. Total pages inspected

**41 distinct canonical Yapin paths**, including `/` for visitor/authenticated app states, public product/policy/forms, developer reference sections, one bot profile and three machine-readable documents. Redirects, fragments, revisits, responsive captures and app overlays are not additional pages. See the [route inventory](../ROUTE_INVENTORY.md) and [raw path manifest](../evidence/public-routes.json).

This is a bounded route inventory. Other user-generated bot/profile/invite instances, installers, SDK packages, fankit assets, external source links and all possible query combinations were not exhaustively visited or executed. The authenticated application exposes many states at the same root path.

## 2. Total screens documented

**157 documented screen states:** 155 captured images and two deliberately text-only states. Each inventory row records route/purpose, components, layout, available actions, observed behavior, responsive limits, capture and Meldiq source equivalent. Account security and expanded forgotten-email help use text to avoid retaining sensitive fields. See [screen inventory](../SCREEN_INVENTORY.md) and [image metadata/hashes](../evidence/screen-metadata.json).

## 3. Total user journeys investigated

**All eight requested personas are mapped and partially investigated:** new user, returning user, direct messaging user, community member, community owner, moderator, voice/video user and administrator. See [J-01–08](../USER_JOURNEYS.md) for entry conditions, steps, expected/observed results, feature IDs and remaining prerequisites.

**No complete persona journey is accepted end to end.** The owner/research account cannot establish first-ever onboarding, ordinary-member enforcement, peer delivery or staff administration. A sole muted voice connection cannot establish a peer call or delivered video/screenshare.

## 4. Total verified features discovered

The register contains **568 granular feature/capability rows**. **58 rows have bounded executed interaction evidence:** 24 current interactions and 34 historical workflows. Examples include empty-field validation, menu/search/navigation interactions and earlier private synthetic messages, role/emoji/forum/thread work, a Helper help response and muted voice connection.

An additional **291 rows are UI observations only**: 190 current and 101 historical. They identify screens/controls, not working saved preferences, enforcement or delivered results. They must not be reported as 291 functionally tested features.

Parent product rows overlap intentionally with permission/API/event/frame details. These totals are register rows, not 568 independent products or 58 fully accepted workflows. See [verification definitions](../PROJECT_CONTROL.md) and the [evidence index](../EVIDENCE_INDEX.md).

## 5. Total unverified features

**219 rows explicitly use `UNVERIFIED_*`:** 195 documentation claims, 23 restricted workflows and one capability not found in the inspected surface. The 291 UI-only rows also remain functionally untested beyond their visible state.

The public OpenAPI 3.1/version 1.3.0 operation set was parsed and reconciled to **all 76 inspected documented operations**; 27 are explicitly in testing. Thirteen event payload types and ten gateway frame types were inventoried. These are documentation evidence, not executed API, bot gateway or conformance tests.

## 6. Existing Meldiq features

**377 rows have existing source/live-UI leads:** 375 `PRESENT_SOURCE` and two `OBSERVED_LIVE_UI`. Another **51 rows are `PARTIAL`**, giving 428 source/live/partial counterparts. Eight rows record intentional differences; 125 counterparts remain unverified.

Existing implementations cover authentication/device identity, account switching, profiles/cosmetics, shell/preferences, social/groups, messaging/outbox/history/search, communities/channels/rules/roles/moderation, notifications/activity/rewards, LiveKit calls, encrypted-media paths, expressions, bot/developer/OAuth surfaces, PayPal/catalog/gifts and native clients. Their existence is not a new end-to-end acceptance result.

The source leads in each row are starting points. Inspect the **deployed source baseline**, not just this shared checkout: 616 scoped files matched, 59 differed and 21 release files were absent locally. Missing local billing/orders/gifts/appeal/staged-sign-in files are already in the active release. Preserve them. See [architecture/source drift](../CURRENT_ARCHITECTURE.md).

## 7. Missing Meldiq features

**Seven register rows have no equivalent found in the inspected deployed Web source.** This bounded finding does not establish absence across every backend/native branch.

| Rows | Bounded gap | Next action |
| --- | --- | --- |
| YAP-PROFILE-012, YAP-PROFILE-013 | Profile-section visibility and arbitrary ordering | Part 2 evaluates the smallest change to existing profile presentation |
| YAP-PROFILE-026, YAP-SOCIAL-018, YAP-TRUST-006 | Profile comments/likes availability and retention disclosure | Part 2 owns presentation/privacy disclosure; Part 3 owns the social feature. Yapin comments were not visible on the inspected full profile, so availability remains unverified |
| YAP-VOICE-021, YAP-VOICE-022 | Soundboard library/playback and upload limits | Part 4 first obtains a scoped product/asset/consent decision |

These are overlapping feature rows, not seven separate missing products. Optional or unverified competitor concepts are not automatic implementation requirements.

## 8. Broken or partially implemented features

**51 Meldiq rows are partial. No new production runtime defect was conclusively reproduced in this read-only Part 1.** This does not mean zero bugs exist. Partial includes semantic differences, inactive configuration, unfinished real-world acceptance and scoped capability gaps.

The material follow-ups are:

- Existing history pagination needs current equal-timestamp, reconnect and reading-anchor acceptance. Older reported timestamp/CORS defects predate the active PostgreSQL/Web release and are not asserted as current bugs.
- Active Web Firebase configuration is absent despite push source; actual native/browser background delivery remains untested.
- Existing provider, creator/collection, event/recurrence, bot gateway/SDK, status-chart and preference paths need their exact equivalent behavior established.
- Real approved buyer subscription, cancellation/refund, renewal/failure/restoration and webhook evidence are outstanding. Embedded/saved/recurring cards remain disabled.
- Physical Android/Windows, peer call/camera/screenshare, media/range/revocation and cross-client acceptance remain outstanding.
- Security copy must distinguish text, attachment, call and backup modes. The current v2 media relay can see attachment keys; a blanket server-resistant media E2EE claim is unsupported.

The CSV provides feature-specific gap descriptions and acceptance criteria; [INV-001–018](../PROJECT_CONTROL.md) provides investigation ownership.

## 9. Current architecture findings

The initial runtime check at **04:56 UTC** and final check at **05:44 UTC** on 4 November show unchanged selected container identities, active symlinks and public Web configuration. See [initial runtime](../evidence/meldiq-runtime-20261104.json), [final runtime](../evidence/meldiq-runtime-final-20261104.json), [safe flags](../evidence/meldiq-safe-flags-20261104.json) and [current catalog](../evidence/meldiq-public-catalog.json).

- API: healthy Node/Fastify **0.76.1** image; PostgreSQL and Redis active, Mongo inactive. The host's old 0.70.0 source package is not the running backend.
- Web: active **0.5.0-beta-ui-standardization-3cc3c03**, exact source `3cc3c032b973ef9f03b7a2c95593cface27e6f32`; React 19.3.1, Next 16.4.3 Pages static export served by nginx. Next is not the production API server.
- Data: authoritative hosted PostgreSQL/session pool in **eu-central-1**, compatibility repositories and legacy delivery. Atlas/old SQLite authority is deprecated and retained; dependency names do not establish current authority.
- Auth/realtime: existing Meldiq account/device grants and custom `/v1/ws` remain active. Social sign-in uses hosted Supabase Auth endpoints as a provider adapter; native whole-account Supabase Auth/Realtime migration is not active.
- Media/calls: LiveKit, Frankfurt primary S3 and Cloudflare private-media tickets are established, with retained older Singapore object/upload compatibility. Actual delivery quality remains untested here.
- Commerce: Plus **USD 4.99/month**, Spark **USD 0.99 once**, Bots+ **USD 3.99/month**. Unavailable terms and disabled card/vault/recurrence gates remain preserved. No purchase was made.
- Clients: Windows 0.3.0 publication is documented; Android source reports 0.5.5/code 34. Neither substitutes for installed physical-device acceptance. Windows Ed25519 metadata is distinct from Authenticode.

There is **no established multi-region gateway/database/synchronization deployment**. The user's Frankfurt baseline is preserved for the single primary authority. However, the owning storage cutover report says the separate Hostinger API compute host was not relocated and cites non-authoritative Kuala Lumpur IP geolocation. The same host is still active. **Provider-confirmed API/LiveKit/ntfy physical geography remains unresolved**; Frankfurt database/storage does not prove Germany-only processing. No relocation was attempted or proposed as part of this audit.

Full component classifications, exact-source caveats, migration history, deployment/CI and owning references are in [CURRENT_ARCHITECTURE.md](../CURRENT_ARCHITECTURE.md).

## 10. Assigned feature counts for Parts 2, 3 and 4

| Implementation owner | Rows | Scope |
| --- | ---: | --- |
| PART 2 | 118 | Public/shell UX, authentication/onboarding, identity/profile, appearance/preferences and security presentation |
| PART 3 | 212 | Messaging/social, communities/channels, permissions/moderation, search/notifications, events and activity policy |
| PART 4 | 238 | Voice/video/screenshare, media/expressions, bots/integrations/API research, commerce, operations/native/final release |
| Total | 568 | Every row has exactly one owner equal to its assigned part |

Cross-domain work has one implementation owner and explicit consumer contracts. Part 2 owns the shared shell/navigation, Part 3 effective domain authority and message lifecycle, Part 4 media/call/billing/integration adapters and release evidence. Read [project control](../PROJECT_CONTROL.md) before overlapping file edits.

## 11. Screenshots collected

**155 images:** 92 current Yapin, 62 historical Yapin and one current Meldiq sign-in. Two additional states are text-only. All are under [screenshots](../screenshots/); dimensions, SHA-256 and provenance are recorded. All images decoded successfully; selected key/current captures and the authored CSV preview were visually reviewed.

Responsive checks used actual **390x844**, **768x844** and **1440x844** browser viewports. The phone back/composer behavior was inspected and the override reset. These are not physical-device tests. Research screenshots must not become Meldiq product artwork.

Historical test scope and invalid observations remain explicit in the [evidence index](../EVIDENCE_INDEX.md). No credential store, token/header dump, private database export or signed-media URL is retained. Documentation integrity checks are in [QA_REPORT.md](../QA_REPORT.md).

## 12. Outstanding investigation — unfinished

1. **New-user lifecycle:** user-completed CAPTCHA/terms and disposable registration, actual verification/resend, first-ever onboarding, real provider/passkey/2FA/recovery and expired/reused links. The user said they will complete registration; sign-in completion is not yet confirmed.
2. **Controlled peers and roles:** friendship/DM/group/block/privacy delivery, ordinary-member join/onboarding, inherited/denied permissions, moderation/report enforcement, event RSVP/recurrence and inaccessible platform-administrator queues.
3. **Real devices and delivery:** multi-party voice/camera/screenshare, capture denial and delivered quality, authenticated file/media transfer/ranges/revocation, native/browser push, installed Android/Windows parity and Windows publisher signing.
4. **Providers, integrations and commerce:** profile-link consent/sync, bot requested permissions/install/runtime beyond historical Helper help, OAuth/webhooks, all documented API/event/frame runtime, actual buyer/3DS/renewal/cancellation/refund/settlement. Existing disabled capabilities stay disabled.
5. **Architecture evidence:** provider-confirmed compute geography, exact running backend source overlays, residual SQLite/cache use, current schema/indexes, backup restore and SLO/capacity evidence. No infrastructure or database changes are authorized.
6. **Optional or bounded discovery:** comments rollout, recording/clips, soundboard, hosted bot code, creator settlement/new paid placement, external installers/SDKs and tutorial playback. Other dynamic route instances are not exhaustively audited. Conflicting Yapin native-phone claims remain unresolved.

Each item has a responsible part in [INV-001–018](../PROJECT_CONTROL.md). These gaps prevent an audit-complete claim; they do not require repeating the entire completed screen/route inventory.

## 13. Recommended implementation order

1. Reconcile the then-current production source and preserve newer/dirty work; claim IDs and contracts.
2. Part 2 stabilizes existing auth/key/shell/navigation/profile behavior and shared primitives.
3. Part 3 accepts message/history/read-state reliability and authoritative permissions, then social/community/search/notification/event workflows.
4. Part 4 accepts media/expression/call adapters against those contracts; device/provider investigation can start earlier.
5. Part 4 handles approved bots/OAuth/commerce and optional product decisions with domain owners.
6. Complete the controlled Web/Android/Windows acceptance matrix and version-aware release/rollback handoff under subsequent authorization.

Use the [roadmap](../IMPLEMENTATION_ROADMAP.md), [decisions](../DESIGN_DECISIONS.md), [progress ledger](../EXECUTION_PROGRESS.md) and [master CSV](../FEATURE_REGISTER.csv) together. No major product implementation or release has begun in this program.
