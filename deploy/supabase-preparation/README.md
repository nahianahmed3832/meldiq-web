# Web preparation for Supabase migration

This static web release is based on the verified live `e456c93` export. Production keeps its existing API, Atlas authority, login, S3/attachment volume, LiveKit, Redis and public configuration. It does not transfer customer records or enable the Supabase backend. The known already-connected Realtime revocation gap still blocks database cutover.

The new Settings account check is hidden by default. It requires a fresh opt-in staging configuration, the separate Frankfurt project, an approved local/staging hostname and a synthetic `example.test` or `example.invalid` account. A cached staging opt-in is rechecked before use. Production configuration cannot enable this preview. Its SDK bundle is loaded lazily only when the gated card renders.

The check signs into an existing synthetic provider account, uses the protected browser device key and legacy reauthentication to verify exact account ownership, and ends both test sessions. It never adopts a new API bearer, connects Realtime, changes the existing token vault, erases keys or touches pending sends. Each attempt has a unique SDK storage/broadcast namespace with encrypted IndexedDB storage and bounded, redirect-refusing requests. Failure and cancellation clean up the isolated session; unsuccessful cleanup is not reported as a pass.

For a separate staging web origin only, configure `environment: "staging"` and `supabaseMigration` with `mode: "staging-check"`, projectRef `bkvlxbsnzqkhbifawcww`, its matching HTTPS URL and a publishable key. Never put the secret key in browser configuration. The staging server must run the separately reviewed PostgreSQL/Auth bridge and proxy `/v3` as well as `/v1` and `/v2`; its CSP must allow the staging project. No production nginx or CSP expansion is included here.

Local browser validation uses the production export and an isolated local legacy API, with the provider and bridge network responses mocked. It verifies normal email onboarding, a real device signature, original-session continuity, provider cleanup, and hiding the preview after returning to production configuration in Chromium and WebKit at phone width. This does not certify the real hosted UI or physical Android behavior. See validation.json for executed checks and the corrected mock failure.

Publish only this clean candidate's verified static artifact under the shared production release and web locks. Compare the exact expected live release/configuration/API image before switching. Retain old static chunks for active sessions, preserve config.json byte-for-byte, and switch the symlink atomically with rollback on verification failure. No database, API container, S3 object or nginx change is part of this release.

After web verification, prepare the Android compatibility update separately. Real customer migration/final sync and database cutover remain a later approval and acceptance milestone.
