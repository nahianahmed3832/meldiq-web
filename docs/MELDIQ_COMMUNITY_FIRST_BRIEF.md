# Meldiq Community-First Redesign — Master Implementation Prompt for Claude Code

> **Project objective:** Implement the Meldiq web-app community-first visual redesign, fix the listed reliability and usability bugs, improve community discovery/creation and invitations, ensure responsive/mobile parity, run the relevant test suite, and deploy to production autonomously when release checks pass. The owner will review the result the following morning, so do not stop at a plan or wait for routine feature approvals.
>
> **Priority order:** (1) preserve data, security and existing functionality; (2) fix presence, reactions, unread indicators, notifications and call-state bugs; (3) implement the new information architecture and community UX; (4) polish desktop and mobile responsive behavior; (5) test and deploy.

---

## 0. Operating instructions — execute, do not just advise

You are acting as the senior full-stack engineer responsible for shipping this work in the existing Meldiq repository.

1. Inspect the repository before editing. Identify the web app, backend/API, real-time transport, authentication, data models, deployment configuration, test commands, and any native mobile app. Read project documentation, current design tokens and existing components. Trace each reported bug to its actual event/data flow.
2. Build on the current architecture and established patterns. Do not perform a wholesale rewrite, replace working systems unnecessarily, or introduce a new database/realtime framework just because it is easier to start over.
3. Make the changes in the codebase. Do not return only a plan, mockup, list of recommendations, or pseudocode. Continue through implementation, tests, release preparation and production deployment if access/configuration allows.
4. Make sensible engineering decisions without waiting for routine approval. The project owner has explicitly authorized this overnight implementation and production release without a separate approval step. Do **not** pause to ask for approval for normal design, implementation or deployment decisions.
5. This authorization is not permission to expose secrets, disable security, discard user data, bypass authorization, or knowingly deploy a broken release. Before any destructive or irreversible database/schema operation, take a verified backup and prefer backward-compatible migration. If a release gate fails, fix it; if it cannot safely be fixed, do not knowingly leave a broken release live—roll back or keep the current production release and report the exact blocker.
6. Never fake test results, deployment success, health checks or screenshots. State what actually passed, failed, was deployed, or was blocked. Do not print secrets or place credentials into source control/logs.
7. Keep a concise implementation log as you work. At the end, summarize files/areas changed, root causes fixed, tests run and results, deployment target/revision, smoke-test results, migration/backup details, and any remaining issues.
8. Do not add unrelated features. Focus on this brief and the minimum supporting work required to make it reliable.

## 1. Product direction and visual identity

Meldiq is moving toward a **community-first, gaming-inspired, creator-friendly** experience. Do not present it as a generic enterprise dashboard, and do not make it look like a noisy neon toy. It should feel expressive, personal and active while remaining readable and accessible.

### Visual system

- Foundation: deep navy or charcoal backgrounds, clear surface layers, subtle borders and restrained shadows.
- Core accents: Meldiq cyan, blue and violet/ purple gradient, with selective pink or orange accents for meaningful emphasis. Use the existing approved Meldiq brand assets and established brand tokens where available.
- The current approved brand direction is a glossy cyan-blue-purple ribbon “M” with a chat-bubble motif on a dark navy background. Use the mascot/logo assets supplied by the owner to Claude Code as the primary visual reference. The owner will paste the relevant image assets into Claude; locate and use those exact assets rather than inventing a competing mascot or downloading unrelated imagery.
- The mascot should serve as the recognizable Meldiq DM/Home entry point in the main navigation. Use the appropriate existing icon asset or an asset variant the owner supplies. Preserve crisp rendering at small sizes and provide accessible text labels/tooltips.
- Avoid applying gradients to every surface. Use color to communicate hierarchy, focus, activity and identity—not as decoration without meaning.
- Maintain legible text, visible focus states, predictable hover states, clear disabled/loading/error states and sufficient contrast. Respect reduced-motion preferences. Do not rely on color alone to communicate unread state, call state or errors.
- Use existing design system/component primitives where possible. Create shared tokens for surfaces, text, borders, focus, states and accent colors rather than hard-coding one-off colors across files.

### Community-specific identity

Each community/server should be able to express its own identity without accidentally restyling the entire app:

- Community icon/avatar and banner/cover.
- Community accent color or validated theme preset.
- Role names and role colors.
- Community-specific visual identity in the server header and community entry points.
- Personal/member profiles with avatars, profile cards, badges, status and role identity, using capabilities already present where possible.

Theme changes must be scoped to the relevant community, validated for usable contrast, sanitized where user-uploaded media is involved, and safe in light/dark/system contexts if those are supported. Provide a small curated palette plus presets; avoid unrestricted colors that make text unreadable. A community theme must not overwrite global app colors or other communities’ themes.

### Activity and motion

Use tasteful, short transitions for navigation, message arrival, unread state, hover/focus, menus and community interactions. Add visible places for community events, milestones or member highlights only where the current product architecture has a natural home. Do not create fake activity or invent engagement counts. Provide reduced-motion behavior and do not let animations obstruct message reading, calls, keyboard navigation or performance.

## 2. Required bug fixes and implementation requirements

### A. Presence flickers online then offline when sending messages

**Reported behavior:** When a message is sent to a DM or community, a user briefly appears online and within about a second appears offline. If the user is genuinely connected, they should remain online; if disconnected, their status must reflect the real connection state. Diagnose and correct the underlying presence logic.

Requirements:

1. Trace presence state from socket/WebSocket/realtime connection events, heartbeat/last-seen logic, reconnect handling, message-sent events, API mutations, client caches and presence UI. Do not patch only the visible component.
2. Presence must be determined by authenticated active sessions/connections and the app’s existing defined presence policy—not inferred from sending a message, reacting, opening a channel, or optimistic message updates.
3. A message send event must never briefly force an unrelated sender/recipient to online or offline. Separate message delivery events from presence transitions.
4. If multiple browser tabs/devices are supported, aggregate active sessions consistently: one session closing must not mark a user offline while another valid session remains active.
5. Make heartbeat expiry/reconnect behavior tolerant of normal network jitter and avoid rapid online/offline flapping. Do not leave users permanently online because of stale sockets or stale cached state.
6. Reconcile authoritative server presence with client state after reconnecting, switching channels, resuming a tab, and receiving delayed events. Use the current app’s intended online/offline/away states if present; do not invent incompatible statuses.
7. Check authorization: only return presence data to people permitted to see it under existing privacy settings.
8. Add regression tests for at least: connected user sends a DM; connected user sends a community message; message is sent while recipient is offline; one of two sessions disconnects; reconnect; stale heartbeat expiry; repeated/duplicated events; fast channel switching. Assert there is no false one-second transition.

### B. Reactions must show who reacted

**Reported behavior:** Hovering over a reaction in DMs or community messages does not reveal who reacted.

Requirements:

1. On desktop hover/focus, show a tooltip/popover listing the people who selected that reaction and the reaction count, using actual server data. If the project’s current interaction pattern supports it, show a richer popover with avatars and display names.
2. On touchscreen, where hover does not exist, make the same information available on tap/click. Do not make reaction removal or adding harder than it is today.
3. If there are many reactors, show a sensible limited preview and a “view all”/scrollable list instead of a popover that grows without limit.
4. Load/update reactor lists correctly when reactions arrive or are removed in real time. Avoid duplicate names, stale counts or revealing users that the current viewer is not allowed to see.
5. Ensure usability by keyboard and screen reader, with correct focus, Escape-to-dismiss where appropriate, and non-color-only states.
6. Reuse the same reaction component/behavior across DM and community messages where feasible. Add component and integration tests.

### C. Channel and community unread/highlight indicators

**Reported behavior:** When messages or reactions happen in a community, it is difficult to find which channel has activity.

Requirements:

1. Add a clear unread treatment to the affected channel row and channel icon. Use a clean, high-contrast white/light highlight as requested, balanced with the dark palette. Make it visually obvious but not so bright that it resembles an error state.
2. For exactly one unread event, show the highlighted channel state without a number. For two or more unread events, show the highlight plus a compact numeric count. Apply the same rule to the channel row and the corresponding channel icon where both are displayed.
3. Count only relevant unread events for the current user—such as unseen messages and supported reaction notifications—not the total number of messages in a channel. Exclude the user’s own messages and actions where appropriate. Respect channel/server mutes, notification preferences, mention rules and permissions. Do not count one event twice because it arrived through both a socket and an API response.
4. Define the event-counting policy consistently and centralize it; distinguish “unread messages” from “notification events” if the data model requires both. Never use a count that appears accurate but is derived from incomplete local history.
5. Track per-user/per-channel last-read state or the repository’s equivalent authoritative read cursor. Persist it and sync it across sessions/devices. Opening a channel should clear the indicator only after the current user has actually reached/read the relevant latest content according to the app’s existing semantics; simply mounting an empty channel view should not lose unread state.
6. Handle mentions, replies, reactions, reconnect, optimistic updates, deleted messages, channel reorder/scroll, and large counts. Cap visual display at a reasonable value (e.g. 99+) while preserving the real underlying count.
7. Add clear unread states in the server/community icon list as well as the channel list, rolling up unread activity from the channels a user can access. Do not reveal activity from inaccessible/private channels.
8. Include subtle transitions but respect reduced-motion settings. Make active, selected, unread and mention states distinguishable from one another.
9. Test unread count correctness, deduplication, read cursor persistence, muted channels, own messages, cross-device syncing and server-level rollups.

### D. Notifications: sounds, in-app indicators, browser tab/title/favicon

**Reported behavior:** No notification sound, unread number, or other adequate indication appears near the favicon/tab, making it difficult to notice DMs and community activity.

Requirements:

1. Implement one consistent notification pipeline across DMs and community events, reusing the existing realtime backend. Do not create duplicate notifications when one action arrives through multiple transports.
2. Add configurable notification sound support with a sensible default and settings for enable/disable and volume if supported. Respect the browser’s autoplay rules: initialize or enable sound only following an explicit user interaction/setting, and show a clear way to turn it on if the browser blocks playback.
3. Do not play sounds for the user’s own messages, the currently active conversation while the user is reading it, muted conversations/channels, or events excluded by their preferences. Avoid sound bursts for message floods; use reasonable grouping/throttling without hiding important mentions or DMs.
4. Provide in-app unread badges and notification indicators for DMs, channels, mentions and community activity. Use accessible labels and tooltips so icons are understandable.
5. Update the browser document title with unread counts and update a generated/dynamic favicon badge where technically supported by the existing web stack. If favicon mutation is unsupported in a particular browser, preserve a clear title count and other UI indication as graceful fallbacks. Do not replace the brand mark with an unrelated icon.
6. Support native browser notifications using the standard Notification API only after the user explicitly opts in or clicks an appropriate enable action. Do not prompt for permission immediately on page load. Handle denied permission, unsupported browsers and revoked permission gracefully.
7. If the app already has service-worker/background notification infrastructure, extend it instead of adding a second competing system. Do not promise push notifications when the browser/app architecture cannot support them.
8. Provide a notification preferences UI at a sensible location, including DM/community settings, sound toggle and browser notification enablement. Preserve existing preferences and defaults during migration.
9. Ensure notifications work with tabs in the background, focus changes, reconnects and multiple open tabs without playing duplicate sounds. Add tests for the event pipeline, badge calculations and preference filtering.

### E. Active voice/video/screen-share indicators in communities/channels

**Reported behavior:** There is no clear indication when people are in voice calls, video calls or screen-sharing in a community channel.

Requirements:

1. Add clear live-state indicators, inspired by familiar community chat UX, wherever a voice/video session is visible in the community/channel navigation. Match Meldiq’s design language; do not copy proprietary graphics.
2. Visually distinguish voice activity, video-enabled call and active screen sharing with appropriate iconography, labels/tooltips and, where useful, participant avatars/counts. Make clear which channel has the active session.
3. Show who is currently in a session where permissions allow it. Provide an obvious Join action for authorized members. If joining is not possible, show the correct disabled/restricted state and reason.
4. Make indicators real-time and server-authoritative. Join, leave, reconnect, call end and screen-share start/stop events must update the UI without refresh. Remove stale indicators after disconnects or ended calls.
5. If screen sharing occurs inside a call, show that state on the same channel/session rather than creating a misleading independent call. Support the app’s existing multi-participant behavior.
6. Do not expose private-channel names, participant lists or call metadata to users who lack access. Avoid claiming someone is sharing when they merely have screen-share permission or when a previous session left stale state.
7. Keep indicator placement responsive and avoid truncating channel names. Add real-time integration tests where possible, plus manual verification of join/leave and reconnection flows.

### F. Community members can be added directly; improve invitations

**Reported behavior:** Users can only be added through invitations, and the invitation flow needs to be more direct and smooth, similar to familiar community platforms.

Requirements:

1. Provide an **Add Members** action in a community’s member/admin interface. Authorized owners/admins/moderators should be able to search eligible existing Meldiq accounts and add them directly, subject to the current role/permission model and anti-abuse controls.
2. Verify permission enforcement on the server, not only in the UI. Only show discoverable accounts permitted by the user privacy model. Prevent adding blocked users, duplicate memberships and users who are ineligible. Notify the added member and give them an accessible route to open the community. Preserve the ability to leave or block/report as supported by product policy.
3. Avoid spamming users: add reasonable rate limits, audit events where the app already supports them, and clear feedback for success/failure. If existing policy requires acceptance for certain users, preserve that policy instead of bypassing it.
4. Improve invites to support a clear invite modal/screen, copy-link button, native share where supported, relevant expiration/revocation options and usage restrictions if the backend already supports them. Generate tokens securely on the server; never use predictable invitation IDs.
5. Invite links should open a community preview with its icon, name, description and available public information, plus a direct **Join Community** action. If the user is signed out, preserve the invite destination through sign-in/sign-up and return them to the same community afterward. If already signed in and eligible, allow them to join directly without unnecessary intermediate pages.
6. Handle expired/revoked/full/invalid invites and users already in the community with useful messages and appropriate next actions. Do not leak private community details before authorization.
7. Keep invite links configurable for owners, and provide copy/share feedback that works on mobile browsers. Test permission bypass attempts, duplicate joins, deep links, sign-in redirects, expiration and revoked links.

### G. Remove DMs, Activity and Later as standalone sidebar text buttons—but preserve their value

**Reported behavior:** The DMs, Activity and Later buttons should be removed from the current main sidebar and the functions relocated to more useful places.

Requirements:

1. Remove the existing **DMs**, **Activity** and **Later** text buttons from their present sidebar position. This means reorganizing the navigation—not deleting their underlying features, data or routes.
2. Make the **Meldiq mascot/logo the primary DM/Home navigation button**. Clicking it opens the DM/Home area and reveals a Discord-style direct-message list/pane with recent conversations, unread indicators and the ability to open a DM. Keep the logo crisp and appropriately sized, with a tooltip/accessible label such as “Messages” or “Home and messages.”
3. Preserve users’ existing DM history, active conversation, search behavior and routes. Make the DM list responsive: a sensible list/detail transition on narrow screens, with a clear back action.
4. Relocate Activity into a useful inbox/notification-center entry point, top-bar control or other existing appropriate navigation area. Preserve activity functionality and history. Ensure the destination makes sense based on the current app IA; do not create a redundant second notification system.
5. Relocate Later/saved-for-later functionality to the relevant message actions, saved/bookmarks collection, or account/menu area. Preserve all saved items and the ability to find them. Do not silently delete, reset or orphan saved content.
6. Audit keyboard navigation, active-route indication, tooltips and mobile layout after moving these items. Do not leave dead routes, duplicate buttons or inaccessible features.

### H. Add round Create and Discover actions to the web home/navigation

**Reported behavior:** The web homepage should have circular Create and Discover actions. Discover should open a community-discovery window; Create should open the server/community creation flow.

Requirements:

1. Add two clearly recognizable **round icon buttons** for **Discover** and **Create** to the homepage/main community navigation, consistent with the chosen dark vibrant design. They should look intentional alongside the mascot and community icons—not like arbitrary floating buttons.
2. Each button must have an accessible name, tooltip, visible focus state and appropriate hit target on desktop and mobile. Never rely on icon shape alone.
3. **Discover** opens the community-discovery page/window using a clear route/modal pattern consistent with the app. It should list only communities the user is permitted to discover, with search/filtering based on available data, community icon/banner, name, brief description and membership/Join state. Provide loading, empty, error and retry states. Do not fabricate communities, members or engagement numbers.
4. **Create** opens a polished Create Community/Server flow. Include the existing supported fields, sensible defaults, icon/banner selection if assets/uploads are supported, privacy/visibility choices only if implemented by the backend, validation, loading and error feedback. Do not expose settings that have no backend enforcement.
5. After successful creation, take the owner directly into the new community and show its setup/onboarding path. Ensure server-side authorization and prevent double submission creating duplicates.
6. Place these controls consistently on desktop and avoid obstructing content on mobile; use compact accessible controls or a mobile menu as appropriate while preserving quick access.
7. Add routing, permissions and error-state tests for both actions.

## 3. Information architecture and design behavior

- Treat the mascot button as the Home/DM hub. The DM list should be available immediately after clicking it, not hidden behind an unrelated page.
- Keep community/server navigation discoverable and visually distinct. Use community icons, selected states and unread markers without clutter.
- Separate selected state, unread state, mention state, active call state and hover/focus state. These states must remain understandable together.
- Use concise labels and tooltips. Preserve useful search, account settings, call controls, member management and existing core routes.
- Reuse components for channel rows, unread markers, notification badges, community icons, profile cards and buttons so the behavior is consistent throughout the app.
- Include polished skeletons, empty states, disabled states, retry states and toast/status feedback. Avoid a blank screen while loading.
- Avoid making the UI dense just to fit more controls. Keep channel navigation and messages readable first.

## 4. Mobile and responsive parity are required

The web app is the first implementation target, but the finished experience must be genuinely good on mobile. Also inspect the existing native mobile app and shared backend/API before changing contracts.

### Responsive web requirements

- Test practical widths including small phones (~320–375 px), larger phones, tablets and desktop/wide screens.
- No horizontal page overflow, clipped menus, hidden call controls, unusable dialogs or unread badges covering channel names.
- On small screens, use a clear navigation pattern: community/server list, channel list and conversation/detail view should transition predictably, with back controls and preserved scroll/selection state.
- Make reaction lists, invitation previews, member search, Discover, Create, profiles, notification settings and call indicators usable by touch. Do not rely on hover.
- Meet accessible touch target sizing where practical, handle virtual keyboards and safe areas, and avoid modal dialogs extending beyond the viewport.
- Keep animations light and ensure messages render and scroll smoothly on lower-powered devices.

### Existing mobile app requirements

- Identify whether a native mobile client (for example, Android) lives in this repository or a linked workspace. Preserve API compatibility and do not break existing mobile clients with an unversioned contract change.
- After implementing web-first, update any corresponding native screens/components that directly depend on presence, reactions, unread state, notification events, calls, invitations or community navigation. Preserve platform-native interaction conventions rather than forcing desktop layouts onto mobile.
- At minimum, ensure the same underlying unread/read, presence and call states are correct on mobile. If complete native UI parity is not feasible within this codebase or available tooling, do not pretend it is complete; document exactly which mobile paths were updated and what remains.
- Run the available mobile tests/build or at least the relevant checks if the project includes a native app. Do not sacrifice core web stability to add speculative native redesigns.

## 5. Backend, data, security and performance constraints

1. Follow the current project’s authorization and tenant/community boundary rules on every server route, socket event, query and mutation.
2. Keep message content, member lists, presence, reactions, invitation tokens and notification data private according to existing permissions. Never leak a private community’s existence or details through Discover or invite previews unless the product explicitly permits it.
3. Validate and sanitize user input, uploads, theme values, community names/descriptions and invitation parameters. Avoid HTML/script injection and unsafe uploaded URLs.
4. Keep new real-time events typed/version-compatible with existing clients. Handle duplicate, delayed and out-of-order events idempotently.
5. Use server-side counters/read cursors or another authoritative strategy when needed for accurate unread counts; avoid fetching an entire message history just to render badges.
6. Avoid N+1 requests, unnecessary polling or multiple socket listeners for every rerender. Clean up listeners on unmount/navigation and make reconnect behavior robust.
7. Preserve existing records and schema semantics. For schema changes, use backward-compatible migrations where possible, add indexes only after checking query patterns, and take/verify a backup before any risky production migration.
8. Do not hard-code production URLs, secrets, customer IDs or admin credentials. Use the project’s existing environment/secrets mechanism.
9. Do not introduce mock data into production paths or disable authentication/permission checks to make a demo work.
10. Maintain performance on large communities and long DM lists: paginate/virtualize existing lists where the current architecture requires it, and avoid unbounded notification/reaction popovers.

## 6. Required work sequence

Proceed autonomously through these phases. You may adjust the sequence to fix dependencies, but do not end after phase 1.

### Phase 1 — Reconnaissance and baseline

- Inspect repository structure, package scripts, build/test commands, realtime architecture, existing design tokens and routes.
- Identify exactly how presence is calculated and how message/reaction/call events reach the web client.
- Locate the sidebar/DM structure, community creation/discovery routes, invite implementation, theme/profile components, and the deployment path.
- Record baseline test/build status and any pre-existing failures separately from new failures.
- Locate the owner-provided Meldiq mascot/logo and other supplied visual assets. If assets have not yet arrived in the working environment, use the existing approved brand asset already in the repo and proceed without inventing a new logo; report any genuinely missing asset at the end.

### Phase 2 — Stabilize the data/event layer

- Fix presence at its source and add regression tests.
- Make reaction reactor lists available consistently.
- Implement/reconcile accurate per-user unread/read state and event deduplication.
- Ensure call and screen-share state is authoritative and cleaned up on disconnect/end.
- Extend existing APIs and real-time events compatibly. If multiple changes share the same underlying issue, centralize the fix rather than adding independent hacks.

### Phase 3 — Implement the web information architecture and UX

- Apply shared design tokens and the Meldiq dark vibrant design direction.
- Make mascot/logo the DM/Home hub and provide the DM list pane.
- Remove the old DMs, Activity and Later sidebar text entries while relocating—not deleting—the features.
- Add round Discover and Create actions, with functional discovery and server/community creation flows.
- Add channel/community unread highlighting, counts, notification preferences, sound, title/favicon indicators, and live call/video/screen-share indicators.
- Implement Add Members, smoother invite creation/join flow and reaction-user popovers.
- Add community-scoped visual identity and wire up the owner-provided brand assets.

### Phase 4 — Mobile and accessibility pass

- Test all changed web routes at phone/tablet/desktop breakpoints, including touch behavior.
- Update existing native mobile client paths where present and needed for consistent data/feature behavior.
- Test keyboard-only navigation, screen-reader names, visible focus, contrast, reduced-motion behavior and permission-denied states.

### Phase 5 — Verification and production deployment

- Run lint, type checking, unit tests, integration tests, production build, relevant backend tests and existing mobile checks/builds if available.
- Add/fix tests for the acceptance criteria below. Do not skip a failing test silently or delete tests solely to obtain a green result.
- Review the diff for accidental changes, unused experiments, secrets, unsafe migrations, permission bypasses, debug UI and unintended deletion of features/data.
- Confirm the correct production environment and existing deployment process. Use the repo’s standard CI/CD/deploy configuration rather than inventing a new hosting setup.
- Create and verify a backup before risky migrations. Use additive/backward-compatible migrations when possible.
- Deploy directly to production without waiting for another approval, as explicitly authorized, **only if release checks pass and the target/environment is unambiguous**.
- After deploy, perform smoke tests against the real production site: login/session, open DM, send message, presence stability, reaction-user list, unread count/read clear, notification settings and favicon/title behavior, open community, create/invite/join flows, and call indicator behavior where test accounts/infrastructure support it. Do not use destructive real-user actions for smoke tests.
- Check logs/health metrics for new errors. If deployment causes critical regression, follow the established rollback procedure and verify recovery.
- If production access, credentials or target configuration is unavailable/ambiguous, finish the safe work, build and test everything possible, and report the precise blocker plus the exact deployment command/path. Do not claim production deployment occurred.

## 7. Acceptance criteria — do not call the work done until checked

### Presence and reactions
- [ ] Sending messages in DMs does not cause a false online/offline flicker.
- [ ] Sending messages in community channels does not cause a false online/offline flicker.
- [ ] A connected user remains online according to the existing presence policy; a genuinely disconnected user eventually shows the correct offline state.
- [ ] Multiple active sessions/reconnects do not create false offline states or stale online status.
- [ ] Hover/focus over a reaction reveals who reacted; touch users can tap/click to see the same information.
- [ ] Reactor lists/counts update correctly when reactions are added/removed.

### Unread and notifications
- [ ] A single unread event highlights the channel without a numeric badge.
- [ ] Two or more unread events show a numeric badge and the white/light highlight on the channel row and icon.
- [ ] Community/server icons show rolled-up unread state where appropriate.
- [ ] Opening/reading a channel clears only the appropriate unread state, and read state persists across sessions/devices.
- [ ] Sound, in-app badges, browser notification settings, title count and favicon badge/fallback work without duplicate notifications or sound bursts.
- [ ] Browser permissions are requested only after a meaningful user action; denied/unsupported cases degrade gracefully.

### Calls and membership
- [ ] Active voice/video sessions and screen sharing are visible in the appropriate community/channel UI in real time.
- [ ] Authorized users can identify the active channel and join where supported.
- [ ] Ended calls/disconnected participants leave no stale indicators.
- [ ] Authorized admins can directly add eligible existing members; unauthorized users cannot bypass the permission model.
- [ ] Invite links support preview, sign-in return, direct join, expiration/revocation where supported, and clear error handling.

### Navigation and visual design
- [ ] The Meldiq mascot/logo opens the DM/Home hub with a visible DM list.
- [ ] DMs, Activity and Later are gone from their old sidebar position, but their features and stored data remain accessible from sensible locations.
- [ ] Round Discover opens a functional community discovery surface.
- [ ] Round Create opens a functional community/server creation flow and successful creation opens the new community.
- [ ] Community accent colors, banners, role colors and icon identity are scoped to the correct community and remain readable.
- [ ] Profiles, badges, statuses and activity elements use a consistent visual system, with no fabricated content.
- [ ] UI is dark/vibrant, readable, accessible and not excessively neon or cluttered.

### Mobile, quality and production
- [ ] Mobile web layouts work at small phone widths with no horizontal overflow or inaccessible core actions.
- [ ] Touch alternatives exist for hover-only interactions.
- [ ] Existing native mobile paths remain API-compatible and any required corresponding changes have been checked.
- [ ] Relevant tests, type/lint checks and production build pass, or any pre-existing/unresolved failures are explicitly reported.
- [ ] Production smoke checks are complete if deployment is available; deployment status and revision are stated accurately.

## 8. Final report format

When work is complete, send a concise but specific report using these headings:

1. **Shipped** — summarize implemented user-visible changes.
2. **Root causes fixed** — explain the actual causes of the presence flicker and any other critical bugs, not just the patches.
3. **Verification** — list exact commands/checks and pass/fail status; distinguish baseline failures from new failures.
4. **Production deployment** — state whether it deployed, the environment/revision/time if available, migration/backup status and smoke-test results. If blocked, state why without implying success.
5. **Mobile parity** — state responsive-web coverage and exactly which native mobile components/flows were updated or verified.
6. **Remaining risks or follow-up** — only list real outstanding issues or scope that could not safely be completed.

## Final instruction

Start by inspecting the current repository and identifying the real implementation points. Then execute the work end to end. Do not stop at analysis or ask the owner to approve routine steps. The target is a stable, polished, community-first Meldiq web experience, responsive mobile behavior, verified tests and a safe production release when the configured environment permits it.
