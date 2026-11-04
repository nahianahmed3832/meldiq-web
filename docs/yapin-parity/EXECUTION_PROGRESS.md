# Execution progress

## Current — Part 2, 4 November 2026 (Asia/Shanghai)

Owner follow-up: [Meldiq default / mascot correction](part2/BRANDING_CORRECTION.md) is locally implemented and tested. It preserves explicit palette choices and uses the existing canonical teal/cream Meldling for shared branding and built-in expressions. No deployment.

Application foundation implemented in isolated release-derived Web and backend branches; **not deployed**. Read [Part 2 report](handoffs/PART_2_REPORT.md), [shared interfaces](part2/SHARED_INTERFACES.md), [design audit](part2/DESIGN_AUDIT.md), [validation](part2/validation.json) and [source manifest](part2/source-manifest.json).

| Workstream | State / evidence | Remaining |
| --- | --- | --- |
| Auth / verified first entry | Local built-browser signup, resend/old-code rejection, key/recovery acknowledgement, account-specific welcome/resume, real name/avatar/preferences/language and reload pass | External provider/physical authenticator, full expiry/revocation and production mail acceptance |
| Shell / settings / overlays | Shared registry and native phone destinations retained; keyboard search, nested isolation/focus return, visible skip target and responsive geometry pass | Feature-specific message/community/call/media acceptance in Parts 3/4 |
| Profile layout | Optional capability-gated visibility/order, shared preview/content, server withholding, old-client preservation and stale-revision rejection pass | Current PostgreSQL/installed-native rollout; no schema migration |
| Policies | Owner approved 13+ and supplied Wyoming LLC/address/contact; original Terms/Privacy revision 2026-11-04.1 prepared | Public-site publication, actual retention/provider table and durable server-validated version acceptance |
| Tests | Web 973 passed / 1 skipped; backend 54 passed; 41 unique built-browser cases passed after correcting two test URLs, 5 expected skips; lint/typecheck/i18n/full formatting/normal build pass | Firefox/WebKit, physical devices, external services, final production release |
| Register | All 118 owned rows reviewed: 19 ACCEPTED in bounded local scope, 84 IMPLEMENTED_NOT_ACCEPTED, 13 DEFERRED_DECISION, 2 RESEARCH_REQUIRED | Read per-row remaining criteria; 450 rows belonging to Parts 3/4 unchanged |
| Handoff | Separate source branches and backend patch; original dirty Web source preserved | Parts 3/4 consume frozen interfaces and reconcile exact release predecessor/overlays |

No code, policy or migration was deployed, and no production account/database/infrastructure was modified. Final release remains Part 4. The ledger below is archived **Part 1** history; its “not started” and “none accepted” statements apply to that read-only phase, not the current Part 2 work.

## Archived Part 1 ledger

Date: 4 November 2026, Asia/Shanghai. Overall status: **research handoff prepared, investigation incomplete**. Application implementation in this program: **not started**. This ledger does not erase or relabel existing Meldiq functionality.

## Research ledger

| Workstream | State | Evidence / result | Remaining work |
| --- | --- | --- | --- |
| Public Yapin site and docs | BOUNDED INVENTORY PREPARED | 41 canonical paths; public forms, policies, products, bot directory/profile, status, API reference and machine-readable documents | Dynamic instances, external/binary/SDK destinations, tutorial playback and actual documented runtime remain unverified |
| Visitor authentication | PARTIAL | Incognito homepage/login/signup/recovery; required-field validation; terms/CAPTCHA and account-help controls | User-assisted completed registration, verification/resend, first onboarding, recovery and real provider/passkey/2FA |
| Existing research account | BOUNDED INVENTORY PREPARED | Current profile/preferences, owner menus, events draft, social empty states, inbox, message menu/search | Saves, controlled peer delivery and non-owner enforcement; inaccessible staff/admin scope |
| Responsive Web | BOUNDED CHECKS PERFORMED | Actual 390x844, 768x844 and 1440x844 browser dimensions; phone navigation/composer | Physical phones, soft keyboard, capture, accessibility assistive technology and background delivery |
| Historical controlled tests | IMPORTED WITH PROVENANCE | 62 unchanged screenshots and 171 redacted text observations dated 1 November | Do not promote old results or defects to current production acceptance |
| Meldiq architecture | READ-ONLY BASELINE RECORDED | Running API/Web/configuration, source/catalog, Android/Windows owning evidence; final runtime identity unchanged | Compute provider geography, exact backend overlays, schema/restore/SLO and actual installed-client acceptance |
| Feature register | STRUCTURALLY VALIDATED IN QA | 568 unique rows; Part 2: 118, Part 3: 212, Part 4: 238; acceptance/dependencies/evidence/owner populated | Investigate and accept each future change; do not implement every documented vendor operation automatically |
| Eight journeys | MAPPED, ALL PARTIAL | New/returning user, DM, member, owner, moderator, voice/video, administrator | Scenario-specific restrictions in J-01–08; none accepted end to end |
| Planning/handoff | PREPARED | Roadmap, shared contracts, design decisions, INV-001–018 and Part 1 report | Future parts claim IDs and contracts against the then-current release |
| Product/infrastructure changes | NOT STARTED / OUTSIDE PART 1 | All task writes are contained in this documentation package; source research and SSH checks were read-only | Requires subsequent implementation scope; no release inferred from this report |

## Feature-state snapshot

| Axis | Counts |
| --- | --- |
| Yapin bounded interaction/workflow evidence | 24 current + 34 historical = 58 rows |
| Yapin visible UI only | 190 current + 101 historical = 291 rows |
| Yapin explicitly unverified | 195 documentation + 23 restricted + 1 not found = 219 rows |
| Meldiq source/live UI leads | 375 source + 2 live UI = 377 rows |
| Meldiq partial | 51 rows; capability/configuration/semantic or acceptance gaps, not 51 confirmed runtime bugs |
| Meldiq bounded missing | 7 rows in inspected deployed Web source; overlapping comment/soundboard surfaces are separate register rows |
| Meldiq intentional differences / unverified | 8 / 125 rows |
| Priority | P0: 106; P1: 218; P2: 202; P3: 42 |

Counts are reconciled in [register counts](evidence/register-counts.json) and [inventory counts](evidence/inventory-counts.json). Whole-feature Meldiq acceptance newly completed during Part 1: **none**.

## Handoff actions

1. Part 2 reads current architecture/source drift, claims its 118 rows and freezes identity, shell/navigation and profile contracts. Continue first-time auth investigation only after the user confirms registration is signed in; do not capture credentials.
2. Part 3 claims its 212 rows, reproduces current reliability behavior and obtains controlled peer/member evidence. Freeze message/history and effective permission contracts before dependent integrations.
3. Part 4 claims its 238 rows, starts device/provider investigations and retains existing storage/payment gates. Implement accepted media/call/integration behavior after upstream contracts, then coordinate cross-client release evidence.

No row is `IN_PROGRESS`, `IMPLEMENTED_NOT_ACCEPTED` or `ACCEPTED` merely because this package exists. Record an exact source, environment, bounded outcome and remaining limitation for each future state change. Update this ledger and the CSV together. Do not overwrite subsequent progress by rerunning the original authoring helpers.

## Unfinished

INV-001–018 remain open in [project control](PROJECT_CONTROL.md). The most immediate human dependency is completed new-account registration/verification; the user's willingness is recorded, completion is not yet confirmed. Controlled peer/role tests, real providers/payments, actual calls/media/push/devices, staff access, compute geography and exact backend-source evidence remain outstanding. No audit-complete claim is made.
