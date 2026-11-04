# Meldiq UI standardization

This implementation consolidates the existing product UI without changing API contracts, database schemas, authentication, encryption, or payment-provider behavior. Existing uncommitted work was retained. The before-refactor inventory covers 330 TSX surfaces, 106 dialog mounts, and 31 menu mounts; see [INVENTORY.md](INVENTORY.md).

## Original problems and consolidation

| Original problem                                                                          | Implemented result                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account, Appearance, and the profile menu independently exposed language configuration    | Language is a visible personal settings destination. The profile-menu shortcut navigates there. Authentication and checkout retain the same shared language picker where language access is useful.                                                                              |
| The profile menu repeated all theme controls                                              | It links to Appearance, which owns the theme controls.                                                                                                                                                                                                                           |
| Account had separate display-name and username modal editors                              | Both Edit actions navigate to the full Profile editor and its shared preview, validation, revision checks, save, and reset. The independent TextEdit implementation was removed.                                                                                                 |
| My Account mixed passwords, security, sessions, language, services, and account data      | Account owns email, standing, verification, data export, and deletion. Privacy & Security owns passwords, two-step sign-in, passkeys, keys, recovery codes, visibility, blocked users, messaging rules, read receipts, typing, and link safety.                                  |
| Sessions, devices, identity providers, profile services, and OAuth grants were scattered  | Devices & Connections groups them while retaining the distinct session-termination and device-revocation contracts and explanations.                                                                                                                                             |
| Storage and About URLs silently displayed Profile                                         | Both routes now render their existing functional pages. Bug reports are under About.                                                                                                                                                                                             |
| Accessibility was buried in Appearance                                                    | Accessibility has one editor for text size, animation, density, line spacing, motion, and contrast. Appearance owns themes, layout, media, and chat gestures.                                                                                                                    |
| Community Overview mixed identity, discovery, moderation, and bot/ticket setup            | Discovery & access, Moderation, Integrations, and personal community Notifications have separate destinations using the existing forms. Overview focuses on identity and membership.                                                                                             |
| Community/legacy desktop links and mobile settings were independently rendered            | Shared SettingsNavigation renders the same filtered destinations as desktop search and a compact mobile selector. Direct routes enforce those availability rules too.                                                                                                            |
| Channel creation and editing differed by entry point                                      | Community Channels uses the same CreateChannelDialog and EditChannelDialog as contextual actions. Details uses that editor too. Legacy and branch/team-scoped adapters remain for their distinct API workflows.                                                                  |
| Notification menus had different labels and lacked an inheritance/reset choice in Details | NotificationLevelSelect supplies the shared labels and explicit Default behavior. Conversation rows link to contextual settings; the bell retains useful quick mute controls. Community menus open the single community notification page.                                       |
| Destructive actions used a mix of native confirm boxes and application dialogs            | All nine formerly native confirmation calls now use the shared, keyboard-accessible ConfirmationDialog. Session termination and channel archiving also confirm before changing state. Existing typed-delete dialogs remain.                                                      |
| Profile drafts could disappear when navigating                                            | Independent draft registrations protect profile fields, style, community profile, community identity/branding/rules, and channel edits. In-app links, Back/Forward, and window close ask before abandoning registered drafts; reload/closing the browser uses its unload prompt. |
| Primary and profile menus repeated daily navigation and new-message entry points          | Home, Messages, Activity, and Communities form the daily hierarchy. Saved stays secondary. Profile-menu configuration shortcuts share authoritative routes; duplicate Activity/settings header buttons, the DM find-people duplicate, and the DM subscription card were removed. |

## Final navigation

- Primary: Home, Messages, Activity, and Communities/Discover, with joined communities in the rail. On phones, Home includes the community rail; the bottom bar adds You for personal settings.
- Personal settings: Personal (My Account, My Profile, Privacy & Security, Devices & Connections); App preferences (Notifications, Appearance, Voice & Audio, Accessibility, Language, Shortcuts); Subscription & billing (Meldiq Plus, Billing, Gifts, Spark); Programs & tools; Help & storage; administrator-only platform tools.
- Community settings: Overview, Lobby/Guide, Theme, Discovery & access, Notifications, Channels, Rules and Sparks; expressions; Integrations; Members, Roles, Onboarding, invitations and applications; Moderation, reports and audit; events and usage. Features and permissions filter the list and the direct destination.
- Channel configuration: shared Overview/Permissions/Webhooks editor in the channel context. Workspace Channels is an index and a shortcut into those forms. Personal conversation notification overrides remain scoped to that conversation.

Existing paths stay valid. `/workspace/bots` opens Integrations. `/workspace/security` opens Moderation. On older scoped servers, `/workspace/theme` opens the branding controls in Overview. New routes are `/settings/accessibility`, `/settings/language`, `/workspace/discovery`, `/workspace/integrations`, and `/workspace/notifications`.

## Pages and routes changed

| Area                   | Routes and implementation changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application shell      | `/home`, `/dms`, `/friends`, `/activity`, `/later`, `/discover`, and joined-community navigation share the primary navigation definitions, secondary Saved entry, menus, and responsive controls. Their existing feature pages remain.                                                                                                                                                                                                                                                                                           |
| Identity and account   | `/settings/account`, `/settings/profile`, `/settings/security`, `/settings/devices`: authoritative editors, relocated authentication and connections, shared destructive confirmations, and draft protection.                                                                                                                                                                                                                                                                                                                    |
| Preferences            | `/settings/notifications`, `/settings/appearance`, new `/settings/accessibility`, new `/settings/language`, and `/settings/advanced`: separate scopes, shared controls, and consolidated language, accessibility, privacy, link-safety, and notification forms. `/settings/calls` and `/settings/shortcuts` use the shared navigation and design system.                                                                                                                                                                         |
| Billing and support    | `/settings/mojo`, `/settings/billing`, `/settings/gifts`, `/settings/storage`, `/settings/about`: centralized subscription management, real Storage/About content, and bug reporting under About. Existing checkout, Spark, programs, developer, creator, and administrator destinations remain in the filtered shared catalog.                                                                                                                                                                                                  |
| Community organization | `/workspace/overview`, `/workspace/theme`, `/workspace/security`, new `/workspace/discovery`, new `/workspace/integrations`, new `/workspace/notifications`, and compatibility `/workspace/bots`: move the existing forms to their authoritative categories.                                                                                                                                                                                                                                                                     |
| Community tools        | `/workspace/channels`, `/workspace/people`, `/workspace/roles`, `/workspace/invitations`, `/workspace/applications`, `/workspace/reports`, `/workspace/bans`, `/workspace/audit`, `/workspace/usage`, `/workspace/meetings`, `/workspace/pins`, `/workspace/guide`, `/workspace/onboarding`, `/workspace/expressions`, `/workspace/rules`, `/workspace/sparks`, `/workspace/promote`, `/workspace/lobby`: shared permission-aware navigation, cards, and responsive presentation; feature-specific forms and workflows retained. |
| Conversations          | `/home/c/:id/details` and `/dms/c/:id/details`, channel creation/editing menus, and notification menus: shared channel editors, inherited notification levels, and archive confirmation.                                                                                                                                                                                                                                                                                                                                         |

## Shared components and design

New shared components are SettingsNavigation, SettingsUnavailable, SettingsCard/Card, ErrorLine, NotificationLevelSelect, ConfirmationDialog, and UnsavedChangesDialog/useUnsavedChanges. Navigation definitions live in shell/navigation, settings/settingsCatalog, and workspace/communityRail. Existing Dialog, Menu, Toggle, Avatar, SettingsIcon, language selection, permission bodies, and feature forms remain in use.

The global standardization stylesheet applies shared control heights, spacing, type, radii, cards, overlays, status banners, focus behavior, wrapping, and mobile touch targets throughout the product. New browsers use the navy Midnight palette with cyan/blue/violet accents. Every valid stored palette remains intact. Desktop settings have a bounded, independently scrolling sidebar; phones use full-screen settings and a compact community page selector. Existing reduced-motion, high-contrast, RTL, and theme preferences remain supported. Dialog headers and actions stay within the visible viewport while long content scrolls. Community rail menus wait for permission loading before showing actions, so an arriving permission response cannot move a different action under the pointer.

All 28 language catalogs include the new navigation, scope, and draft-confirmation messages.

## Removed obsolete implementations

- AccountOverview’s independent TextEdit modal.
- SecurityPage’s separate sign-out implementation and its duplicate confirmation flows; account actions remain centralized in AccountActions.
- MojoPromoCard and the redundant DM find-people action (New message opens the same finder).
- CommunityNotificationsDialog’s unused wrapper and independently implemented community-menu preference submenu.
- Duplicate notification-level arrays in ConversationSettings and ConversationRow.
- SettingsView’s local USER_PAGES/APP_PAGES arrays and WorkspaceView’s second settings-rail renderer; catalogs and SettingsNavigation replace them.
- Independent native window.confirm calls across developer apps/bots, authorized apps, decorations, community pins, templates, and installed bots.

No complete feature area or backend implementation was deleted. [changed-files.json](changed-files.json) lists the touched implementation, test, locale, and delivery files. The shared Card import replacement covers 40 feature forms without changing their feature behavior.

## Functionality retained

Authentication, account creation/recovery/switching, organizations, membership, DMs/groups, communities/channels, calls, screen sharing, files, notifications, permissions, integrations, profile customization, privacy, languages, administrator tools, subscriptions, gifts, and PayPal checkout/cancellation continue through their existing services. Profile customization remains free. The public offers remain Free and Meldiq Plus; this work adds no Go offer. Legacy entitlement decoding remains for existing records.

## Verification

Verified on 2026-11-04. The local browser tests use throwaway SQLite-backed API data and the built production export. See [verification.json](verification.json) for structured results.

| Check                               | Result                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit and contract tests             | **140 files passed; 957 tests passed, 1 skipped**. Includes navigation-guard registration/cleanup, catalog/search, preferences, schemas, and existing application/service tests.                                                                                                                                                         |
| Type check                          | `npm run typecheck` passed.                                                                                                                                                                                                                                                                                                              |
| Lint                                | `npm run lint` passed.                                                                                                                                                                                                                                                                                                                   |
| Production build                    | `npm run build` passed, including TypeScript, Next.js static export, export finishing, and the service worker build. The final targeted browser run rebuilt this output.                                                                                                                                                                 |
| Localization                        | `npm run i18n:check` passed: all 28 locales have 6,211 keys, 100% coverage, zero structural errors, zero missing/untranslated messages, and zero hardcoded-source candidates.                                                                                                                                                            |
| Broad production browser regression | 56 Chromium scenarios executed: 53 initially passed. The mobile selector label/layout and short-window screen-share space were corrected; a stale notification-copy expectation was updated to the existing localized message. All affected cases passed in the final rerun below.                                                       |
| Final targeted production rerun     | **13/13 passed**: responsive nested community actions, PWA/offline recovery, notification delivery/mute/mentions/calls, encrypted portrait/landscape shares and capture-unavailable viewing, authoritative settings, independent drafts/Back navigation, permission guards, shared channel creation/editing, and archive cancel/confirm. |
| Final additional browsers           | **24/24 passed**: six profile/settings/community/channel scenarios each in desktop Firefox, desktop WebKit, Pixel-size Chromium, and iPhone-size WebKit.                                                                                                                                                                                 |
| Responsive coverage                 | Home, DM, channel, both Details panels, Notifications, and Discover fit at 320×568, 360×800, 375×812, 390×844, 412×915, 430×932, 768×1024, 1024×768, 1280×800, and 1440×900. Additional tests cover mobile landscape and screen-share windows as short as 560/620px.                                                                     |
| Changed-file formatting             | Every touched source, test, locale, and report file passes Prettier. The repository-wide check reports 24 unrelated pre-existing files; see the remaining issues below.                                                                                                                                                                  |
| Whitespace                          | `git diff --check` passed.                                                                                                                                                                                                                                                                                                               |

The broad regression also passed all seven real encrypted-call scenarios against the local native media peer, file/photo/video sharing and original-byte recovery, account registration/recovery/linking, two-step sign-in, email changes, membership/permissions/roles, lobby editing, webhooks/tickets/integrations/discovery, free profile collection/customization, language/RTL and cross-device synchronization, and all eight PayPal SDK/API-mocked checkout scenarios. The payment tests exercise review, approval/cancel handling, server-confirmed completion, renewal scheduling, add-ons, and term display; they do not execute live charges.

Screenshots reviewed include the main shell/DM/channel layouts across the ten viewport sizes, community and personal settings, role permissions and nested menus, subscription review, free profile customization, localization, and screen sharing. Selected evidence is retained here:

- [Desktop settings](evidence/settings-desktop.png) (high contrast enabled by the test).
- [Mobile community settings](evidence/community-mobile.png).
- [Role permissions dialog](evidence/role-permissions.png).
- [Desktop direct messages](evidence/direct-messages.png).

### Reproducing the checks

```sh
npm test -- --maxWorkers=4
npm run typecheck
npm run lint
npm run i18n:check
npm run build
```

The browser harness needs a matching API checkout. This run used API 0.76.1 at `/private/tmp/meldiq-localization-api-release/server`; the default neighboring 0.75.1 checkout lacks `/v2/messages`. Media checks also need the installed native peer package:

```sh
ORBIT_SERVER_DIR=/private/tmp/meldiq-localization-api-release/server \
ORBIT_GRIIP_BOT_DIR=/Volumes/code_files/meldiq_android/tools/griip-bot \
ORBIT_E2E_BUILD=1 \
npx playwright test e2e/ui-standardization.spec.ts e2e/mobile-overlays.spec.ts \
  e2e/screen-share.spec.ts e2e/notifications.spec.ts --project=chromium

ORBIT_SERVER_DIR=/private/tmp/meldiq-localization-api-release/server \
ORBIT_GRIIP_BOT_DIR=/Volumes/code_files/meldiq_android/tools/griip-bot \
ORBIT_E2E_BUILD=1 \
npx playwright test e2e/ui-standardization.spec.ts e2e/settings-redesign.spec.ts \
  --project=firefox --project=webkit --project=phone-width --project=iphone-width
```

The second final run reused the already-built export through a temporary configuration and separate local ports. The command above uses the repository's standard build-enabled harness to reproduce the same scenarios.

## Remaining issues and final audit

- Repository-wide `npm run format:check` still flags **24 files outside this implementation**. They were left intact to preserve existing work. [verification.json](verification.json) contains the exact paths; none intersects the touched-file manifest.
- Real PayPal settlement/provider consent and physical-device acceptance were not performed. Browser emulation, local encrypted native-peer media, and mocked payment flows are the evidence available from this run. New translations passed automated checks and still benefit from native-speaker review.
- Production deployment completed on 2026-11-04 from the current production baseline; see [DEPLOYMENT.md](DEPLOYMENT.md) for the merge, release and verification evidence. There are no dependency additions, API/database migrations, or backend modifications in this implementation.

The final source audit found no native confirmation calls remaining. Personal settings and community settings now use one catalog each for both visibility and direct-route availability. The remaining intentional access points use shared implementations: language at sign-in/checkout, quick mute at the channel bell, profile-menu settings links, and the Channels index opening the contextual editor. Legacy scoped organization adapters remain because they implement different existing workflows. Existing authentication, encryption, payments, and free customization services remain authoritative.
