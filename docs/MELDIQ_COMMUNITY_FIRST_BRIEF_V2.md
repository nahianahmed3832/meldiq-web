# Meldiq Community-First Web App — Master Prompt for Claude Code

**Version:** 2.0 — includes the new Meldling mascot, reference screenshot analysis, Discord server onboarding/import, invitations, notifications, live presence/calls, and responsive UI.

## Mission

Act as the senior full-stack engineer responsible for implementing and shipping the next version of the existing Meldiq web app. Meldiq is moving toward a community-first, gaming-inspired, creator-friendly experience. Implement the visual/product requirements below, fix the listed bugs at their source, retain existing working features and user data, make mobile web genuinely usable, test the result, and deploy to production autonomously if the configured production environment is unambiguous and every release gate passes.

Do not stop after inspecting the repository or writing a plan. Work end-to-end: inspect → implement → test → review → deploy if safe → smoke-test → report accurately.

**Owner has authorized routine implementation and production deployment without asking for another approval.** This does not authorize destructive data loss, weakened authorization, exposing secrets, faking test/deployment success, or knowingly leaving a broken release live. For risky migrations, verify a backup and prefer backward-compatible changes. If a release gate cannot safely pass, preserve/restore the stable production release and report the exact blocker rather than pretending completion.

## 1. First, inspect the actual project

Before editing, inspect the repository and determine:

- Web app framework, routes, shared components, design tokens, asset directory, build scripts, lint/typecheck/test commands, and deployment flow.
- Backend APIs, database models, authorization/permissions, authentication, realtime transport (WebSocket/socket.io/etc.), presence lifecycle, notification/read state, calls, screen sharing, invitations, and community creation/discovery.
- Existing Discord OAuth/bot integration, if any; relevant environment variables and deployment configuration. Never print or commit credentials.
- Whether the Android/native app or shared mobile code lives in this repository or a linked workspace. Keep API changes compatible and update related mobile behavior where in scope.
- Baseline test/build status. Separate existing failures from regressions introduced by this work.

Search for old logo/mascot references across app navigation, favicon, PWA/manifest icons, auth screens, loading/error/empty states, DM entry points, notifications, metadata/social previews, and other visible app-shell surfaces.

Use the owner-provided images as visual references. The first supplied square image is the canonical **Meldling mascot**. The Yapin screenshots are interaction/layout references only. Do not copy Yapin’s logo, brand colors, illustrations, proprietary assets, or exact visual identity.

## 2. Brand and visual direction

### Canonical mascot: Meldling

The white/off-white bear-cub silhouette on the supplied solid deep-teal background is the official mascot and should be called **Meldling**. Use the exact provided asset as the source of truth.

- Preserve its simple two-color treatment: solid deep teal background and white/off-white mascot. Do not add extra colors, gradients inside the mascot, new facial details, outlines, accessories, or a different animal.
- Use the exact asset wherever the product needs its brand mascot: primary DM/Home button in the server rail, app-shell branding, favicon/app icon/PWA icons where practical, auth/loading states, relevant empty states, and branding moments.
- Replace the old logo in active product UI wherever it currently represents the app brand, especially small app-shell icons and navigation. Audit for stale old-logo references. Retain the product name **Meldiq** in text and page titles; the mascot’s name is **Meldling**. Do not rename the product to Meldling.
- Generate/prepare size variants from the supplied asset only where required by the current build pipeline. Preserve crisp edges and aspect ratio. If the asset has a solid background, do not fake transparency with an ugly cutout; use a contained rounded/square badge when transparency is unavailable. Do not stretch it.
- Do not replace user-uploaded images or historical content with the mascot.

### App palette and mood

Use a dark, vibrant foundation, with clear surface hierarchy:

- Backgrounds: deep navy/charcoal, with a slightly lighter elevated surface for sidebars, popovers and dialogs.
- Core accent family: cyan, blue and violet/purple, consistent with Meldiq’s community-first brand direction. Use pink/orange sparingly for meaningful highlights only. Meldling’s own icon remains two-color teal and off-white.
- Community-specific identity: each community can have its own validated accent/preset, banner, icon, role colors and visual style without restyling the whole app.
- Use gradients selectively, not on every card or control. Make the product expressive and social, not cluttered or excessively neon.
- Keep message text, channel labels, navigation, focus indicators, badges and dialogs readable. Meet good contrast, keyboard and screen-reader needs. Never use color alone to convey unread, active call, online, error or selected states.
- Respect reduced-motion preferences. Use short, purposeful transitions for hover/focus, unread state, navigation, messages and popovers. Avoid animations that interfere with reading, calls, keyboard navigation or performance.

## 3. Match the useful interaction patterns in the provided screenshots

Use the supplied Yapin screenshots to understand information architecture and expected flows, not as pixel-perfect designs to copy.

### A. Community/server workspace

Create or refine a familiar three-column community workspace where the existing product architecture supports it:

1. **Far-left server rail:** circular/rounded community icons with clear selected state, unread badges and small live indicators. At the top, the Meldling button opens the DM/Home hub. Include round **Create** and **Discover** actions. Keep account/settings controls accessible near the bottom. Do not let badges overlap or shrink icons excessively.
2. **Community/channel sidebar:** active community name and menu; channel categories; text and voice channels; selected channel, unread highlights/counts, mentions and active call/screen-share markers. Keep channel/category order stable. Ensure long names truncate gracefully with tooltips.
3. **Main content:** channel header, messages or voice/video interface, composer, clear call actions, notification/pin/search controls where the existing features support them.
4. **Optional member panel:** a right-side member list at wide viewports, with presence and active call status, and accessible profile popovers. On smaller widths, make this panel collapsible or open it as a drawer; never squeeze the message area to unusable width.

### B. DM/Home and Discover hub

- The Meldling mascot button is the main **Home / Direct Messages** entry point. Clicking it opens a DM/Home hub with recent DMs, unread indicators, search and a clear way to start a conversation/group when supported.
- Move the old standalone sidebar text buttons **DMs**, **Activity** and **Later** away from their old sidebar position, but preserve their features, routes, history and data. Place Activity in a useful notification/inbox surface; place Later/saved items in message actions, bookmarks or a sensible saved-items destination. Do not delete or orphan saved items.
- Discover opens a dedicated community discovery window/page. Follow the reference layout’s intent: a compact secondary navigation area (e.g. Friends, Find People, Create Group where supported), a strong community search, filters/tags if backed by real data, and responsive community cards with image/icon, name, description, relevant tags and member count if verified, plus Join/Open buttons.
- If real promoted/featured listings already exist, display them honestly. Do not invent promotion badges, communities, counts or activity. If there is no promotion system yet, use a standard discovery list/grid and do not create fake promoted cards.
- Create opens the community/server creation flow in a polished modal/page with supported fields, validation, icon/banner upload if existing upload infrastructure permits, correct permissions, loading/errors, duplicate-submit prevention, and navigation to the created community after success.
- The **Create** and **Discover** controls should be circular icon buttons consistent with the server rail, with tooltips and accessible names. At small widths retain access without covering content.

### C. Community invitation modal and landing page

Follow the useful pattern shown in the reference images:

- An **Invite people to [Community]** dialog with a searchable list of eligible existing Meldiq users, selection feedback, and a primary invite/add action where the current permissions allow it.
- A clear shareable invitation link with Copy and native Share where available. Make expiry and use limits explicit and configurable if the backend supports them. Avoid silently creating public, never-expiring invites unless that matches an explicit owner-selected setting and current policy.
- Invitation landing page with the community icon/banner, name, short description/public preview, legitimate member count if available, and one clear **Join Community** or **Open Community** action. Signed-out users should be returned to the invitation after authentication. Already-members should see Open; expired/revoked/invalid/full invitations should show clear and safe messages.
- Add direct member addition for authorized admins/moderators as separately described below. Never leak private-community details to unauthorized visitors.

### D. Discord server import wizard

Implement a first-class **Import from Discord** flow inspired by the reference modal, clearly branded for Meldiq:

1. Explain what can be imported and what cannot before requesting authorization.
2. **Connect Discord** using Discord’s supported OAuth2 authorization flow. Use the official bot installation/OAuth flow and the least privileges needed for the selected import scope. The person must be an owner or have the required permission to authorize access to that server.
3. Let the authorized user choose a Discord server, verify the bot/authorization relationship server-side, and select an existing Meldiq community or create a new one as the import destination.
4. Preview available structure and show a checklist of importable items, mapping and conflicts. Support an explicit review/confirm step inside the product before executing the user-requested import. This is a normal product confirmation, not a request for the owner to approve code changes.
5. Import supported community structure through official API access: server name and icon/banner where allowed; channel categories and channel definitions where supported; text/voice channel structure; role definitions and colors; relevant permissions/overwrites where the Meldiq permission model can map them safely; emojis/stickers only where access, APIs and product support allow them. Show any unsupported fields clearly and provide sensible mapping options rather than silently dropping settings.
6. Use an idempotent import job with progress, per-item results, retry for recoverable errors, and a final summary. Do not duplicate the community or channels if a job is retried. Preserve the original Discord server without mutating or deleting it.
7. Show the destination’s Meldiq invite link after import so members can join themselves. The feature is for onboarding community structure—not silently creating Meldiq accounts for every Discord member.

**Discord integration security/policy requirements:**

- Use the official Discord Developer OAuth2/Bot APIs and current official documentation. Never scrape Discord’s web client, automate a normal user account/self-bot, ask the user for their Discord password, request a user token, or bypass permission/intent/access-review requirements.
- Request only the required scopes and bot permissions. Do not request Administrator if a smaller permission set can perform the import. Keep tokens server-side; store the minimum token material required, encrypt/protect it according to the current secrets/session architecture, never return tokens to the browser, never log secrets, and implement revocation/disconnect handling.
- The Discord API/policy may restrict access to guild members, presence and message content, and rules have changed over time. Re-check current official documentation during implementation. Do not promise importing message history, member accounts, DMs, historical voice activity or private data. Keep those out of scope by default and explain limitations clearly in the UI. Do not request privileged intents or special access unless the feature truly requires them and the app is eligible/approved.
- Import metadata and structural content only when official endpoints, authorization, permissions and policy allow it. Respect rate limits, retry headers/backoff and Discord API terms. Never treat an incoming guild ID or client-provided ownership claim as proof of authorization; verify on the server.
- If Discord application credentials, redirect URLs, bot configuration or platform review are missing, implement the integration architecture and safe configuration/error states but do not fake a successful connection/import. Document exactly which environment configuration or Discord-side action remains required. Do not expose a non-working “Import complete” button in production.
- Clearly identify the Discord connection and server selected, what data will be imported, what is excluded, and whether access can be disconnected afterward. Do not store extra Discord data beyond what is needed for the import.

Official docs to consult during implementation:
- OAuth2: https://discord.com/developers/docs/topics/oauth2
- Server/channel management: https://discord.com/developers/docs/resources/guild and https://discord.com/developers/docs/topics/permissions
- Discord Developer Policy: https://discord.com/developers/docs/policies-and-agreements/developer-policy
- Review current API/privileged access changes before shipping; do not assume old examples remain valid.

## 4. Required bug fixes and functionality

### A. Presence flickers online/offline after sending messages

Trace presence end-to-end from authenticated session, WebSocket/socket lifecycle, heartbeat/last-seen expiry, reconnects, message API mutations, realtime events and client cache. Fix the actual root cause; do not just debounce the UI.

- Presence must derive from authenticated active connections and the existing presence policy—not from sending a message, reacting, opening a channel or optimistic message state.
- A message event must never briefly force sender/recipient online or offline. Aggregate multiple supported tabs/devices so one session closing does not mark the person offline while another valid session remains connected.
- Handle heartbeat expiry, network jitter, tab sleep/resume, reconnect and delayed/duplicate events. Reconcile client state with authoritative server presence and prevent both stale-online and rapid-flapping problems.
- Respect existing privacy settings and permissions.
- Add regression tests: send DM while connected; send community message while connected; offline recipient; multiple sessions; reconnect; heartbeat expiry; duplicate/out-of-order events; rapid channel switching. Confirm no false one-second transition.

### B. Reaction details must show who reacted

- Hover/focus on desktop opens a tooltip/popover listing actual reactor names/avatars and count. On touch screens, tap/click exposes the same details; do not rely on hover.
- Handle many reactors with a bounded scrollable list or View All. Update live when reactions are added/removed; avoid duplicate/stale names and counts.
- Respect visibility permissions; provide keyboard and screen-reader support; do not break add/remove reaction behavior. Reuse the same component in DMs and communities where possible.

### C. Channel unread highlights and counts

- An unread channel gets a clear high-contrast white/light treatment in both its row and related icon, coordinated with the dark theme. One unread event: highlight without a numeric count. Two or more: highlight plus the count. Make unread distinct from active/selected, mention and call states.
- Count only relevant unseen events for the current user according to one documented policy. Exclude the user's own messages and deduplicate events received from API and socket. Respect muted channels/communities, notification preferences, permissions and mentions.
- Use authoritative per-user/per-channel read cursors or existing equivalent, persist and sync across devices. Opening a channel must not clear state before the relevant content has actually been reached/read under existing semantics.
- Roll up relevant unread state to the community icon without leaking inaccessible/private channel activity. Cap displayed counts visually (e.g. 99+) without losing actual count. Handle deleted messages, replies, reactions, reordering and reconnect.
- Tests: one vs. multiple unread events, event dedupe, own messages, mute behavior, access control, read cursor persistence, multi-device sync and server-level rollups.

### D. Notification sound, in-app badge, browser title/favicon

- Build on the existing realtime notification pipeline; do not create duplicate systems. Provide configurable sound and a setting to turn it on/off (and volume if appropriate). Respect browser autoplay: enable/initialize sound after an explicit user gesture and explain when blocked.
- Do not sound for own messages, active conversations currently being read, muted areas or excluded events. Throttle/batch floods without hiding important DMs/mentions.
- Add visible in-app unread badges for DMs, channels, mentions and community activity. Update document title counts and a dynamic favicon badge where supported. Preserve Meldling branding in the favicon; use a fallback title count/UI indicator where dynamic favicon is unsupported.
- Request native browser-notification permission only after the user explicitly chooses to enable it. Handle denied, unsupported and revoked permissions gracefully. Extend current service-worker infrastructure if present rather than creating a duplicate.
- Add settings and tests for preferences, focus/background behavior, multiple tabs and duplicate-event suppression. Never promise OS/browser push where the current architecture does not support it.

### E. Voice/video/screen-share state

- Show visible live indicators in the right community/channel row and community workspace when a voice call, video call or screen share is active. Include icon, tooltip/label, participant count/avatar preview where permitted, and an obvious Join action for authorized users.
- Source indicators from the actual call/session backend and realtime state. Distinguish voice, video and screen sharing; screen sharing within a call should not look like a separate unrelated call.
- Update on join, leave, reconnect, end and share start/stop. Clean up stale states. Do not expose private channel names, participants or call metadata without access. Ensure the indicator reflects actual sharing, not just the ability to share.
- Test supported call lifecycle and reconnection paths with real/staging call infrastructure when available; do not fabricate successful real-time test results.

### F. Direct member add and robust invitations

- Add an **Add Members** action in community member/admin UI. Authorized owner/admin/moderator can search eligible existing Meldiq accounts and add them directly within policy. Enforce authorization on the server. Handle privacy/visibility, blocks, duplicates, ineligible users, rate limits and useful errors. Notify the added user and offer a path to open the community. Preserve acceptance requirements where the existing policy requires acceptance.
- Improve invites with secure server-generated tokens, Copy Link, native Share on supported devices, configurable expiry/usage limits if supported, revocation, explicit success/failure feedback and a clear invite preview.
- Signed-out users go through auth and return to the original invite. Existing members see Open; new eligible members can Join directly. Handle expired/revoked/invalid/full links safely and do not reveal private details before permission checks.
- Never use predictable tokens or client-only permission enforcement. Add tests for auth bypass, duplicate joins, expiry, revocation, redirects and mobile sharing.

### G. Navigation and homepage actions

- Remove DMs, Activity and Later from their old sidebar position while preserving function, data, routes and saved history.
- Meldling button opens the DM/Home hub with recent conversations, unread states, search and existing conversation history intact.
- Move Activity into a useful notification/inbox center or existing suitable surface. Move Later/saved items to message actions, bookmarks or a suitable Saved destination.
- Place round Create and Discover buttons in the server rail/navigation. Discover opens a functional searchable community page. Create opens a functional community/server creation flow and navigates to the new community on success.
- Keep keyboard navigation, tooltips, active-route styles, mobile back behavior and existing relevant account/settings controls.

### H. Branded typing indicator: “Meldling…”

- Replace the generic “Typing…”/“Someone is typing…” UI with a subtle, branded typing indicator: the small Meldling mascot followed by **“Meldling…”** with a tasteful animated ellipsis.
- Show one deduplicated indicator when one or more people are actively typing in the current DM/channel. Use actual realtime typing events and normal timeout/cleanup rules; do not leave it visible after users stop typing or disconnect. Do not confuse this UI label with an AI-generated message or imply the mascot account is sending a message.
- Keep the indicator visually secondary, accessible to screen readers, usable on mobile, and compliant with reduced-motion preferences. Avoid animation that shifts the message list significantly.

## 5. Community identity and profile customization

Implement/extend only where it fits existing models and architecture:

- Community icon and banner/cover, curated accent/theme presets, role colors, channel icon treatment and other scoped visual identity.
- Member profile cards with avatar, display name, status, role/badges and existing profile information. Avoid inventing data or adding decorative elements that hurt readability.
- Activity/event cards, member highlights and community milestones only where a real, supportable feature/data source exists. No fake counters or generated live activity.
- Use community theme tokens scoped to that community. Validate color contrast and uploaded media. One community’s customization must not override the global theme or another community’s design.
- Keep free/community access generous; do not paywall basic message, voice or community participation just to create premium cosmetics. Build only necessary foundations for premium customization if no subscription billing feature currently exists; do not create fake purchasing flows or invent prices. Premium cosmetics/admin subscriptions can be phased after core UX is stable.

## 6. Responsive/mobile quality is required

The web app is the first target, but the completed web design must be usable on phones/tablets and not just desktop.

- Validate at ~320, 360/375, 430, tablet and wide desktop widths. Avoid horizontal page overflow, clipped dialogs, collapsed message composer, unread badges covering names, or call controls pushed off-screen.
- On narrow screens provide clear transitions among community rail/list, channel list, DM/conversation and content views, including back controls and preserved selection/scroll state.
- Reaction details, invites, member search, Discover, Create, profiles, notification settings, call indicators and Discord import must all work on touch—never depend on hover.
- Respect mobile safe areas and virtual keyboards; keep touch targets comfortably usable. Dialogs/popovers must fit the viewport and scroll appropriately.
- Test Safari/iOS and Chromium/mobile layouts as available. Optimize large lists and message history where the current app needs virtualization/pagination.
- Identify existing native mobile app and shared APIs. Preserve compatibility; make corresponding native fixes for presence/unread/call/invitation contracts where applicable. Do not claim native parity unless it has been tested. If native changes are outside the repository or tooling, document exactly what was verified and what remains.

## 7. Security, data and engineering constraints

- Preserve existing auth, authorization, privacy, tenant/community isolation and role semantics. Enforce every permission on the server—not only in frontend visibility.
- Validate/sanitize all user text, uploads, theme colors, community names/descriptions, links and imported Discord data. Protect against XSS, unsafe URLs, malicious metadata and upload abuse.
- Real-time events must be authorized, typed/version-compatible, idempotent and robust to duplicate/out-of-order delivery. Clean up listeners on unmount and prevent one socket listener per render.
- Avoid N+1 fetching, unbounded popovers, full-history reads for unread counts and excessive polling. Respect API rate limits.
- Migrations must be backward compatible where possible. Verify a restorable backup before risky/destructive migrations. Never delete/overwrite user history simply because navigation changes.
- Do not check secrets into source control or include secrets in logs. Use existing environment/secrets management and deployment procedures.
- Do not hardcode production URLs, OAuth secrets, Discord bot tokens, user identifiers or admin credentials.
- No mock users, fabricated community counts, dummy live calls or false notifications in production paths.

## 8. Required execution sequence

### Phase 1 — Baseline and map the code

Inspect project structure, current bugs, existing UI, assets and deploy flow. Record baseline checks. Identify code paths for every item in this brief.

### Phase 2 — Fix state correctness first

Fix presence flicker; reaction reactor data; authoritative read/unread state; notification event deduplication; and call/screen-share session indicators. Add regression tests before or alongside implementation.

### Phase 3 — Implement community-first shell and brand

Apply the dark vibrant tokens, use the canonical Meldling asset everywhere the app brand appears, build the server rail/workspace layout, move sidebar destinations without deleting them, and implement the mascot DM/Home hub plus circular Create/Discover controls.

### Phase 4 — Build social/discovery/invitation flows

Implement Discover, Create Community, direct add members, invitation modal/link/preview/join flow, reaction-user UI and the branded Meldling typing indicator.

### Phase 5 — Implement Discord import

Verify official current Discord API requirements first. Build secure OAuth/bot flow, server selection, import preview/mapping, safe structure import, progress/error/retry, final summary and invitation to bring members to Meldiq. If external Discord configuration or API approval is missing, finish the implementation as far as possible with transparent configuration states; never simulate a completed import.

### Phase 6 — Responsive, accessibility and polish

Verify all routes at phone/tablet/desktop widths; touch interactions; keyboard/focus; screen-reader labels; contrast; reduced motion; and error/loading/empty states.

### Phase 7 — Test, review, deploy, smoke-test

- Run the project’s actual lint, typecheck, unit, integration, backend and production-build commands. Run native/mobile checks where available. Add new tests for this brief. Do not delete tests merely to make the suite green.
- Review the complete diff for regressions, old logo references, accessibility, secrets, insecure permissions, mock data and accidentally removed features.
- Confirm the intended production target and use the repository’s standard CI/CD/deployment procedure. Do not guess at an ambiguous production target.
- Back up/verify before risky migrations. Prefer compatible migration sequencing. Deploy without a separate routine owner approval only if all release gates pass.
- Smoke-test production using controlled test accounts: sign in; DM and community message presence stability; reaction-user details; unread count/read clear; sound/title/favicon behavior; community creation/discovery; invitation/add-member/join; call indicators where real test infrastructure supports them; Meldling UI; mobile navigation; and Discord import configuration/OAuth only if configured. Do not perform destructive actions on real user data.
- Observe logs/health checks for regressions. If a critical deployment regression appears, roll back using the established process and verify recovery.
- If deployment credentials, production environment, Discord credentials or required platform approvals are missing, do as much safe work as possible and report the precise blocker. Never claim deployment/import success that did not happen.

## 9. Acceptance checklist

### Brand and layout
- [ ] Mascot is called Meldling; supplied two-color image is the canonical app mascot.
- [ ] No stale old logo remains in key app-shell/DM/navigation/favicon/PWA/auth surfaces unless there is a clear technical reason documented.
- [ ] Product text still says Meldiq; do not rename the product.
- [ ] Server rail + channel sidebar + main content + optional member panel work at desktop and adapt gracefully on mobile.
- [ ] Create and Discover are round, accessible actions; the mascot opens DM/Home with the DM list.
- [ ] Activity and Later features remain accessible after being removed from their old sidebar position.
- [ ] Discover and Create work with real backend data, loading/empty/error states and correct authorization.
- [ ] Community themes are scoped and readable; no fake activity/counts/promotions.

### Messaging, presence and notifications
- [ ] Sending DM/community messages does not induce a false online/offline transition.
- [ ] Online/offline reflects active sessions under the existing policy, including multiple devices and reconnects.
- [ ] Reaction hover/focus and touch show who reacted with up-to-date count/list.
- [ ] One unread event gives highlight without a number; two+ give highlight plus count on channel row/icon.
- [ ] Read state persists and syncs; own messages and duplicate events do not inflate counts.
- [ ] Sound, in-app badges, title count, dynamic favicon/fallback and opted-in browser notifications function without duplicate alerts.
- [ ] Meldling typing indicator appears only while real typing events are active and cleans up correctly.
- [ ] Voice/video/screen-share indicators reflect real current sessions and do not become stale.

### Invites and Discord import
- [ ] Direct add members is server-authorized and respects privacy, blocks, rate limits and duplicates.
- [ ] Invite link supports preview, copy/share, authentication return, direct join/open and invalid/expired/revoked handling.
- [ ] Discord import uses official OAuth/bot APIs, least privilege and server-side verification.
- [ ] Import preview shows exactly what will be copied; supported categories/channels/roles/emojis/assets are mapped accurately.
- [ ] Message history/member-account migration is not promised unless current official APIs and policy truly allow the specific workflow.
- [ ] Import is retry-safe, preserves the source Discord server and offers a Meldiq invite after completion.
- [ ] Missing credentials/permissions never result in a fake success state.

### Quality and release
- [ ] Web works at small mobile, tablet and desktop breakpoints with no blocking overflow/clipping.
- [ ] Hover interactions have touch alternatives; accessibility and reduced-motion behavior are checked.
- [ ] Relevant lint/type/test/build checks pass, or exact pre-existing/unresolved failures are disclosed.
- [ ] Production deployment is verified, or the exact blocker is reported without claiming success.
- [ ] Smoke tests, deployment revision, backup/migration status and mobile/native scope are documented.

## 10. Final engineering report

When finished, provide a truthful report with:

1. **Shipped:** important UI/feature changes.
2. **Root causes fixed:** real cause of presence flicker and other correctness bugs.
3. **Discord import:** supported items, excluded items, required configuration, and whether a real authorized import was tested.
4. **Verification:** exact commands/checks and outcomes; distinguish baseline failures from new failures.
5. **Production deployment:** deployed or not, target/revision/time if available, backup/migration state, smoke-test results or blocker.
6. **Mobile:** responsive-web widths tested, browser/platform tests, native paths updated or not.
7. **Remaining issues:** only real unresolved risks or blockers.

## Final directive

Begin by inspecting the existing repository. Then implement this brief using the project’s current architecture and supplied mascot/reference images. Do not stop at planning. Do not ask for routine implementation approval. Ship a stable, accessible, community-first Meldiq web experience and deploy it only when the configured production target and release checks make that safe.
