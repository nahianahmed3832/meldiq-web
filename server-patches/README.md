# Server changes Orbit Web needs

Patches for the Orbit server (github.com/nahianahmed3832/griip-mesage, `server/`), made against `internal-beta` at
f92e59a (API 0.5.0). They live here because they can only be merged into the Orbit repository with the owner's
go-ahead. Apply from the Orbit repository's root, in order:

```bash
git am /path/to/meldiq-web/server-patches/0001-server-websocket-first-frame-auth.patch
```

```bash
git am /path/to/meldiq-web/server-patches/0002-server-web-origins.patch
```

| Patch | What | Needed? | Tests |
|---|---|---|---|
| 0001 | WebSocket authentication by first frame (`{"t":"auth","token"}`, `WS_AUTH_TIMEOUT_MS`), on API 0.5.0's async frame pipeline. Header authentication (Android) unchanged. | **Yes**: browsers can't set an `Authorization` header on a WebSocket, so without it nothing arrives live. | `server/test/ws_frame_auth.test.ts` (7) |
| 0002 | `WEB_ORIGINS`: listed browser origins get CORS answers (no credentials) and may open the WebSocket; others' sockets close with 4403; apps without an Origin are unaffected. Off by default. | Optional: same-origin hosting works without it. Recommended for production as WebSocket origin control, and required for a cross-origin `apiBase`. | `server/test/web_origins.test.ts` (3) |

With both applied: the full server suite passes (409 passed, 10 skipped: the live-S3 suite without credentials and a
MongoDB-only case). The tests in this repository find a patched server through `ORBIT_SERVER_DIR`.

### Core Yapin roadmap continuation (API 0.68.0)

`0005-core-yapin-roadmap.patch` contains backend commits `c840c12` and `2be38ad`, based on `f084e0d`. Apply to that backend baseline with `git am`; it includes the generated API contracts and integration cases. Do not reapply older patches to a backend that already contains them.

This adds optional expression preferences, authenticated attachment streaming, read-only permission previews, private/revisioned community profile overrides, atomic profile/style revisions, and editor-only bot diagnostics. Migrations 078–079 add tables. Existing offer/grant policies are unchanged. The previous runtime can read the migrated copy; its backup verifier intentionally rejects snapshots newer than its own schema, so use the new verifier when checking a migrated snapshot.

`0008-smooth-auth-commerce-api.patch` applies to API `0bcd0a6` (the live PayPal 0.69 source). It includes the deployed 0.70 admin changes, followed by API 0.71.1 authenticator recovery, permanent one-time Spark purchases, separate Bots+ subscriptions and the scheduler startup fix. Migrations 081, 083 and 084 are additive. Runtime source is on `codex/smooth-auth-commerce` in the backend repository at `1b99c5f6`. Read `docs/SMOOTH_AUTH_COMMERCE.md` and preserve current private configuration. Do not apply this patch over another branch's uncommitted server edits; use the committed backend branch or merge it. Live Plus stays at USD 3.99/month; Bots+ is a separate USD 3.99/month community product; each Spark is USD 0.99 once. Production PayPal resources and credentials are not included in this patch.

## Profile customization

`0010-profile-collectibles.patch` applies candidate `70eb0272` over authentication/Atlas/Redis baseline `207c3958`; the cached-index apply check passed. Preserve migration085, apply additive086, and keep the schema5/API0.75 rollout behind the migration chat's all16/schema4 handoff. See `docs/profile-customization/DEPLOYMENT.md` and `deploy/profile-customization` for the authorized release, source provenance, tests and incomplete deployment state.

`0012-call-read-receipts.patch` restores public read markers to main-history and collection pages on SQLite and MongoDB. It is published in the API repository as `0f77a9d8`; the production overlay replaces only the three messaging modules on the current media API image. No schema migration is required.
