# Database schema

`supabase/generated/source-catalog.json` is the complete inspected relation catalog at source `dfb010738b323c37f7489cea8ef8491e88f03909`, SQLite schema91 / Mongo schema6. `database.types.ts` is the generated row interface; official Supabase client types are generated from the applied database using the staging script's `types` phase when CLI dependencies are available.

## Versioned migrations

- `20261102000100_release_relations.sql`: 246 relational tables, 2,222 columns, 158 deferrable foreign keys, 162 CHECK expressions, original unique/nonunique indexes and default values. Every relation enables and forces RLS; clients have no direct table access. The backend role is NOLOGIN/NOBYPASSRLS until an operator provisions its separate runtime login.
- `20261102000200_identity_outbox.sql`: seven private operational tables, verified UUID-to-legacy ownership, revocations, counters, import runs/batches, transactional outbox and short-lived Realtime grants. No duplicate profile/message/subscription tables are created.

- `20261102000300_event_read_hardening.sql`: safe parsing for malformed historical payloads and explicit Realtime extension restrictions.
- `20261102000400_native_relations.sql`: 23 native relational tables, typed arrays/configuration JSONB, ownership FKs, unique constraints and indexes.
- `20261102000500_live_auth_sessions.sql`: signed JWTs also require a current unexpired auth.sessions row; provider logout cannot leave API authorization active.

- `20261102000600_administration_relations.sql`: eight additive administration/commerce tables from the compatible 0.76 release. The original applied migrations remain immutable.
- `20261102000700_attachment_cleanup.sql`: deferred cleanup triggers retain S3 deletion/abandoned-upload work even when parent FK cascades remove metadata. Completion and same-transaction metadata replacement do not queue live objects. Four indexes support cleanup and conversation deletion.

Hosted staging has 286 tables (279 application + seven private operational), all RLS/forced RLS with client CRUD denied. Official Supabase types were generated directly through the CLI.

- `20261102000800_privacy_and_favorites.sql`: privacy settings discovered in a lazy Mongo store; built-in favorites and removed-decoration retention are preserved.
- `20261102000900_community_historical_actors.sql`: historical moderator/creator IDs no longer cascade community-owned rules, pins or awards away. Community and award-recipient ownership FKs remain.

- `20261102001000_immutable_audit_and_prices.sql`: preserves the source audit append-only triggers and immutable published financial terms. Source trigger hashes are audited separately.
- `20261102001100_auth_device_binding.sql`: certified-device authorization for provider sessions, atomic legacy mapping/binding, durable local revocation, provider ban/soft-deletion checks, and cascaded mapping cleanup on explicit application account deletion. No passwords, refresh tokens or device private keys are stored in this relation.

- `20261102001200_reliable_backend_broadcast.sql`: narrow backend INSERT columns and an RLS policy on managed Realtime matching live leased outbox records. The worker uses a throwing INSERT rather than the warning-swallowing managed helper. No application table or client CRUD grant is added; protected relation count remains286.

## Domain mapping

| Domain | Existing entities retained |
|---|---|
| Identity/accounts | users, accounts, devices, social identities/flows, sessions, recovery/key backups, passkeys, TOTP, push endpoints/FCM tokens |
| Privacy/social | blocks, relationships, request state, settings and preferences |
| Communities | orgs, org_members, conversation/channel membership, categories, role grants, channel overwrites, onboarding/rules/settings, bans/moderation |
| Messaging | conversations, message_events, control events for edits/replies/reactions/pins/reads, durable delivery and encrypted legacy history |
| Files | attachments, uploads, abandoned uploads and pending deletes; bytes remain S3 |
| Commerce | plans/versions, subscriptions/history, checkout/provider events, payment actions, gifts/redemptions, card/payment ecosystem, sparks |
| Administration | platform admins/passkeys/sessions, platform audit/report cases, feature configuration, telemetry, quota and retention |
| Additional | bots, AI/reader/job configuration, federation and device import state discovered in the actual catalog |

The current audit contains an entity-by-entity ownership/dependency/index matrix. The native catalog now models 24 migrated business stores plus the new Auth device authorization relation (194 typed columns). PostgreSQL staging factories and local API parity are exercised; full customer-data validation and client rollout remain incomplete. Five archival/bookkeeping collections remain preserved rather than reactivated as application data.

## Identifier, time, collation and money rules

Keep all existing internal/text IDs unchanged. Supabase UUIDs live in auth_links; a trigger rejects account/user ownership mismatches and unique constraints prohibit duplicate account ownership. New outbox/run/lease identifiers use UUIDs.

Existing timestamps remain UTC epoch milliseconds to preserve APIs, ordering, historical values and exact checksums. New operational timestamps use timestamptz with UTC sessions. No timezone is guessed during import. Retention runs in the service against the established fields.

ASCII case-insensitive identity/slug uniqueness uses translate expressions, preserving the prior NOCASE semantics rather than switching to locale-sensitive lower/citext. Integer financial values stay bigint; JavaScript refuses unsafe integer reads. No money is converted through floating point. Binary fields stay bytea. Payload/settings strings remain exact for compatibility; a future normalized refactor needs independent parity tests.

The first local schema applied successfully to PostgreSQL17. This proves SQL/constraint compatibility, not correctness against every production record. Production import must first reconcile all foreign references, legacy checks and native fields against a frozen source.
