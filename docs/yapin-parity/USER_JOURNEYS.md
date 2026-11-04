# User journeys

Eight requested personas/workflows are mapped. **Every journey still contains an unexecuted segment; none is presented as fully tested end to end.** Expected outcomes below define the intended acceptance of a workflow. They are not fabricated observations of a screen that was not reached.

Yapin mostly changes application state at `/`. Current evidence is dated 4 November 2026; earlier controlled private-server tests are dated 1 November. See the [feature register](FEATURE_REGISTER.csv) for each exact verification label and owner.

## J-01: New user

Entry: fresh logged-out browser, no account, user controls email and credential entry. Current route: `https://yapin.gg/`.

| Step / transition | Expected result | What was investigated | Feature IDs |
| --- | --- | --- | --- |
| First visit → Log in / Open browser app | Clear product introduction and an account entry | Homepage and Log in transition performed in Incognito. | YAP-WEB-001, YAP-WEB-002 |
| Account entry → Create an account | Signup fields and agreement are clear | Email, username, password, birth month/year, terms checkbox, Google signup and challenge observed. | YAP-AUTH-006, YAP-AUTH-007, YAP-AUTH-008, YAP-AUTH-009 |
| Submit valid approved registration | Validation and human checks complete without duplicate account | **UNVERIFIED**. Agent entered no credentials, accepted no agreement and solved no CAPTCHA. User said they will complete the staged registration. | YAP-AUTH-006–010 |
| Registration → Verification | Owner receives usable confirmation and can handle delay/expiry | **UNVERIFIED**. Only delay/spam-folder guidance observed; verification/resend screen not reached. | YAP-AUTH-010, YAP-AUTH-011 |
| Verification → First sign-in / onboarding | Actual initial routing and required setup are recorded | **UNVERIFIED**. Do not assume a welcome wizard, automatic community join or profile-completion gate exists. | YAP-AUTH-012 |
| Onboarding → Profile setup | Identity, avatar/bio/links/privacy choices save and are resumable | Existing research account's profile controls inspected; no fresh-account save executed. | YAP-PROFILE-001–014 |
| Profile → Main app → Find people / communities | User reaches an accessible next action with informative empty states | Existing-account empty friends, user search, private-server empty channel and discovery evidence available. Fresh-account transition unverified. | YAP-SOCIAL-001–013, YAP-COMM-003–006 |

Validation/failure coverage: required empty-login field was exercised. Signup duplicate/invalid username, age boundaries, email delivery, expired verification, rate limit, challenge failure, first-login loading/error and interrupted onboarding remain open. No hidden setup steps are invented.

Evidence: [homepage](screenshots/current/19-homepage.png), [login](screenshots/current/21-login.png), [registration](screenshots/current/22-registration.png), [profile](screenshots/current/02-profile.jpg). Follow-up: INV-001/003/004, Part 2, with Part 3 for first social/community use.

## J-02: Returning user

Entry: existing account, either a valid retained session or user-controlled sign-in/recovery.

| Step / transition | Expected result | Investigated result / limit | Feature IDs |
| --- | --- | --- | --- |
| Open retained app | Correct account and accessible last destination | Current retained research session opened; private test server and saved fixtures were accessible. | YAP-SHELL-001, YAP-AUTH-020 |
| Logged-out account entry | Email/username, Google and passkey alternatives | Controls observed; only empty-input validation exercised now. | YAP-AUTH-001–005 |
| Forgot password / which email | Safe owner recovery without account enumeration | Recovery form opened; forgotten-email help expanded; no mail or reset submitted. | YAP-AUTH-013–015 |
| Complete sign-in → initial destination | Own session restored without losing identity | Earlier user-assisted login reached Friends; selecting the private server opened general. Reopening history-lab initially left later Helper messages below view. This is a bounded historical finding. | YAP-AUTH-020, YAP-SHELL-011, YAP-MSG-029 |
| Open a previous conversation | Correct history and defined reading position | Current synthetic history visible; older reload/channel-return cases retained separately in historical evidence. | YAP-MSG-025–031 |
| Switch accounts / sign out | Intended account isolation and session revocation | Switch submenu observed. No account added/switched and no global logout invoked now. | YAP-AUTH-019, YAP-AUTH-021 |

Unfinished: actual provider/passkey/2FA return, long inactivity, browser restart, key restoration and current reconnect behavior. Never use the earlier invalid closed-tab attempt as proof. Owners: Part 2 auth/navigation, Part 3 history. Follow-up: INV-003/005.

## J-03: Direct messaging user

Entry: two controlled consenting accounts and an allowed friendship or DM privacy relationship. Existing research account currently has no DMs or friends.

| Step | Expected result | Investigated result / limit | Feature IDs |
| --- | --- | --- | --- |
| Home → Friends / Find people | Search only eligible identities | Current Online/Pending empty states observed; unmatched Find people query resolved to Nobody found. | YAP-SOCIAL-001, YAP-SOCIAL-002, YAP-SOCIAL-004, YAP-SOCIAL-005 |
| Add Friend → enter username/note | Validate identity and note visibility | Draft fields and disabled empty-send state observed; no request sent. | YAP-SOCIAL-006, YAP-SOCIAL-007 |
| Peer accepts → New message | One correct conversation with safety/privacy gates | **UNVERIFIED** without controlled peer. | YAP-SOCIAL-009–011 |
| Compose → send → receive/reply | Durable ordered text, appropriate indicators | Private-channel synthetic sends/reaction/thread/search were tested earlier; these do not establish peer DM delivery or receipts. | YAP-MSG-001, YAP-MSG-006–008, YAP-MSG-010, YAP-MSG-032 |
| Add media / call / group | Allowed limits and clear consent | Entries visible; group picker blocks Next with no friends and permits up to nine selected friends. No peer added or contacted. | YAP-SOCIAL-012–014, YAP-MEDIA-001, YAP-VOICE-001 |
| Block / leave / return | Enforced privacy, correct unread and notification state | Controls observed only. | YAP-SOCIAL-003, YAP-SOCIAL-010, YAP-MSG-016, YAP-NOTIFY-003 |

Unfinished: request lifecycle, actual DM/group membership and delivery, blocks, privacy combinations, unread/receipts across two clients and calls. Part 3 owns the journey; Part 4 supplies media/calls. Follow-up: INV-002/005/008/009.

## J-04: Community member

Entry: controlled non-owner account and a public or private test community. The existing research account is an owner, so it cannot establish ordinary-member enforcement.

| Step | Expected result | Investigated result / limit | Feature IDs |
| --- | --- | --- | --- |
| Discover / invitation → community | Public metadata, join prerequisites and truthful errors | Discovery inspected historically; current Overview shows eligibility. No external server joined in this audit. | YAP-COMM-004–006, YAP-COMM-013 |
| Apply if required → onboard → rules | Correct eligibility and only safe role choices | Owner configuration observed; actual new-member application/onboarding/rules journey **UNVERIFIED**. | YAP-MOD-005, YAP-COMM-019, YAP-COMM-021, YAP-COMM-022 |
| Lobby → channel | Accessible content and clear back/navigation | Owner lobby/editor preview exists; phone list/back/chat transitions checked now. | YAP-COMM-014–017, YAP-SHELL-005–007 |
| Text/discussion/thread use | Correct create/read/follow behavior | Historical synthetic text and tagged discussion/thread creation verified in private server as owner. | YAP-CHANNEL-001, YAP-CHANNEL-003, YAP-CHANNEL-013–016, YAP-MSG-019–021 |
| Choose ping roles / notification level | Only eligible roles and predictable inheritance | Controls observed; non-owner assignment/delivery not tested. | YAP-COMM-023, YAP-NOTIFY-008 |
| Join voice / RSVP | Consent and channel permission enforced | Earlier muted sole-member voice join succeeded; event draft observed now; RSVP unverified. | YAP-VOICE-001, YAP-EVENT-001–009 |

Unfinished: non-owner privacy gates, text-only/GIF/read-only rules, revoked membership effects, onboarding completion, event lifecycle and real peer voice. Part 3 primary; Part 4 media/calls. Follow-up: INV-002/006/007/008.

## J-05: Community owner

Entry: authorized owner of the existing private research server; no public audience is contacted.

| Step | Expected result | Investigated result / limit | Feature IDs |
| --- | --- | --- | --- |
| Create/configure private server | Explicit visibility and correct owner | Earlier approved blank creation and Discovery-off save recorded; one human member and Helper remain. No new server created now. | YAP-COMM-001, YAP-COMM-004 |
| Overview / theme / lobby | Valid identity, original assets and explicit save/cancel | Current Overview/theme opened; historical lobby templates/look/sections/phone preview inspected and cancelled. No persistent styling save tested. | YAP-COMM-008–018, YAP-LOBBY-001–017 |
| Categories/channels / roles | Correct structure and authority | Earlier category/text/discussion/tag creation and role gradient assignment verified; current hierarchy/reorder screens observed. | YAP-CHANNEL-001–009, YAP-ROLE-003–006 |
| Member onboarding / safety | Safe role choices, gates and recovery | Configuration opened; lower-role enforcement remains unverified. | YAP-COMM-021–023, YAP-MOD-001–006, YAP-GATE-001–006 |
| Bots / webhook / integrations | Clear install/configuration/runtime state | Nine bot cards now observed; earlier Helper help response verified. Other bot/runtime and webhook lifecycles unexecuted. | YAP-BOT-001–022, YAP-BOTOPT-001–020, YAP-DEV-007–016 |
| Event → publish/RSVP/manage | Complete scheduled event lifecycle | Empty panel and full draft opened and cancelled. No event published. | YAP-EVENT-001–009 |
| Boost/promote/partner | Clear independent eligibility and recurring terms | Supercharge monthly tiers, weekly promotion and partner checklist observed; no checkout/application. | YAP-BILL-009–012, YAP-COMM-028 |
| Audit / leave / transfer / delete | Authorized history and explicit destructive confirmation | Existing change expanded in audit. Transfer not located; no deletion/transfer executed. | YAP-MOD-014, YAP-MOD-015, YAP-COMM-025–027 |

Unfinished: configuration persistence, conflict/enforcement tests, non-Helper automation, imports/invite expiry, event lifecycle, payments and ownership transfer. Part 3 community authority; Part 4 bot/media/commerce integrations. Follow-up: INV-006/007/010/011.

## J-06: Moderator

Entry: controlled non-owner moderator with constrained roles, a lower-role test member and private synthetic content.

| Step | Expected result | Investigated result / limit | Feature IDs |
| --- | --- | --- | --- |
| Open reports | Only allowed community reports | Owner Reports UI opened with Open/Handled categories; no real report filed. | YAP-MOD-010–012 |
| Inspect message/member → resolve | Clear evidence and an authorized idempotent resolution | Sanction controls described; no action applied. Moderator role itself unavailable for execution. | YAP-MOD-006–011 |
| Manage roles/overrides | No escalation above authority or conflicting grants | Matrix and hierarchy controls observed historically/currently; no non-owner effective-permission tests. | YAP-ROLE-003–007, YAP-PERM-001–032 |
| Manage voice / raid | Correct scope, expiry and audit | Voice ban and safety screens inspected; no capture, raid generation, lock or sanction. | YAP-MOD-001–009, YAP-MOD-016 |
| Inspect audit / appeal | Actor/reason and approved review path | Existing synthetic event expansion checked; moderator-visible fields/appeals remain unverified. | YAP-MOD-014–016, YAP-AUTH-024 |

Expected results are acceptance requirements, not a claim of tested moderation. Part 3 owns enforcement and audit; Part 4 applies call/bot/media consequences. Follow-up: INV-002/006/012.

## J-07: Voice/video user

Entry: controlled consenting participants, supported devices and an authorized channel. No current mic/camera/display permission was granted by the agent.

| Step | Expected result | Investigated result / limit | Feature IDs |
| --- | --- | --- | --- |
| Audio settings → device/test | Explicit capture permission and usable device/error state | Device/mic-test/input processing controls observed. No live input test now. | YAP-VOICE-003–010 |
| Select channel → join silently | Joining/connected state, no accidental capture | Earlier sole-member muted connection and disconnection verified; not a two-way audio test. | YAP-VOICE-001, YAP-VOICE-002, YAP-VOICE-011 |
| Speak / moderate / stage | Publish only with authority and consent | Stage and moderation controls/docs inspected; hand raise/promotion enforcement unverified. | YAP-VOICE-013, YAP-VOICE-014 |
| Share → choose quality/source | Preview/OS consent, entitlement, measured delivery | Earlier quality chooser opened and cancelled before Go Live; no display stream tested. | YAP-VOICE-015–019 |
| Camera | Actual delivered camera video | **UNVERIFIED**. Roadmap lists camera calls as Next; do not infer support from voice/screen sharing. | YAP-VOICE-020 |
| Soundboard / activities / clips | Defined playback, sandbox and participant consent | Menus/settings observed, not launched. Meldiq clip policy differs and is a decision gate. | YAP-VOICE-021–027 |
| Leave / reconnect / missed call | Tracks release and participant state converge | Historical leave checked; reconnect/device failure/missed-call delivery unverified. | YAP-VOICE-001, YAP-NOTIFY-009 |

Part 4 owns this journey; Part 3 owns moderation and notification authority. Follow-up: INV-008/009/016, including real Android/Windows/mobile-browser tests.

## J-08: Platform administrator

Entry: explicitly authorized platform staff/admin account. **Not available for Yapin; no admin route or security restriction was bypassed.** A server owner is not a platform administrator.

| Workflow to investigate | Expected acceptance outcome | Current evidence / limit | Feature IDs |
| --- | --- | --- | --- |
| Sign in to staff surface | Role-specific permitted navigation | No staff UI observed; public docs do not establish its layout. | YAP-MOD-019 |
| Review escalated user/server/bug reports | Private evidence, assigned scope and review status | Public policy/community-report wording only. | YAP-MOD-012, YAP-MOD-013, YAP-MOD-017 |
| Review creators/bots/partner applications | Authorized decisions and auditable reasons | Applicant/eligibility surfaces only, not staff review screens. | YAP-PROFILE-022–024, YAP-COMM-028, YAP-DEV-004 |
| Apply restriction / handle appeal | Scoped action, reason, revocation and appeal lifecycle | No sanction or appeal executed. | YAP-AUTH-024, YAP-MOD-019 |
| Investigate operations/security | Accurate status and appropriately limited data access | Public security/status documents inspected; not private administrator tools. Meldiq central admin deployment identified separately. | YAP-OPS-001–007, YAP-TRUST-001–005 |

Do not invent a Yapin administrator navigation map to fill this gap. Part 3 owns the missing role-based investigation; Part 4 owns operational/commerce integration. Follow-up: INV-012/014. Existing Meldiq admin remains intact while its acceptance is verified independently.
