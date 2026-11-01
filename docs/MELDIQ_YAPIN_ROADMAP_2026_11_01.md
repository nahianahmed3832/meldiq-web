# Yapin research roadmap continuation — 1 November 2026

Status: verified core implementation, preparing the production artifact; not yet released. This continues web 98828f0 / API 0.67.1. The original research stays unchanged.

## Scope and implementation

- R04: authenticated API attachment streaming (`proxy=1`) avoids a browser following a storage redirect. Membership, expiry, quotas, ranges and private/no-store remain enforced. Old servers retain the nginx fallback. Fake S3 with browser CORS refusal passes all six integration cases, including the new direct API route.
- R06: authorized community expression search across joined communities, paged rendering and visible-image downloads, synced custom-expression favorites and 40 recents. Lists resolve saved IDs against current memberships and locked-asset status; URLs are not stored in preferences. Old preference writers preserve the new optional fields.
- R08–R09: profile drafts include link changes; global profile saves use a content revision and refuse stale edits. Style choices preview with Apply, Undo and Reset and use atomic server revision checks; uploaded media still saves immediately with explicit labels. Community profile controls have their own scope and draft.
- R10: existing lobby, permissions, safety/moderation, official bots, preferences and settings acceptance tests are being exercised against the target API, including SQLite and MongoDB.
- R11: read-only role/member permission preview uses the authoritative server resolver, with community, category and channel steps. Existing permissions govern who may inspect other members. Preview never changes memberships, roles or access.
- R12: consolidated notification overview shows defaults, overrides and pauses; account pause/resume syncs through the existing API. Activity links to it and ignores stale community-log responses. Background direct mentions now follow foreground mute rules, queued duplicate message IDs count once, and account-scoped hashed delivery stamps prevent repeat wake-up alerts. Failed displays remain retryable.
- R13–R14: call verification disclosure explains recording/report behavior; security copy points to the actual call encryption badge and corrects the security-key setup label. Screen-share reception and capability-based capture fixes from the earlier release are retained.
- R15: free browser-local density, line spacing, reduced-motion and contrast controls, alongside existing font size/theme/layout options. Reduced motion also snapshots custom animated expressions and GIFs, since CSS does not stop GIF image playback.
- R16: per-community About me, pronouns and profile theme overrides, with global fallback, privacy projection, revision conflicts, reset and validated text/hex-colour preset import/export. Nicknames remain in the existing community nickname system. No executable themes or arbitrary CSS.
- R17: community-editor-only bot configuration checks and persisted last-50 metadata-only handler outcomes. No message text, account identifiers, raw exceptions or tokens in this history. Existing enable/disable/configure/test flows are retained. Starboard now resolves each reaction at its event timestamp/ID, preventing queued events from reading a later state.

The approved pricing remains Free + Plus $3.99/month, Spark separate, with the immediate 1,024 MB decimal server cap and existing grants preserved. This continuation adds no billing provider, paid product or new charge.

## Exclusions and external checks

R18 bot hosting, advanced activities, paid marketplace and expanded promotion were explicitly deferred in the research. R19 unsafe themes, unbounded animation and forced upsells remain excluded.

Physical iPhone/Android acceptance and a production two-account call remain external checks; browser engine and viewport tests cannot prove hardware behavior. Unsupported browsers still cannot originate a screen capture without a browser-provided capture API. A generic authenticated attachment proxy is implemented and tested; the exact previously reported production file has not been inspected or reproduced.

## Verification and deployment

- Web: 804 unit tests passed, one skipped; TypeScript and ESLint passed.
- API: 187 acceptance checks passed across 11 suites, plus 42 profile/style follow-up checks (some overlap). Both SQLite and MongoDB are exercised.
- Browser: 32 passed and one existing phone-layout skip across Chromium, WebKit and phone-width Chromium. Another eight existing-feature checks passed for lobbies, permissions/previews, posting tools, bots and background notifications. Native-peer screen checks are being run with the installed SDK explicitly selected.
- S3/browser integration: six passed, including authenticated API streaming when storage CORS is unavailable and legacy fallback.
- Backup: `/opt/griip-internal-messaging/backups/pre-0.68.0-yapin`, including verified SQLite/archive, private MongoDB snapshot (72 collections, 44,902 documents), original configuration/source/nginx and rollback image `0.67.1-yapin-rollback`.
- Rehearsal: migrations reach schema 79 with integrity OK and 64 users. The old API runtime starts healthy on the migrated copy and reads the same key counts. Its backup verifier intentionally rejects schema 79 as newer than its own 77; the new verifier passes. MongoDB export was parsed and counted; a MongoDB restore rehearsal was not performed.

Production artifact and post-deployment checks pending.
