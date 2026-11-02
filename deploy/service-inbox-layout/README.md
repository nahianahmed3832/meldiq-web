# Service inbox layout production fix

Published on 2026-11-02 as `0.5.0-beta-service-inbox-layout-90ef729`. The source fix and signed-in browser regression are in commit `90ef729f904c8873b4bb6483bb60c85ff517722c`.

Production was newer than the source baseline: `0.5.0-beta-platform-sync-a5da62bd3b08`. To preserve its changes, the release applies only the equivalent CSS edits to that exact artifact, retains all existing JavaScript, and uses a new immutable stylesheet URL and Next.js build identifier. Rebuilding this checkout alone does not reproduce the newer platform-sync JavaScript.

`prepare.py` verifies the baseline archive digest and each CSS replacement, then creates a five-file overlay and manifest. Run it with a fresh directory containing `production-baseline.tar.gz`. The baseline archive is retained privately in the existing platform-sync evidence directory on the production server.

`publish.py` holds the shared production release lock, verifies the exact current release and baseline hashes, clones that release, applies the overlay, and switches the current symlink atomically. It checks served file hashes, configuration equality, and unchanged API container identity/start time. Failed verification restores the previous release automatically.

`verify.mjs` checks the release identifier, sign-in initialization, and eight layout cases in Chromium and WebKit. The signed-in regression also passed in WebKit, Chromium and the phone project before deployment. Type checking, production compilation, formatting and targeted lint passed.

The committed receipts record the production artifact hashes and public verification results. Server evidence is at `/opt/meldiq-web/release-evidence/service-inbox-layout-90ef729`. The previous production release remains available for rollback.
