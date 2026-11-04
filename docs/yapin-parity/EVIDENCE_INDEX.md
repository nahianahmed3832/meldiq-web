# Evidence index

Current observations: 4 November 2026, Asia/Shanghai. Historical controlled research: 1 November 2026. The dates are not interchangeable.

## Direct browser investigation

The current audit used actual browser automation: an authenticated existing Yapin research session for the private server/settings, a native Chrome Incognito visitor window for homepage/login/registration/recovery, and a separate browser tab for public routes and documentation. A retained second app tab was used for actual 390x844, 768x844 and 1440x844 viewport checks. DOM client dimensions were checked; transient wrong-tab captures were removed and replaced. This is browser emulation, not physical-phone testing.

| Evidence | Scope | Interpretation |
| --- | --- | --- |
| `01–18`, `20`, `25–37` text/captures | Empty private server, profile/preferences and current owner settings | Mostly visible-control inventory; execution is only claimed where explicitly recorded. |
| [19 homepage](evidence/19-homepage.txt) | First visitor product/FAQ/navigation | Incognito logged-out content; no account session inferred. |
| [21 login](evidence/21-login.txt), [22 registration](evidence/22-registration.txt), [23 recovery](evidence/23-password-recovery.txt), [24 account help](evidence/24-forgot-email.txt) | Authentication forms, required empty-field validation, CAPTCHA/terms and recovery help | No credentials entered, no terms accepted, no challenge solved or email sent. Browser autofill appeared during validation; that capture was deleted and replaced with the clean form. Email values and Google iframe query values are redacted in retained text. |
| [38 events](evidence/38-events.txt), [39 event draft](evidence/39-event-draft.txt) | Empty events and complete create draft | Draft opened and cancelled; no published event or notice. |
| [40 full profile](evidence/40-full-profile.txt) | Own research-account full profile | Comments not visible here; policy/section toggles are not proof of comment availability. |
| [41 friends](evidence/41-friends.txt), [42 user search](evidence/42-find-people-empty.txt), [43 group](evidence/43-group-prerequisite.txt), [44 friend draft](evidence/44-add-friend.txt) | Empty social list, no-result query and creation prerequisites | No peer contact, friend request, group or DM created. |
| [45 inbox](evidence/45-inbox.txt), [46 account menu](evidence/46-account-menu.txt) | Inbox scopes and account switcher | No bulk read action, notification change or account switch executed. |
| [47 message menu](evidence/47-message-menu.txt), [48 search](evidence/48-search.txt) | Context menu on synthetic marker F and query returning six private marker messages | Menu opened/dismissed; search executed. Rich-filter semantics and all menu mutations remain untested. |
| [49 phone](evidence/49-phone-chat.txt), [50 composer](evidence/50-phone-composer.txt), [51 navigation](evidence/51-phone-navigation.txt), [52 tablet](evidence/52-tablet-chat.txt), [53 desktop](evidence/53-desktop-chat.txt) | Current responsive app arrangement | Actual browser widths confirmed; no soft keyboard, native touch, camera/mic or background push test. Viewport override reset afterward. |
| [Public route manifest](evidence/public-routes.json), [route inventory](ROUTE_INVENTORY.md) | Canonical paths, titles and references | Fragments/revisits do not inflate page counts. Dynamic bot/invite/profile instances and binary/SDK assets remain bounded. |
| [OpenAPI audit](evidence/yapin-openapi-audit.json) and [operation inventory](evidence/documented-api-operations.json) | Parsed OpenAPI 3.1, version 1.3.0; 76 operations; 13 event types; 10 gateway frames | Browser observation initially truncated a very long text return. Bounded visible-DOM chunks were reassembled and parsed successfully. All 76 operations reconcile with the inspected reference pages. No bot endpoint or gateway was called; no conformance test. |
| `public-security-json.txt`, `public-security-txt.txt` | Linked disclosure log and contact metadata | Published claims only; no security testing, source-code audit or third-party audit is implied. |

The current bot directory no-result search and user-finding no-result query were actual interactions. The subscription page was revisited after loading and confirmed an empty inventory. The status and tutorial captures were similarly replaced after loading settled; initial Checking/No data and Loading must not be described as final service results.

## Historical evidence imported

The prior `Meldiq-Yapin-Research` directory remains intact. **62 screenshots** were copied unchanged into `screenshots/legacy/`, and **171 text observations** into `evidence/legacy/` with email/sign-in-query redaction. [Import manifest](evidence/historical-import-manifest.json) records original paths, original text hashes, retained hashes and date. [Screen metadata](evidence/screen-metadata.json) records image dimensions, hashes, captions, scope and related feature IDs.

Historical verified samples include private server creation/Discovery-off save, synthetic text and tagged discussion/thread creation, gradient role save/assignment, original emoji upload/send/favorite, sampled cross-server emoji send, GIF selection/send, one reaction, scoped search/target jump, bounded history/unread/reload behavior, muted sole-member voice connect/disconnect and free Helper `!help` reply. No other bot command/runtime is inferred from a help list.

Historical exclusions remain exclusions:

- Evidence 89–90 did not establish channel navigation; use the confirmed later round trip.
- Evidence 57 is a creation form, not a successful creation.
- Evidence 07 did not expose clip duration alternatives; the captioned screenshot is the relevant record.
- Evidence 169 restored an unrelated browser window and is not a valid Yapin closed-tab test.
- Second-tab restoration did not establish exact final scroll pixels.
- Post-login observations do not establish first-ever onboarding.
- No old payment/architecture/price conclusion is imported as current. Current release/catalog/runtime records supersede those facts.

## Meldiq architecture evidence

| Record | What was verified | What was not done |
| --- | --- | --- |
| [Runtime inventory](evidence/meldiq-runtime-20261104.json) | Filtered Meldiq container identities/status, runtime package, active symlinks, selected public config and health | No raw environment dump, secret value, customer record or database query. The old host package was distinguished from the running container package. |
| [Final runtime check](evidence/meldiq-runtime-final-20261104.json) | Selected container identities, active symlinks and public Web configuration unchanged from 04:56 to 05:44 UTC; healthy API | Time-bounded identity/health comparison, not an uptime, delivery or SLO test. |
| [Safe flags](evidence/meldiq-safe-flags-20261104.json) | Database/storage region indicators; pool size; card gates; provider list; absent Web Firebase/native-migration configuration | No changes to settings, containers, credentials or data. |
| [Public catalog](evidence/meldiq-public-catalog.json) | Current prices, bytes, character limits, advertised stream tiers and sale availability | No checkout, charge, grant, webhook or lifecycle execution. |
| [Source comparison](evidence/web-source-comparison.json) | 616 matching / 59 different / 21 missing compared release files | Extra local files excluded; not a full backend/runtime or repository-cleanliness certificate. |
| [Live sign-in](evidence/meldiq-sign-in.txt) | Current Google/Discord/email/passkey/registration/recovery/appeal UI | No authenticated production account writes or provider consent. |
| [Current architecture](CURRENT_ARCHITECTURE.md) | Owning code and deployment receipt references with classifications | Compute provider geography, exact backend overlays, schema/restore/capacity and device workflows remain qualified. |

Existing release test results are cited as historical release evidence where needed. Part 1 did not run an app build, application test suite, CI job, production canary or new customer transaction. Documentation validation is separate and recorded in [QA report](QA_REPORT.md).

## Evidence handling

No saved cookies, passwords, OTPs, private keys, authentication headers, live bot credentials, HAR files, private database contents or signed media tickets are part of this package. Public API examples contain fictional example identifiers/tokens; they are not operational credentials. Screenshot references may show public display names and existing synthetic research fixtures. They must not be used as product assets.

Screenshots establish only the shown viewport/state. Text may expose offscreen controls; neither proves a control was saved or a backend action succeeded. For each implementation change, retain a new bounded test record with account role, source, environment, steps, outcome and limitations.
