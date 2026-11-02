# Environment variable reference

No secret values belong in this document, frontend bundles, Android source/APKs, logs or config.json.

| Variable | Scope | Purpose |
|---|---|---|
| SUPABASE_ENVIRONMENT | server/operator | development/staging/production; current synthetic tooling rejects production |
| SUPABASE_PROJECT_REF | operator | explicit target project; staging bkvlxbsnzqkhbifawcww |
| SUPABASE_EXPECTED_PROJECT_REF | operator | destination guard; never infer environment from a generic pooler host |
| SUPABASE_DATABASE_URL | server/operator secret | bounded trusted PostgreSQL connection; percent-encoded password |
| SUPABASE_DB_CA_FILE | server/operator | official downloaded database CA; certificate and hostname verification remain enabled |
| SUPABASE_DB_PASSWORD | CLI secret if needed | admin migration password; not runtime/client credential |
| SUPABASE_ACCESS_TOKEN | optional CLI secret | Management API/CLI project operations only; unnecessary for direct database migrations |
| SUPABASE_AUTH_URL | current server | existing social identity project; do not replace before provider/account migration |
| SUPABASE_AUTH_PUBLISHABLE_KEY | current server | existing social project's public key; retain current OAuth flow |
| MELDIQ_TEST_PG_URL | local API tests only | runs existing Fastify suites against newly created owned loopback PostgreSQL databases; refuses remote URLs |
| MELDIQ_PG_TEST_URL | local/CI only | loopback synthetic PostgreSQL admin; test harness refuses remote targets |
| MELDIQ_SUPABASE_WEB_ROOT | backend tests | schema/test harness root when checkouts are not adjacent |
| MELDIQ_SERVER_DIR | web operator scripts | isolated compatible backend directory holding pg dependency |
| MIGRATION_SOURCE_MONGODB_URI | synthetic exporter secret | loopback rehearsal database only |
| SUPABASE_URL / publishableKey / projectRef | future public client configuration | public endpoint and sb_publishable_ key only; enabled only with validated migrated auth |

Keep current S3, Redis, LiveKit, FCM, PayPal/Stripe/Play, encryption/report signing, CORS and OAuth callback settings unchanged until their own reviewed staging deployment. Free and Plus remain the only configured plan lineup. Preserve FILE_MAX_BYTES=1024000000 and ATTACHMENT_MAX_BYTES=1025048576 unless a separately approved product policy changes them.

## Private local setup

Run `python3 scripts/supabase/configure-staging.py` in macOS Terminal. Two hidden prompts save only the percent-encoded staging connection URL to `~/.local/share/meldiq-supabase/staging.env` (0600), outside Git. The script never prints the password and never uses shell interpolation. Operator scripts parse this file as data, not by sourcing shell code. Download the project's official CA from Database settings and configure SUPABASE_DB_CA_FILE if required. Never fix certificate errors using sslmode=no-verify, NODE_TLS_REJECT_UNAUTHORIZED=0 or rejectUnauthorized:false.

Migration credentials and runtime credentials must be separate. The runtime login gets the reviewed meldiq_api role, without superuser or bypassrls. Browser/Android get only publishable keys and user sessions. Rotation/revocation procedures must include the affected workers, clients and backup tools.

## Restricted staging runtime

Run `node scripts/supabase/provision-runtime.mjs` once to create `meldiq_staging_runtime` and save its machine-generated password only in `~/.local/share/meldiq-supabase/staging-runtime.env` (0600). Repeat runs verify the saved login without rotating it. The script is pinned to the known staging project, grants only `meldiq_api`, and verifies no RLS bypass, schema creation or Auth-user write privilege. No runtime password belongs in chat or Git.

From the isolated backend server directory, run `./node_modules/.bin/tsx scripts/staging-api-smoke.ts /Users/nahian/.local/share/meldiq-supabase/staging-runtime.env /Volumes/code_files/meldiq_web/docs/testing/supabase-hosted-api-results.json`. This creates synthetic accounts and metadata, uses a loopback API with explicit settings, restarts it, and verifies refresh/logout. It does not start provider, S3 or cleanup jobs. Keep production S3 credentials out of staging: a thin metadata copy must never sweep a production bucket.
