# Part 2 — application foundation handoff

Date: **4 November 2026, Asia/Shanghai**. State: **implemented and validated locally; not deployed**. This report accepts bounded local workflows, not every production/native/provider condition in the 118 owned requirements. Register disposition: **19 locally ACCEPTED, 84 IMPLEMENTED_NOT_ACCEPTED, 13 DEFERRED_DECISION, 2 RESEARCH_REQUIRED**. All 118 owned rows were individually updated; the other 450 rows and their ownership are unchanged.

Web source: `/Volumes/code_files/meldiq_web_part2_foundation`, branch `codex/meldiq-part2-foundation`, based on `1f18c4a4e503c2aba263082b56d3d0db436e3736` (the release receipt following active source `3cc3c03`). Backend companion: `/Volumes/code_files/meldiq_part2_api`, branch `codex/meldiq-part2-profile-contract`, based on `bd20d747e3a4a768b823263cab017b9d9e0017c4`, committed as `598f7c1d`. The dirty original Web checkout was preserved. No production database, infrastructure, configuration, account, provider, payment, deployment or native binary was changed.

Read [design audit/system](../part2/DESIGN_AUDIT.md), [shared interfaces](../part2/SHARED_INTERFACES.md), [validation receipt](../part2/validation.json), [source manifest](../part2/source-manifest.json), and [per-row dispositions](../part2/feature-dispositions.json).

## 1. Screens redesigned

- Signup, email verification, encryption setup and recovery-key acknowledgement now have shared progress, explicit consent, consistent secret controls and pending/error presentation.
- Sign-in capability discovery has a visible loading/failure/retry path, retaining the existing provider/email/passkey chooser.
- New-account welcome adds real profile/avatar creation, appearance/language and first-destination entry after key setup.
- Profile editor/preview now share About/Links/Connections rendering, show truthful initial-load/retry states, and expose supported section visibility/order with a real server contract.
- Settings search and nested menu/dialog focus work by keyboard; Home actions and welcome adapt to phone widths. Existing personal/community settings, account, security, devices, accessibility, notifications and voice/video structures were audited and reused.
- Fifteen public Meldiq routes were observed for copy/navigation evidence, including Terms. The public landing site was not redesigned or published in this pass. Original Terms and Privacy copies were prepared from the owner's supplied company/age decisions.

Actual captures: [registration](../part2/screenshots/registration-desktop.jpg), [welcome desktop](../part2/screenshots/welcome-chromium.jpg), [welcome phone](../part2/screenshots/welcome-phone-width.jpg), [profile desktop](../part2/screenshots/profile-chromium.jpg), [profile phone](../part2/screenshots/profile-phone-width.jpg), [768px Home](../part2/screenshots/home-chromium.jpg) and [phone landscape Home](../part2/screenshots/home-phone-width.jpg). These are local synthetic fixtures, not production-account screenshots.

## 2. Components created

Nine UI modules: PasswordInput, SetupProgress, StatePanel, AppearanceControls (ThemeChoice/PaletteChoice), TermsConsent, WelcomeFlow, ProfileContent, ProfileSectionsCard, SkipToContent. Supporting modules provide deadline-based code cooldown, account-scoped welcome progress, immutable section movement/defaults and nested modal isolation. `foundation.css` extends existing design tokens and controls.

## 3. Components consolidated

Theme/palette controls are shared by Settings and Welcome and write the same existing browser preferences. About/Links/Connections content is shared by ProfileDialog and the profile preview. Secret fields in login, signup, reset, recovery/unlock, reauthentication and account settings use one reveal control. Existing style-draft/revision and unsaved-change mechanisms power the new section editor. All overlays keep the existing Dialog/Menu/Popover entry points.

## 4. Duplicate options removed

Removed duplicate profile-content render branches and inline theme/palette implementations. The new section form uses **Save sections** / **Reset section changes**, removing ambiguity with existing profile-detail save/reset actions. Removed the decorative `#clips` row from auth artwork because it implied an unavailable feature. The starting release already consolidated account/security/settings navigation; that earlier work was preserved rather than claimed as newly removed. No working user feature was deleted for competitor parity.

## 5. Navigation changes

Kept canonical Home, Messages, Friends, Communities, Discover, Activity, Saved/Reminders, Profile and Settings routes, the shared personal/community settings catalogs and native-aligned phone destinations. Added search-to-results ArrowDown, result Up/Down/Home/End and unique-result Enter. Capability/admin filtering remains authoritative for navigation, with domain permission checks unchanged. A skip button focuses visible content instead of a hidden desktop panel. Closing a nested language dialog/menu returns focus; top-modal isolation prevents background activation.

## 6. Authentication improvements

The actual AccountApi / SetupCredentials / device-key flow is unchanged. Added synchronous duplicate-submit protection; reversible password reveal without secret persistence; associated field hints; server-info failure/retry; verification resend countdown and server-429 deadlines; explicit Terms agreement/Privacy acknowledgement and **13+ declaration**. The owner supplied GRIIPBUDDY LLC (Wyoming), `contact@griipbuddy.com`, and the Cheyenne address.

[Prepared Terms](../part2/legal/TERMS_OF_SERVICE.md) and [Privacy](../part2/legal/PRIVACY_POLICY.md), revision `2026-11-04.1`, use those details and preserve current free customization/purchase semantics. They are not published. A UI declaration does not independently verify age or persist a policy revision. **The current API still lacks durable versioned policy acceptance and server enforcement across every new-account path.** See [exact policy release contract](../part2/legal/RELEASE_NOTES.md); AUTH-007/008 remain unaccepted. No real user's password, provider agreement or account was changed.

## 7. Onboarding improvements

New identity → existing key/recovery acknowledgement → saved display name/avatar → browser theme/palette/language → Home/Messages/Discover. Progress resumes per account after reload; existing accounts are not enrolled automatically. Storage contains a stage only, with an in-memory fallback. Signup names initialize after sync, preventing temporary usernames from overwriting them. Profile/avatar operations use existing APIs. No microphone, camera or notification permission is requested until the relevant feature needs it.

## 8. Responsive improvements

Checked 1920×1080, 1440×900, 1280×800, 1024×768, 768×1024, 390×844 and 844×390 CSS viewport targets. Welcome stacks, wraps choices, reduces the actual image mascot on phones and applies safe-area padding. Home actions wrap to full width. Existing mobile settings pages/community sheets and focused-chat layout remain. Geometry, keyboard search/focus and actual save/reload workflows were exercised; emulation is not a physical phone/tablet or soft-keyboard check. Existing reduced-motion preferences stop the new loading spinner.

## 9. Files modified

[Source manifest](../part2/source-manifest.json) lists **172** Web/API source, locale, test, configuration and companion-patch files with SHA-256 hashes (including 112 locale JSON files). It excludes this report and generated documentation to avoid recursive hashes. Main areas: `src/ui/auth`, shared components/overlays/settings navigation, profile editor/preview/content, shell/Home, profile API schemas/sync, `src/application/welcome.ts`, `src/styles/foundation.css`, `_app.tsx`, tests and Playwright config. The 28 locale catalogs retain 6,232 keys each with structural parity.

Backend changes are seven files: `server.ts` capability, profile schema/normalization, profile-style route, owner/peer profile and connections projection, and `profile_layout.test.ts`. [Companion patch](../../../server-patches/0015-profile-layout-foundation.patch) applies cleanly to the stated backend baseline. It uses existing `users.profile_style` JSON; no schema migration. Release backend capability before relying on the new editor; an older server hides it. Older clients omitting layout preserve the saved value.

Required register/design/progress documents are updated. New evidence lives under `part2/`; Part 1 competitor observations, stable IDs and provenance remain retained. The original shared checkout receives documentation only, not a source overwrite.

## 10. Tests executed and results

| Check | Final result | Evidence / limits |
| --- | --- | --- |
| Full Web unit suite, four workers | **143 files; 973 passed, 1 skipped** | [unit summary](../part2/validation/unit.txt); includes four new welcome/layout tests. Earlier concurrent run hit an i18n timeout; bounded-worker full run passes. |
| Focused backend suites | **4 files; 54 passed** | [backend summary](../part2/validation/backend.txt); malformed layout, old-client preservation, hidden owner/peer data, audience controls, null reset and stale-revision rejection. SQLite fixture, not production PostgreSQL. |
| Built-Web browser regression, Chromium desktop/phone | **41 unique cases passed after test-URL correction; 5 expected skips** | [main run](../part2/validation/browser-main.txt) initially 39 passed / 2 failed / 5 skipped. Both failures were the old passkey test port 5181. [Correction run](../part2/validation/browser-correction.txt): 4 passed / 2 phone-passkey skips, including both previously failed cases and expanded outage/empty-login checks. |
| Final onboarding after image-responsive fix | **2 passed** | [final onboarding](../part2/validation/browser-onboarding-final.txt): both projects, same real signup/resend/profile/preferences/resume case with phone illustration sizing. This repeats cases above; it is not two extra unique features. |
| PWA local release fixture | **Passed on both projects** | Service-worker assets, cached shell/session and network recovery in main regression. No production outage injected. |
| TypeScript | **Web and backend PASS** | Web via final normal build; [backend typecheck](../part2/validation/backend-typecheck.txt). |
| ESLint / full Prettier check | **PASS, zero lint warnings** | [lint](../part2/validation/lint.txt), [format](../part2/validation/format.txt). |
| i18n | **PASS** | 28 locales × 6,232 keys, zero structural errors and hardcoded source candidates. Translation structure does not certify every translation's linguistic quality. |
| Normal production build | **PASS** | [build](../part2/validation/release-build.txt); `NEXT_PUBLIC_MELDIQ_TEST_LINKING=0`, static export + service worker. Browser fixture builds intentionally used test linking; do not deploy those fixture builds. |
| Backend patch apply check / diff checks | **PASS** | Clean baseline `bd20d747`; no production apply. |

Reproduce full browser scope with `ORBIT_SERVER_DIR=/Volumes/code_files/meldiq_part2_api/server ORBIT_E2E_API_PORT=8192 ORBIT_E2E_WEB_PORT=5291 ORBIT_E2E_BUILD=1 npx playwright test e2e/part2-foundation.spec.ts e2e/ui-standardization.spec.ts e2e/accounts.spec.ts e2e/stage1-account.spec.ts e2e/multiple-accounts.spec.ts e2e/languages.spec.ts e2e/settings-redesign.spec.ts e2e/mobile-overlays.spec.ts e2e/passkeys.spec.ts e2e/profile-collection.spec.ts --project=chromium --project=phone-width`. Stop unrelated local build/dev processes before building in this worktree. Five skips are three desktop-only account cases and two phone CDP-passkey cases. Firefox/WebKit and physical devices were not run.

## 11. Known bugs

No unresolved failure remains in the final exercised local scope. Fixed: duplicate in-flight form submissions; wrong hidden-panel skip target; submenu parent left inert; ambiguous section save/reset names; unsynced temporary name seeded into welcome; empty profile form during initial fetch; wrong responsive mascot selector. Test-only fixes: ambiguous Email/Password selectors, post-reload readiness and hardcoded passkey port. Intermittent `next dev` chunk-load failures were encountered; the built static app passed the replacement checks. This does not establish that every possible production chunk/network failure has been solved.

## 12. Partially completed features

The 84 `IMPLEMENTED_NOT_ACCEPTED` rows describe specific remaining cases, not 84 newly broken features. They include provider/physical-authenticator consent, full recovery/revocation/expiry matrices, policy ledger/publication, profile media/audience/entitlement combinations, public-site workflows, full contrast/assistive-technology checks, feature-specific preferences, and native/production projections. Read the row's exact remaining criterion. Existing-source/live status remains the historical Part 1 baseline; local implementation status is a separate axis.

## 13. Features not implemented

Thirteen explicit decisions remain deferred: public creator/partner program commitments; new CAPTCHA integration; temporary avatars; creator-content reward submissions and invite rewards; profile comments; priced cosmetic acquisition, seller pricing and seller revenue share; additional side-panel color mode; hide-top-strip preference; comment-retention claims. Existing related functionality, ownership, free customization and security controls were preserved. Two research items remain: legacy/rebrand redirect policy and a tracked private intimate-image removal workflow. No fake controls or assumed product approvals were added for these items.

## 14. Exact requirements remaining for Parts 3 and 4

**Part 3:** consume the existing router/settings/overlay interfaces. Preserve profile layout withholding and existing audience/block/relationship rules in every new profile/mutual/suggestion projection. Do not use owner-profile caches for peer responses. Accept message history/empty/failure, unread boundaries, account-isolated drafts, quick-switch/back/list-scroll behavior and composer actions against controlled peers and roles. Supply actual social/community/permission/notification semantics behind the common UI. Profile comments require a separate approved schema, moderation/reporting and deletion lifecycle. Keep personal preferences separate from community authority. See [shared contract](../part2/SHARED_INTERFACES.md).

**Part 4:** reconcile exact current API overlay and release predecessor before integrating this patch; test profile JSON/revisions in PostgreSQL and installed older Android/Windows clients. Backend capability must precede the Web editor. Retain disabled card/vault/recurring-card gates, current server catalog and free customization. Complete actual OAuth/provider consent, physical passkey/device recovery, push/capture/call/media and native distribution acceptance. Integrate prepared policies/support contacts into the public site, establish the actual retention/provider table, publish the approved revision/effective date, and implement durable server-validated age/policy acceptance on email and provider new-account paths while coordinating older native clients. Do not enable new economies or comments from policy copy alone. Measure real provider payments/renewals/cancellation separately.

Final release remains Part 4: build without test linking, bind exact immutable source/artifact identity, complete relevant P0 cases and public disclosures, verify current rollback compatibility and monitoring, and deploy only the authorized release scope. No Frankfurt infrastructure/database migration or regional topology change is authorized by this handoff.
