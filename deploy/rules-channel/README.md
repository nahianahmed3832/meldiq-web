# Rules channel — 2 November 2026

Rules is a distinct channel choice with a book icon. It creates a public text channel and registers it using the existing community rules API; only members with permission to edit the community can post. Announcement channels retain their own type and megaphone icon. Rules channels use the book icon in the sidebar, conversation header, channel browser, channel details and channel settings list.

Creation preserves saved rules and the agreement requirement, refuses to replace an existing rules channel, and retains the newly created channel when registration fails so a retry does not create a duplicate. A new channel is read-only while registration is pending. Server Settings → Rules also offers creation when no rules channel is configured.

The static deployment script takes the shared production and web release locks, verifies the expected current release and artifact hashes, preserves runtime configuration and old hashed assets, and switches the release symlink atomically. It verifies served asset hashes and deep links, with automatic code rollback on failure. Nginx and the API are checked for changes. Previous releases are retained.

Live on `https://web.meldiq.app` since 2 November 2026 at 18:27 UTC+8, release `0.5.0-beta-rules-channel-4fd6ed1`. The compiled application source is identical to GitHub main; later commits refine browser fixtures and record verification. Commits use MD.NAHIAN AHMED and the verified GitHub noreply address.

Verification: GitHub CI passed type checking, lint, full formatting checks, 873 unit tests (two intentional environment skips), and the production build. The downloaded production artifact passed both Chromium and WebKit workflows using normal account signup with test device linking disabled. Checks cover separate Rules creation, preserved rules and agreement requirements, a failed save and safe retry, the book icon and Rules label, visibility controls, existing-channel protection, and member posting restrictions. Live security headers, TLS, config caching, deep links, API and realtime checks passed; public index and all served JavaScript/CSS hashes match the artifact. Production config was preserved; API and nginx remained unchanged. The prior release is retained.

`production-receipt.json` and `validation.json` record sanitized evidence. The artifact and private release evidence remain at `/opt/meldiq-web/release-evidence/rules-channel-4fd6ed1`.

Public Chromium and WebKit smoke checks also passed after installation: sign-in loads, test-only device linking is disabled, and no application script errors occur. The existing CSP continues to block Cloudflare analytics injected outside the application. GitHub main CI also passed: https://github.com/nahianahmed3832/meldiq-web/actions/runs/41428867561.
