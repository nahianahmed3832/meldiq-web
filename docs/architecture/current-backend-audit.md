# Current backend audit — November 2, 2026

Status: source audit and a fresh read-only production inventory; no production mutation or export of customer content.

## Evidence and scope

The initial running Hostinger API was observed as `0.75.1-provider-profile-695f80b1`, healthy. The isolated implementation worktree `/Volumes/code_files/meldiq_supabase_migration` originally started at exact commit `695f80b1361f85ccb2a9806a3024a14227a48754`. The heavily modified root Android checkout is not the deployment baseline. Web root contains pre-existing uncommitted work, which is preserved.

`live-inventory-20261102.json` was collected at `2026-11-02T03:08:16.189Z` through one read-only Atlas connection inside the running API: dbStats, collection names, estimated counts and index definitions. This is a moving inventory, not a consistent backup or reconciliation. It contains no documents, credentials, tokens, emails or message contents.

## Persistent stores and owners

| Store | Actual responsibility | Readers/writers | Target |
|---|---|---|---|
| MongoDB Atlas, meldiq | All 16 application domains; schema version 6 | Fastify and its workers/operator tools | Supabase PostgreSQL; Atlas retained read-only after cutover |
| Server SQLite | Inactive historical business data; compatibility schema in memory | Existing hybrid dev/test stores; no active production business authority per runtime mode | Do not import stale rows over Atlas; retain backups |
| Android Room/SQLCipher | Device cache, legacy history, unsent outbox and held controls | Android repositories | Retain secure local/offline work until server acknowledgments |
| Web IndexedDB orbit-web | Sealed tokens/device keys, snapshot and legacy import | Web token vault/sync engine | Retain device security state; never copy plaintext secrets to Postgres |
| CacheStorage/localStorage/sessionStorage | Shell, bounded media, appearance/navigation/checkout drafts | Web UI/service worker | Disposable cache/device preferences |
| Redis | TTL caching, distributed admission, Pub/Sub, coordination/presence | Fastify RedisInfrastructure | Keep ephemeral roles; no business authority |
| AWS S3 | Attachment/profile binary objects | Server-authorized signed URLs, multipart and cleanup workers | Keep buckets/keys/bytes/lifecycle unchanged |
| ntfy service SQLite | Third-party auth/wakeup state | ntfy itself | Keep service internals; not Meldiq business data |
| Separate federation-core SQLite | Optional, not the main deployed API | Standalone registry | Port before enabling; no completeness claim |
| Test/old worktree databases | Synthetic fixtures or historical snapshots | Tests/rehearsals | Never merge blindly into production |

## Actual database footprint

Fresh Atlas observation: **264 collections**, **689,608 documents**, **112,183,794 logical data bytes**, **39,677,952 allocated compressed collection bytes**, **62,595,072 index bytes**. Average logical document size is approximately 162.7 bytes; this average hides large-history and telemetry distributions. Historical control-plane evidence identifies the cluster as Free with a 512 MiB limit; the later signed-in Atlas Console confirmed Free tier and a 512 MB display quota (see resume inventory below). Data and indexes are different measures; neither includes S3 objects, device-only pending history, retained backups or other services. Do not present their sum as a billing measurement without the provider definition.

This run did not measure Atlas query latency or OPS time series (a point OPS observation appears below), user concurrency, S3 egress, device DB sizes, disk expansion into Postgres, or current paid invoices. They remain explicitly unknown. Existing historical audit/backup receipts in `docs/database-migration` are context, not fresh results.

## Authentication and behavior dependencies

Fastify currently owns email/password, verification, refresh rotation, password reset, TOTP, passkeys, account deletion and device-key proof. Passwords are `scrypt$logN$r$p$salt$hash`, NFKC-normalized, r=8/p=3 with per-password salt. Social Google/Discord use Supabase identity verification followed by existing opaque Meldiq sessions. Apple configuration is unavailable. Matching emails never prove identity. Account ID, messaging user ID and Supabase UUID are separate identifiers. Platform admin passkey sessions remain separate from community roles.

Messages are now server-readable event records (`message_events`), not exclusively encrypted relay envelopes. Payload JSON is the released event contract. Edits/reactions/deletes/reads are control events. Historical encrypted history, reports and device material still exist. Migration must preserve both, without changing privacy promises or silently rewriting old ciphertext.

Realtime is currently `/v1/ws` with first-frame authentication, serialized frame handling, heartbeat, jittered reconnect and durable delivery acknowledgments. LiveKit handles calls/screenshare and must remain independent. FCM/Web Push/ntfy wake devices; APNs native delivery requires inspection of the separate iOS client and credentials, not an assumed implementation.

## File policy

Fresh runtime configuration: `FILE_MAX_BYTES=1024000000`, `ATTACHMENT_MAX_BYTES=1025048576`. This is the product's configured “1 GB” cap: **1,024,000,000 plaintext bytes**, with 1 MiB encrypted headroom. Preserve these exact values. File metadata currently uses IDs/ownership/conversation/size/expiry; S3 keys are derived in the storage service, not guessed from a new database ID. Multipart, completion verification, membership-protected downloads and abandoned/deletion queues are in existing files/storage modules. MIME/file display information may live in message payloads; do not invent authoritative metadata during conversion.

## Contracts, security and performance

The complete released HTTP contracts are in the source `docs/api/openapi.json`; web fixtures are in `test/contract-fixtures/routes.json`. New Supabase work retains `/v1`, `/v2` and `/admin/v1` as the compatibility boundary. Sources inspected include accounts, auth, workspace Authz, server messages, file stores, S3, billing/PayPal, Redis, worker setup, Android account/API/Room/vault, web sync/realtime/session modules, admin API client, deployment and CI.

Synchronous MongoRows loads whole domains into memory and enforces one API writer. Native Mongo stores and DocumentStore collections bypass the row adapter. Converting only MongoRows cannot complete migration. Telemetry is large and retention-bound. Message pagination requires `(server_ts,id)` ordering; NOCASE fields use ASCII folding; native BSON binary and compound identifiers need explicit conversion. Financial minor units must remain integral. A successful compiler run does not demonstrate feature parity.

The complete entity ownership matrix below records each SQL-shaped entity, current Atlas estimated count, destination, dependencies, and constraints. Every row is owned by the domain named; Fastify is the production reader/writer. Secondary SQL copies are stale unless independently proven otherwise. Migration is frozen-snapshot, typed, batched and fail-closed on discrepancies. Generated table definitions retain exact columns, checks/indexes/FKs. Native-only collections are listed afterward. The later native migration explicitly models23 business collections; full repository conversion and live-data validation still block cutover.

## Entity ownership matrix

| Entity | Owner/domain | Atlas estimated rows | Destination | Dependencies | Indexes/checks |
|---|---|---:|---|---|---|
| `abandoned_uploads` | files | 0 | `meldiq.abandoned_uploads` | none declared | 0 indexes / 0 checks |
| `account_codes` | accounts | 0 | `meldiq.account_codes` | accounts | 1 indexes / 1 checks |
| `account_email_changes` | safety | 0 | `meldiq.account_email_changes` | none declared | 0 indexes / 0 checks |
| `account_key_backups` | accounts | 14 | `meldiq.account_key_backups` | accounts | 0 indexes / 0 checks |
| `account_key_unlocks` | accounts | 0 | `meldiq.account_key_unlocks` | accounts | 1 indexes / 0 checks |
| `account_passkey_challenges` | safety | 7 | `meldiq.account_passkey_challenges` | none declared | 1 indexes / 1 checks |
| `account_passkeys` | safety | 1 | `meldiq.account_passkeys` | none declared | 1 indexes / 0 checks |
| `account_recovery_codes` | accounts | 0 | `meldiq.account_recovery_codes` | accounts | 2 indexes / 0 checks |
| `account_recovery_tickets` | accounts | 0 | `meldiq.account_recovery_tickets` | accounts | 1 indexes / 0 checks |
| `account_session_factors` | accounts | 0 | `meldiq.account_session_factors` | account_sessions, accounts | 1 indexes / 0 checks |
| `account_sessions` | accounts | 67 | `meldiq.account_sessions` | accounts, devices | 5 indexes / 0 checks |
| `account_social_flows` | accounts | 0 | `meldiq.account_social_flows` | none declared | 1 indexes / 0 checks |
| `account_social_identities` | accounts | 0 | `meldiq.account_social_identities` | none declared | 2 indexes / 1 checks |
| `account_totp` | safety | 1 | `meldiq.account_totp` | none declared | 0 indexes / 0 checks |
| `account_totp_backup` | safety | 10 | `meldiq.account_totp_backup` | none declared | 2 indexes / 0 checks |
| `account_warnings` | safety | 0 | `meldiq.account_warnings` | users | 1 indexes / 0 checks |
| `accounts` | accounts | 26 | `meldiq.accounts` | users | 2 indexes / 0 checks |
| `activity_daily` | platform | 99 | `meldiq.activity_daily` | none declared | 2 indexes / 0 checks |
| `ai_agent_channels` | platform | 1 | `meldiq.ai_agent_channels` | none declared | 1 indexes / 1 checks |
| `ai_agent_identities` | platform | 1 | `meldiq.ai_agent_identities` | none declared | 1 indexes / 0 checks |
| `ai_agent_installs` | platform | 16 | `meldiq.ai_agent_installs` | none declared | 2 indexes / 3 checks |
| `ai_agent_templates` | platform | 21 | `meldiq.ai_agent_templates` | none declared | 0 indexes / 2 checks |
| `ai_approvals` | platform | 0 | `meldiq.ai_approvals` | none declared | 2 indexes / 1 checks |
| `ai_channel_context` | platform | 0 | `meldiq.ai_channel_context` | none declared | 1 indexes / 0 checks |
| `ai_channel_posts` | platform | 6 | `meldiq.ai_channel_posts` | none declared | 2 indexes / 1 checks |
| `ai_channel_readers` | platform | 0 | `meldiq.ai_channel_readers` | none declared | 3 indexes / 2 checks |
| `ai_files` | platform | 0 | `meldiq.ai_files` | none declared | 4 indexes / 2 checks |
| `ai_job_events` | platform | 49 | `meldiq.ai_job_events` | none declared | 1 indexes / 0 checks |
| `ai_jobs` | platform | 8 | `meldiq.ai_jobs` | none declared | 6 indexes / 1 checks |
| `ai_model_capabilities` | platform | 8 | `meldiq.ai_model_capabilities` | none declared | 0 indexes / 1 checks |
| `ai_models` | platform | 6 | `meldiq.ai_models` | ai_providers | 0 indexes / 0 checks |
| `ai_org_entitlements` | platform | 0 | `meldiq.ai_org_entitlements` | none declared | 0 indexes / 0 checks |
| `ai_providers` | platform | 2 | `meldiq.ai_providers` | none declared | 1 indexes / 1 checks |
| `ai_reader_choices` | platform | 0 | `meldiq.ai_reader_choices` | none declared | 0 indexes / 1 checks |
| `ai_reader_events` | platform | 0 | `meldiq.ai_reader_events` | none declared | 1 indexes / 0 checks |
| `ai_routing` | platform | 7 | `meldiq.ai_routing` | none declared | 0 indexes / 1 checks |
| `ai_shared_messages` | platform | 0 | `meldiq.ai_shared_messages` | none declared | 1 indexes / 0 checks |
| `ai_system_checks` | platform | 13 | `meldiq.ai_system_checks` | none declared | 1 indexes / 1 checks |
| `ai_task_events` | platform | 0 | `meldiq.ai_task_events` | none declared | 1 indexes / 0 checks |
| `ai_task_settings` | platform | 1 | `meldiq.ai_task_settings` | none declared | 0 indexes / 0 checks |
| `ai_tasks` | platform | 0 | `meldiq.ai_tasks` | none declared | 3 indexes / 2 checks |
| `ai_tool_policies` | platform | 0 | `meldiq.ai_tool_policies` | none declared | 0 indexes / 1 checks |
| `ai_triggers` | platform | 0 | `meldiq.ai_triggers` | none declared | 3 indexes / 1 checks |
| `ai_usage` | platform | 29 | `meldiq.ai_usage` | none declared | 4 indexes / 2 checks |
| `alert_deliveries` | platform | 9 | `meldiq.alert_deliveries` | none declared | 1 indexes / 1 checks |
| `alert_rules` | platform | 0 | `meldiq.alert_rules` | none declared | 0 indexes / 1 checks |
| `alert_state` | platform | 15 | `meldiq.alert_state` | none declared | 0 indexes / 0 checks |
| `analytics_daily` | workspace | 0 | `meldiq.analytics_daily` | none declared | 0 indexes / 0 checks |
| `api_keys` | workspace | 0 | `meldiq.api_keys` | orgs | 1 indexes / 0 checks |
| `attachment_uploads` | files | 1 | `meldiq.attachment_uploads` | conversations, users | 2 indexes / 0 checks |
| `attachments` | files | 474 | `meldiq.attachments` | conversations | 3 indexes / 0 checks |
| `audit_log` | workspace | 1280 | `meldiq.audit_log` | none declared | 3 indexes / 0 checks |
| `auth_challenges` | ephemeral | 0 | `meldiq.auth_challenges` | none declared | 0 indexes / 0 checks |
| `billing_card_charge_attempts` | billing | 0 | `meldiq.billing_card_charge_attempts` | none declared | 1 indexes / 0 checks |
| `billing_card_charges` | billing | 0 | `meldiq.billing_card_charges` | none declared | 2 indexes / 1 checks |
| `billing_card_mandates` | billing | 0 | `meldiq.billing_card_mandates` | none declared | 2 indexes / 1 checks |
| `billing_card_setups` | billing | 0 | `meldiq.billing_card_setups` | none declared | 2 indexes / 0 checks |
| `billing_checkouts` | billing | 6 | `meldiq.billing_checkouts` | billing_plan_versions | 4 indexes / 4 checks |
| `billing_commerce_orders` | billing | 0 | `meldiq.billing_commerce_orders` | none declared | 2 indexes / 1 checks |
| `billing_coupon_uses` | billing | 0 | `meldiq.billing_coupon_uses` | none declared | 2 indexes / 0 checks |
| `billing_coupons` | billing | 0 | `meldiq.billing_coupons` | none declared | 1 indexes / 2 checks |
| `billing_customers` | billing | 0 | `meldiq.billing_customers` | none declared | 2 indexes / 1 checks |
| `billing_grant_notes` | billing | 11 | `meldiq.billing_grant_notes` | none declared | 0 indexes / 0 checks |
| `billing_grants` | billing | 18 | `meldiq.billing_grants` | none declared | 4 indexes / 2 checks |
| `billing_invoices` | billing | 0 | `meldiq.billing_invoices` | none declared | 4 indexes / 6 checks |
| `billing_notification_jobs` | billing | 0 | `meldiq.billing_notification_jobs` | none declared | 2 indexes / 0 checks |
| `billing_payment_actions` | billing | 0 | `meldiq.billing_payment_actions` | none declared | 2 indexes / 0 checks |
| `billing_payment_methods` | billing | 0 | `meldiq.billing_payment_methods` | none declared | 1 indexes / 0 checks |
| `billing_plan_versions` | billing | 2 | `meldiq.billing_plan_versions` | billing_plans | 3 indexes / 4 checks |
| `billing_plans` | billing | 2 | `meldiq.billing_plans` | none declared | 1 indexes / 2 checks |
| `billing_play_purchases` | billing | 0 | `meldiq.billing_play_purchases` | none declared | 3 indexes / 3 checks |
| `billing_program` | billing | 0 | `meldiq.billing_program` | none declared | 0 indexes / 7 checks |
| `billing_provider_events` | billing | 8 | `meldiq.billing_provider_events` | none declared | 3 indexes / 1 checks |
| `billing_referral_codes` | billing | 12 | `meldiq.billing_referral_codes` | none declared | 1 indexes / 0 checks |
| `billing_referrals` | billing | 0 | `meldiq.billing_referrals` | none declared | 2 indexes / 1 checks |
| `billing_subscription_history` | billing | 12 | `meldiq.billing_subscription_history` | none declared | 2 indexes / 0 checks |
| `billing_subscriptions` | billing | 6 | `meldiq.billing_subscriptions` | billing_plan_versions | 6 indexes / 4 checks |
| `billing_webhook_rejections` | billing | 0 | `meldiq.billing_webhook_rejections` | none declared | 0 indexes / 0 checks |
| `bot_afk` | workspace | 0 | `meldiq.bot_afk` | orgs | 1 indexes / 0 checks |
| `bot_alert_watches` | workspace | 0 | `meldiq.bot_alert_watches` | conversations, orgs | 2 indexes / 0 checks |
| `bot_giveaways` | workspace | 0 | `meldiq.bot_giveaways` | conversations, orgs | 3 indexes / 0 checks |
| `bot_levels` | workspace | 4 | `meldiq.bot_levels` | orgs | 2 indexes / 0 checks |
| `bot_listings` | workspace | 0 | `meldiq.bot_listings` | none declared | 1 indexes / 2 checks |
| `bot_runtime_events` | workspace | 79 | `meldiq.bot_runtime_events` | orgs | 1 indexes / 1 checks |
| `bot_starboard` | workspace | 0 | `meldiq.bot_starboard` | conversations, orgs | 1 indexes / 0 checks |
| `bot_wordy_games` | workspace | 1 | `meldiq.bot_wordy_games` | orgs | 2 indexes / 1 checks |
| `bot_wordy_recaps` | workspace | 3 | `meldiq.bot_wordy_recaps` | orgs | 0 indexes / 0 checks |
| `bot_wordy_stats` | workspace | 0 | `meldiq.bot_wordy_stats` | orgs | 2 indexes / 0 checks |
| `branch_members` | workspace | 0 | `meldiq.branch_members` | branches, users | 1 indexes / 1 checks |
| `branches` | workspace | 0 | `meldiq.branches` | orgs | 1 indexes / 0 checks |
| `bug_reports` | safety | 0 | `meldiq.bug_reports` | users | 2 indexes / 1 checks |
| `call_hands` | calls | 0 | `meldiq.call_hands` | calls, users | 0 indexes / 0 checks |
| `call_participants` | calls | 237 | `meldiq.call_participants` | calls | 0 indexes / 0 checks |
| `calls` | calls | 139 | `meldiq.calls` | conversations, users | 2 indexes / 1 checks |
| `channel_categories` | workspace | 40 | `meldiq.channel_categories` | orgs | 1 indexes / 0 checks |
| `channel_options` | workspace | 0 | `meldiq.channel_options` | conversations | 1 indexes / 4 checks |
| `channel_overwrites` | workspace | 2 | `meldiq.channel_overwrites` | orgs | 1 indexes / 1 checks |
| `channel_webhooks` | workspace | 0 | `meldiq.channel_webhooks` | conversations, orgs | 3 indexes / 0 checks |
| `community_discovery` | workspace | 1 | `meldiq.community_discovery` | orgs | 0 indexes / 2 checks |
| `community_expressions` | workspace | 24 | `meldiq.community_expressions` | orgs | 1 indexes / 1 checks |
| `community_lobbies` | workspace | 0 | `meldiq.community_lobbies` | orgs | 0 indexes / 0 checks |
| `community_lobby_feeds` | workspace | 1 | `meldiq.community_lobby_feeds` | orgs | 1 indexes / 0 checks |
| `community_lobby_posts` | workspace | 0 | `meldiq.community_lobby_posts` | orgs | 1 indexes / 0 checks |
| `community_lobby_seen` | workspace | 14 | `meldiq.community_lobby_seen` | orgs | 1 indexes / 0 checks |
| `community_member_defaults` | workspace | 0 | `meldiq.community_member_defaults` | orgs | 0 indexes / 0 checks |
| `community_migration_runs` | workspace | 1 | `meldiq.community_migration_runs` | none declared | 0 indexes / 1 checks |
| `community_onboarding` | workspace | 0 | `meldiq.community_onboarding` | orgs | 0 indexes / 0 checks |
| `community_profiles` | workspace | 0 | `meldiq.community_profiles` | org_members | 0 indexes / 0 checks |
| `community_safety` | workspace | 1 | `meldiq.community_safety` | none declared | 0 indexes / 4 checks |
| `community_settings` | workspace | 2 | `meldiq.community_settings` | orgs | 0 indexes / 0 checks |
| `community_standard_invites` | workspace | 3 | `meldiq.community_standard_invites` | invitations, orgs | 1 indexes / 0 checks |
| `community_templates` | workspace | 1 | `meldiq.community_templates` | orgs | 2 indexes / 0 checks |
| `community_tickets` | workspace | 2 | `meldiq.community_tickets` | orgs | 0 indexes / 2 checks |
| `community_vanity_invites` | workspace | 2 | `meldiq.community_vanity_invites` | invitations, orgs | 1 indexes / 0 checks |
| `community_voice_bans` | workspace | 0 | `meldiq.community_voice_bans` | none declared | 1 indexes / 0 checks |
| `community_voice_mutes` | workspace | 0 | `meldiq.community_voice_mutes` | none declared | 1 indexes / 0 checks |
| `connections` | relationships | 8 | `meldiq.connections` | none declared | 2 indexes / 1 checks |
| `conversation_members` | conversations | 1172 | `meldiq.conversation_members` | conversations, users | 1 indexes / 1 checks |
| `conversations` | conversations | 194 | `meldiq.conversations` | channel_categories, orgs, users | 3 indexes / 4 checks |
| `delivery_queue` | relay | 41913 | `meldiq.delivery_queue` | none declared | 3 indexes / 1 checks |
| `departments` | workspace | 0 | `meldiq.departments` | branches, orgs | 1 indexes / 0 checks |
| `devices` | identity | 123 | `meldiq.devices` | users | 2 indexes / 0 checks |
| `discord_connections` | workspace | 1 | `meldiq.discord_connections` | users | 1 indexes / 0 checks |
| `discord_import_items` | workspace | 271 | `meldiq.discord_import_items` | discord_imports | 0 indexes / 0 checks |
| `discord_imports` | workspace | 5 | `meldiq.discord_imports` | orgs, users | 1 indexes / 0 checks |
| `discord_oauth_states` | ephemeral | 0 | `meldiq.discord_oauth_states` | users | 1 indexes / 0 checks |
| `discovery_boosts` | workspace | 0 | `meldiq.discovery_boosts` | orgs | 2 indexes / 3 checks |
| `discovery_clicks` | workspace | 0 | `meldiq.discovery_clicks` | orgs | 1 indexes / 0 checks |
| `discovery_visits` | workspace | 6 | `meldiq.discovery_visits` | none declared | 1 indexes / 0 checks |
| `dm_requests` | relationships | 0 | `meldiq.dm_requests` | none declared | 2 indexes / 1 checks |
| `document_comments` | workspace | 0 | `meldiq.document_comments` | documents | 1 indexes / 0 checks |
| `document_members` | workspace | 0 | `meldiq.document_members` | documents, users | 1 indexes / 1 checks |
| `document_versions` | workspace | 0 | `meldiq.document_versions` | documents | 1 indexes / 0 checks |
| `documents` | workspace | 0 | `meldiq.documents` | conversations, orgs | 2 indexes / 2 checks |
| `fcm_tokens` | identity | 10 | `meldiq.fcm_tokens` | devices | 1 indexes / 0 checks |
| `federation_blocks` | federation | 0 | `meldiq.federation_blocks` | none declared | 0 indexes / 0 checks |
| `federation_domains` | federation | 0 | `meldiq.federation_domains` | none declared | 0 indexes / 0 checks |
| `federation_inbox` | federation | 0 | `meldiq.federation_inbox` | none declared | 1 indexes / 0 checks |
| `federation_nonces` | ephemeral | 0 | `meldiq.federation_nonces` | none declared | 0 indexes / 0 checks |
| `federation_outbox` | federation | 0 | `meldiq.federation_outbox` | none declared | 3 indexes / 1 checks |
| `federation_peers` | federation | 0 | `meldiq.federation_peers` | none declared | 0 indexes / 0 checks |
| `history_accounts` | history | 13 | `meldiq.history_accounts` | users | 0 indexes / 0 checks |
| `history_items` | history | 3135 | `meldiq.history_items` | users | 3 indexes / 0 checks |
| `inbox_accounts` | workspace | 0 | `meldiq.inbox_accounts` | orgs | 2 indexes / 0 checks |
| `inbox_contacts` | workspace | 0 | `meldiq.inbox_contacts` | inbox_accounts, orgs | 1 indexes / 0 checks |
| `inbox_conversations` | workspace | 0 | `meldiq.inbox_conversations` | inbox_accounts, inbox_contacts, orgs | 2 indexes / 0 checks |
| `inbox_events` | workspace | 0 | `meldiq.inbox_events` | none declared | 1 indexes / 0 checks |
| `inbox_messages` | workspace | 0 | `meldiq.inbox_messages` | inbox_conversations | 3 indexes / 0 checks |
| `inbox_queues` | workspace | 0 | `meldiq.inbox_queues` | orgs | 1 indexes / 0 checks |
| `inbox_settings` | workspace | 0 | `meldiq.inbox_settings` | orgs | 0 indexes / 0 checks |
| `integration_accounts` | integrations | not present | `meldiq.integration_accounts` | none declared | 3 indexes / 0 checks |
| `integration_channel_events` | integrations | not present | `meldiq.integration_channel_events` | none declared | 3 indexes / 0 checks |
| `integration_credentials` | integrations | not present | `meldiq.integration_credentials` | none declared | 0 indexes / 0 checks |
| `integration_deliveries` | integrations | not present | `meldiq.integration_deliveries` | none declared | 1 indexes / 0 checks |
| `integration_hooks` | integrations | not present | `meldiq.integration_hooks` | none declared | 1 indexes / 0 checks |
| `integration_installs` | integrations | not present | `meldiq.integration_installs` | none declared | 1 indexes / 0 checks |
| `integration_jobs` | integrations | not present | `meldiq.integration_jobs` | none declared | 2 indexes / 0 checks |
| `integration_oauth_states` | integrations | not present | `meldiq.integration_oauth_states` | none declared | 2 indexes / 0 checks |
| `integration_policies` | integrations | not present | `meldiq.integration_policies` | none declared | 0 indexes / 0 checks |
| `integration_subscriptions` | integrations | not present | `meldiq.integration_subscriptions` | none declared | 2 indexes / 0 checks |
| `invitations` | workspace | 33 | `meldiq.invitations` | branches, org_roles, orgs, teams, users | 2 indexes / 1 checks |
| `join_applications` | workspace | 0 | `meldiq.join_applications` | orgs | 2 indexes / 1 checks |
| `legacy_tickets` | accounts | 0 | `meldiq.legacy_tickets` | accounts, users | 1 indexes / 0 checks |
| `loadtest_registrations` | identity | 1 | `meldiq.loadtest_registrations` | none declared | 1 indexes / 0 checks |
| `meeting_participants` | workspace | 0 | `meldiq.meeting_participants` | meetings, users | 1 indexes / 1 checks |
| `meetings` | workspace | 1 | `meldiq.meetings` | conversations, orgs | 2 indexes / 0 checks |
| `mention_all_events` | conversations | 3 | `meldiq.mention_all_events` | none declared | 1 indexes / 0 checks |
| `message_events` | history | 2903 | `meldiq.message_events` | none declared | 4 indexes / 2 checks |
| `messaging_settings` | relationships | 1 | `meldiq.messaging_settings` | none declared | 0 indexes / 2 checks |
| `mojo_controls` | billing | 0 | `meldiq.mojo_controls` | none declared | 0 indexes / 2 checks |
| `mojo_gift_credits` | billing | 0 | `meldiq.mojo_gift_credits` | none declared | 1 indexes / 0 checks |
| `mojo_gift_deliveries` | billing | 0 | `meldiq.mojo_gift_deliveries` | none declared | 2 indexes / 1 checks |
| `mojo_gifts` | billing | 0 | `meldiq.mojo_gifts` | none declared | 7 indexes / 4 checks |
| `mojo_profile` | billing | 0 | `meldiq.mojo_profile` | none declared | 0 indexes / 1 checks |
| `nav_preferences` | preferences | 9 | `meldiq.nav_preferences` | users | 1 indexes / 0 checks |
| `official_bots` | workspace | 16 | `meldiq.official_bots` | orgs | 1 indexes / 1 checks |
| `official_bots_plus` | workspace | 0 | `meldiq.official_bots_plus` | orgs | 0 indexes / 0 checks |
| `onboarding_answers` | workspace | 0 | `meldiq.onboarding_answers` | orgs | 0 indexes / 0 checks |
| `onboarding_completions` | workspace | 0 | `meldiq.onboarding_completions` | orgs | 1 indexes / 0 checks |
| `operator_accounts` | platform | 1 | `meldiq.operator_accounts` | none declared | 1 indexes / 3 checks |
| `org_bans` | workspace | 0 | `meldiq.org_bans` | orgs, users | 0 indexes / 0 checks |
| `org_deletions` | workspace | 9 | `meldiq.org_deletions` | none declared | 0 indexes / 0 checks |
| `org_entitlements` | workspace | 0 | `meldiq.org_entitlements` | orgs | 0 indexes / 0 checks |
| `org_members` | workspace | 45 | `meldiq.org_members` | orgs, users | 1 indexes / 1 checks |
| `org_nicknames` | workspace | 0 | `meldiq.org_nicknames` | org_members | 0 indexes / 0 checks |
| `org_role_extras` | workspace | 1 | `meldiq.org_role_extras` | org_roles | 1 indexes / 3 checks |
| `org_role_members` | workspace | 30 | `meldiq.org_role_members` | org_members, org_roles | 1 indexes / 0 checks |
| `org_roles` | workspace | 30 | `meldiq.org_roles` | orgs | 1 indexes / 0 checks |
| `orgs` | workspace | 12 | `meldiq.orgs` | users | 4 indexes / 3 checks |
| `pairing_requests` | ephemeral | 0 | `meldiq.pairing_requests` | none declared | 1 indexes / 0 checks |
| `pending_blob_deletes` | files | 0 | `meldiq.pending_blob_deletes` | none declared | 0 indexes / 1 checks |
| `platform_admin_challenges` | ephemeral | 0 | `meldiq.platform_admin_challenges` | none declared | 1 indexes / 1 checks |
| `platform_admin_enrolments` | ephemeral | 0 | `meldiq.platform_admin_enrolments` | none declared | 0 indexes / 0 checks |
| `platform_admin_passkeys` | platform | 1 | `meldiq.platform_admin_passkeys` | none declared | 1 indexes / 0 checks |
| `platform_admin_sessions` | ephemeral | 5 | `meldiq.platform_admin_sessions` | none declared | 3 indexes / 0 checks |
| `platform_admins` | platform | 1 | `meldiq.platform_admins` | none declared | 1 indexes / 1 checks |
| `platform_audit` | platform | 187 | `meldiq.platform_audit` | none declared | 4 indexes / 1 checks |
| `platform_incident_events` | platform | 146 | `meldiq.platform_incident_events` | platform_incidents | 1 indexes / 1 checks |
| `platform_incidents` | platform | 9 | `meldiq.platform_incidents` | none declared | 4 indexes / 3 checks |
| `platform_report_cases` | platform | 0 | `meldiq.platform_report_cases` | none declared | 1 indexes / 2 checks |
| `platform_report_events` | platform | 0 | `meldiq.platform_report_events` | none declared | 1 indexes / 0 checks |
| `platform_restrictions` | platform | 0 | `meldiq.platform_restrictions` | none declared | 0 indexes / 1 checks |
| `platform_settings` | platform | 5 | `meldiq.platform_settings` | none declared | 0 indexes / 0 checks |
| `presence_hourly` | platform | 222 | `meldiq.presence_hourly` | none declared | 0 indexes / 0 checks |
| `presence_samples` | ephemeral | 13239 | `meldiq.presence_samples` | none declared | 0 indexes / 0 checks |
| `profile_collectible_assets` | identity | 1 | `meldiq.profile_collectible_assets` | none declared | 0 indexes / 0 checks |
| `profile_collectible_catalog` | identity | 1 | `meldiq.profile_collectible_catalog` | none declared | 0 indexes / 0 checks |
| `profile_collectible_inventory` | identity | 0 | `meldiq.profile_collectible_inventory` | users | 1 indexes / 0 checks |
| `profile_collectible_transactions` | identity | 0 | `meldiq.profile_collectible_transactions` | users | 2 indexes / 0 checks |
| `profile_collectible_uploads` | identity | 0 | `meldiq.profile_collectible_uploads` | none declared | 1 indexes / 0 checks |
| `promoted_bookings` | workspace | 0 | `meldiq.promoted_bookings` | orgs | 2 indexes / 2 checks |
| `push_endpoints` | identity | 0 | `meldiq.push_endpoints` | devices | 1 indexes / 1 checks |
| `quota_counters` | platform | 0 | `meldiq.quota_counters` | none declared | 0 indexes / 0 checks |
| `quota_events` | platform | 0 | `meldiq.quota_events` | none declared | 2 indexes / 1 checks |
| `quota_plan_members` | platform | 0 | `meldiq.quota_plan_members` | quota_plans | 0 indexes / 1 checks |
| `quota_plans` | platform | 0 | `meldiq.quota_plans` | none declared | 1 indexes / 0 checks |
| `quota_policies` | platform | 0 | `meldiq.quota_policies` | none declared | 2 indexes / 2 checks |
| `quota_reservations` | platform | 0 | `meldiq.quota_reservations` | none declared | 2 indexes / 1 checks |
| `reaction_roles` | workspace | 0 | `meldiq.reaction_roles` | conversations, org_roles, orgs | 2 indexes / 0 checks |
| `registration_invites` | identity | 1 | `meldiq.registration_invites` | none declared | 1 indexes / 0 checks |
| `reminder_occurrences` | identity | 2 | `meldiq.reminder_occurrences` | reminders | 1 indexes / 0 checks |
| `reminders` | identity | 2 | `meldiq.reminders` | users | 2 indexes / 2 checks |
| `reports` | reports | 0 | `meldiq.reports` | none declared | 4 indexes / 1 checks |
| `resource_hourly` | platform | 13538 | `meldiq.resource_hourly` | none declared | 0 indexes / 0 checks |
| `resource_samples` | ephemeral | 590842 | `meldiq.resource_samples` | none declared | 1 indexes / 0 checks |
| `session_clients` | platform | 60 | `meldiq.session_clients` | none declared | 0 indexes / 0 checks |
| `sessions` | ephemeral | 0 | `meldiq.sessions` | devices, users | 1 indexes / 0 checks |
| `spark_assignments` | billing | 10 | `meldiq.spark_assignments` | none declared | 2 indexes / 1 checks |
| `spark_purchases` | billing | 0 | `meldiq.spark_purchases` | users | 3 indexes / 3 checks |
| `stage_speakers` | workspace | 0 | `meldiq.stage_speakers` | conversation_members | 0 indexes / 0 checks |
| `submitted_messages` | relay | 2819 | `meldiq.submitted_messages` | none declared | 1 indexes / 0 checks |
| `team_members` | workspace | 0 | `meldiq.team_members` | teams, users | 1 indexes / 1 checks |
| `teams` | workspace | 0 | `meldiq.teams` | branches, departments, orgs | 2 indexes / 0 checks |
| `telemetry_epochs` | platform | 55 | `meldiq.telemetry_epochs` | none declared | 0 indexes / 0 checks |
| `ticket_panels` | workspace | 0 | `meldiq.ticket_panels` | channel_categories, conversations, orgs | 1 indexes / 0 checks |
| `tickets` | workspace | 0 | `meldiq.tickets` | conversations, orgs | 2 indexes / 0 checks |
| `traffic_user_daily` | platform | 433 | `meldiq.traffic_user_daily` | none declared | 1 indexes / 0 checks |
| `usage_daily` | workspace | 525 | `meldiq.usage_daily` | orgs | 0 indexes / 0 checks |
| `user_blocks` | identity | 0 | `meldiq.user_blocks` | users | 0 indexes / 0 checks |
| `user_group_members` | workspace | 0 | `meldiq.user_group_members` | user_groups, users | 1 indexes / 0 checks |
| `user_groups` | workspace | 0 | `meldiq.user_groups` | orgs | 1 indexes / 0 checks |
| `users` | identity | 65 | `meldiq.users` | none declared | 3 indexes / 1 checks |
| `webhook_deliveries` | workspace | 0 | `meldiq.webhook_deliveries` | webhooks | 3 indexes / 1 checks |
| `webhooks` | workspace | 0 | `meldiq.webhooks` | orgs | 1 indexes / 0 checks |
| `workflow_runs` | workspace | 0 | `meldiq.workflow_runs` | workflows | 4 indexes / 1 checks |
| `workflows` | workspace | 0 | `meldiq.workflows` | orgs | 2 indexes / 0 checks |

## Native-only / archival collections

| Collection | Estimated rows | Strategy |
|---|---:|---|
| `billing_checkouts_pre_paypal_20261101` | 0 | Preserve backup/archive; never activate as application data |
| `bot_interactions` | 0 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `bots` | 1 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `community_pin_awards` | 0 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `community_pins` | 0 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `community_rule_agreements` | 1 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `community_rules` | 1 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `creator_posts` | 0 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `creator_program` | 0 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `creator_verifications` | 1 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `database_migration_conflicts` | 14269 | Preserve backup/archive; never activate as application data |
| `database_migration_original_platform_audit_20261102` | 1 | Preserve backup/archive; never activate as application data |
| `decoration_favorites` | 0 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `linked_account_starts` | 0 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `linked_accounts` | 0 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `mojo_gifts_pre_paypal_20261101` | 0 | Preserve backup/archive; never activate as application data |
| `oauth_apps` | 1 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `oauth_codes` | 0 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `oauth_grants` | 0 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `oauth_tokens` | 0 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `orbit_meta` | 226 | Preserve backup/archive; never activate as application data |
| `points_accounts` | 8 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `points_days` | 28 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `points_invites` | 1 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `points_ledger` | 148 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `profile_decorations` | 0 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `user_activities` | 0 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |
| `username_holds` | 1 | Explicit normalized mapping and repository conversion required; importer must refuse unknown collection |

## Implementation update

The separate Frankfurt staging project now has twelve versioned migrations. Twenty-four source native stores plus a new Auth device authorization relation have explicit relational models. The staging composition selects PostgreSQL across domains and blocks legacy SQL; 692 API tests and 95 repository/Auth checks pass. Full account/client rollout and production acceptance remain incomplete. Archival/conflict/meta collections remain retained.

## Resume inventory and implementation update

The compatible source baseline is now `dfb010738b323c37f7489cea8ef8491e88f03909` (schema91). The later read-only `live-inventory-20261102-admin.json` observes 272 collections, 689,860 documents, 112,324,092 logical data bytes, 39,694,336 compressed collection bytes and 62,996,480 index bytes. Atlas Console independently showed the Free cluster at 167.01 MB / 512 MB (33%), 12 / 500 connections, reads 8.2 ops/s and writes 1.5 ops/s at that moment. Cloud backups and autoscaling were off. These are point observations, not workload distributions. Runtime credentials cannot read serverStatus; no privileges were widened.

At resume the API image tag had changed to `0.76.0-platform-sync-56b1522778d5`; Docker revision still names `dfb01073`, and the service is running with zero restarts. The old on-disk api-release.json is stale (0.75.0), so it cannot establish the current artifact alone. Reconfirm the exact image/content and any intervening features before a future deployment. No production changes were performed by this migration task.

The additional SQL91 entities below are additive; PostgreSQL now models 254 core tables (2,309 columns) plus 25 native relations (194 columns), including the new device-authorization policy relation.

| Entity | Owner / authority | Destination / strategy | Dependencies | Constraints/indexes |
|---|---|---|---|---|
| `billing_promotion_redemptions` | billing, production Atlas / Fastify | Same IDs/typed frozen import to meldiq.billing_promotion_redemptions | service ownership | PK code, account_id; 0 indexes; 0 checks |
| `billing_promotions` | billing, production Atlas / Fastify | Same IDs/typed frozen import to meldiq.billing_promotions | service ownership | PK code; 0 indexes; 0 checks |
| `collectible_orders` | billing, production Atlas / Fastify | Same IDs/typed frozen import to meldiq.collectible_orders | service ownership | PK id; 4 indexes; 0 checks |
| `platform_appeal_challenges` | ephemeral, production Atlas / Fastify | Same IDs/typed frozen import to meldiq.platform_appeal_challenges | service ownership | PK id; 1 indexes; 0 checks |
| `platform_appeals` | platform, production Atlas / Fastify | Same IDs/typed frozen import to meldiq.platform_appeals | service ownership | PK id; 3 indexes; 0 checks |
| `platform_notice_receipts` | platform, production Atlas / Fastify | Same IDs/typed frozen import to meldiq.platform_notice_receipts | service ownership | PK notice_id, user_id; 0 indexes; 0 checks |
| `platform_notices` | platform, production Atlas / Fastify | Same IDs/typed frozen import to meldiq.platform_notices | service ownership | PK id; 2 indexes; 0 checks |
| `platform_ownership_requests` | platform, production Atlas / Fastify | Same IDs/typed frozen import to meldiq.platform_ownership_requests | service ownership | PK id; 1 indexes; 0 checks |

## Source-level completeness follow-up

`native-source-audit-20261102.json` checks static collection references even when Atlas has not created a collection yet. It identified `privacy_settings`, now modeled by migration008 and a PostgreSQL repository. The current catalog is 254 core plus 24 migrated native relations and one Auth device policy relation, with seven private operational tables (286 total). There are zero unclassified literal references; 25 dynamic catalog/DocumentStore references remain explicit review scope, not an exhaustive-runtime claim.

Privacy settings are identity-owned by user ID; typed group-add enum, suggestability boolean and UTC update time are retained. Favorites are user-owned, reference both built-in and uploaded catalog IDs, and intentionally survive decoration removal. Community rules/pins/awards belong to their community or recipient; historical editor/creator/award-giver strings are audit attribution, not deletion ownership. Migration009 corrects those cascade relationships without deleting data.


## November3 rehearsal checkpoint

Production remains Atlas-authoritative with the same Hostinger API/S3/Redis/LiveKit services. The authorized Frankfurt staging rehearsal now holds282 typed application tables/677,617 records from a read-only275-collection snapshot. Complete row/timestamp/financial/counter reconciliation and a317-table/678,057-row encrypted PostgreSQL restore pass. Native customer Supabase Auth activation and production Realtime remain gated; no traffic cutover occurred. See `docs/migrations/staging-real-data-rehearsal-20261103.md` and `docs/migrations/execution-status.md` for current evidence and remaining acceptance gates.
