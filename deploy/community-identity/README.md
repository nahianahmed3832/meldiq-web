# Community identity system — production release

Source build: `687d6eab17e32cf19c71ab05025b678c6c0f5cc1`. Exact Linux/Node22 CI export, build `GNiGfVnYex-W8BzfbyNTw`. Author and committer: MD.NAHIAN AHMED.

- PLUS and GO are explicit wordmarks using the current theme; the verification-style tick and blue rosette were removed.
- Original owner, role, bot, artist, bug-hunter and community emblems share a consistent vector design. BOT labels are shared across names, community settings, messages and previews.
- Active owners lead under Admin by default, or their highest separately displayed custom role. Their group and their position within it lead regardless of role order. Offline owners remain in Offline.
- Installed bots have their own list, including when the channel-member API excludes bot accounts. Community directory access is respected, records are deduplicated, and cached data is scoped to the current account/community. Bot details avoid unsupported human profile/direct-message calls.
- Saving role edits immediately refreshes the directory, so custom owner headings update without waiting for the cache TTL.

Validation: CI type checking, lint, formatting, 882 passing unit tests, 2 skipped cases and Webpack production build. Fifteen focused identity/grouping regressions passed locally. The exact production export passed normal email onboarding, owner ordering, live role rename/hoist changes, bot posting and details, theme changes and a 390px phone layout in Chromium and WebKit. The subscription badge in those disposable local workflows was a response-display fixture; no subscription or entitlement was granted. Live browser checks are signed out and read only; eight desktop/tablet/phone Chromium/WebKit checks passed. Public HTML, service worker and stylesheet hashes match the release.

The source includes the current rules-channel and unified-expression releases. Publication uses both release locks, an expected-predecessor guard, archive/file hashes, an atomic switch with rollback, preserved configuration and old hashed assets. Nginx and the running API are preserved; no account, inventory, membership or payment data is modified on production.

See the production/CI/browser receipts, the adjacent Chromium/WebKit screenshots, and [design rationale and research](../../docs/design/COMMUNITY_IDENTITY.md). Earlier development-test fixture and startup failures were corrected before the final production-export workflows; their local logs were retained.
