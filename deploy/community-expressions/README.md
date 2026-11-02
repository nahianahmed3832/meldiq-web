# Community expressions and discovery icons — 2 November 2026

Service inbox now lives inside Settings → My Account → Account standing. It retains service announcements, account warnings and appeals, and promotion redemption. The main workspace has no service bar.

Signed-in nonmembers can load public community icons in Discover, matching banner access. Private community icons still require membership, banned users cannot load them, and anonymous requests remain unauthorized. Successful sent/delivered/read ticks appear only in direct messages; pending and failed delivery feedback remains available everywhere.

Reaction writes are serialized per message so fast selections cannot overwrite each other. A visible plus chip adds another reaction, the reaction picker stays open for multiple choices, and selecting an existing reaction still toggles just that emoji. Composer emoji also stay open for repeated insertion.

The expression picker has one search and one scrolling collection: favorites, recent expressions and community groups with compact image tiles, followed by default emoji and built-in expressions. Stickers and animated uploads share their community group; provider GIF results appear within search. Separate GIF/sticker tabs and composer buttons are removed. Original format validation, animation preservation, uploads, skin tones, permissions and synced favorites remain supported.

The production artifact includes the latest member identity and rules-channel releases. Web source is `280b80a7c5c65858b75a5dba0ff19ae93d18be84`; API source is `64fc3f4fc0a096924513d685c61f4e87753d162a`. Commits use MD.NAHIAN AHMED and the owner's verified GitHub noreply address. Web changes are on `nahianahmed3832/meldiq-web` main; the API is on `nahianahmed3832/meldiq` default branch internal-beta.

Deployment overlays only the compiled community routes onto the exact previous API image, acquires the shared production lock, preserves environment, mounts, ports, resource limits, nginx and web configuration, retains old hashed assets, and atomically switches the web release. No data or schema migration is involved. Previous code releases remain available for rollback. Public source maps and test device linking are disabled.

Verification includes 875 local web unit tests (one intentional skip), nine community branding API tests, API compilation, successful GitHub type/lint/format/unit/build CI, desktop and phone browser workflows, and eight preflight plus eight live public Chromium/WebKit checks. Sanitized receipts and validation evidence are beside this file. Private deployment snapshots remain under `/opt/meldiq-web/release-evidence/community-expressions-280b80a7`.
