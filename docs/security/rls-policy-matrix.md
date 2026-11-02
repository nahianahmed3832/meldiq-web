# RLS policy matrix

Every application relation in this release is private and accessed through Fastify. Client direct table access is intentionally denied, preserving the existing service's detailed privacy/role/history rules. `meldiq_api` is a trusted backend database role, NOBYPASSRLS, with explicit RLS policies; its credential never belongs to a client. This is not a claim that a full direct-client CRUD policy implementation exists.

| Relation | anon/authenticated SELECT/INSERT/UPDATE/DELETE | Backend policy | Authorization boundary |
|---|---|---|---|
| `meldiq.abandoned_uploads` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify files service; no client role grant |
| `meldiq.account_codes` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify accounts service; no client role grant |
| `meldiq.account_email_changes` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify safety service; no client role grant |
| `meldiq.account_key_backups` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify accounts service; no client role grant |
| `meldiq.account_key_unlocks` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify accounts service; no client role grant |
| `meldiq.account_passkey_challenges` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify safety service; no client role grant |
| `meldiq.account_passkeys` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify safety service; no client role grant |
| `meldiq.account_recovery_codes` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify accounts service; no client role grant |
| `meldiq.account_recovery_tickets` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify accounts service; no client role grant |
| `meldiq.account_session_factors` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify accounts service; no client role grant |
| `meldiq.account_sessions` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify accounts service; no client role grant |
| `meldiq.account_social_flows` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify accounts service; no client role grant |
| `meldiq.account_social_identities` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify accounts service; no client role grant |
| `meldiq.account_totp` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify safety service; no client role grant |
| `meldiq.account_totp_backup` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify safety service; no client role grant |
| `meldiq.account_warnings` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify safety service; no client role grant |
| `meldiq.accounts` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify accounts service; no client role grant |
| `meldiq.activity_daily` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_agent_channels` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_agent_identities` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_agent_installs` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_agent_templates` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_approvals` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_channel_context` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_channel_posts` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_channel_readers` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_files` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_job_events` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_jobs` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_model_capabilities` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_models` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_org_entitlements` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_providers` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_reader_choices` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_reader_events` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_routing` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_shared_messages` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_system_checks` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_task_events` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_task_settings` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_tasks` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_tool_policies` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_triggers` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ai_usage` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.alert_deliveries` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.alert_rules` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.alert_state` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.analytics_daily` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.api_keys` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.attachment_uploads` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify files service; no client role grant |
| `meldiq.attachments` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify files service; no client role grant |
| `meldiq.audit_log` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.auth_challenges` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify ephemeral service; no client role grant |
| `meldiq.billing_card_charge_attempts` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_card_charges` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_card_mandates` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_card_setups` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_checkouts` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_commerce_orders` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_coupon_uses` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_coupons` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_customers` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_grant_notes` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_grants` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_invoices` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_notification_jobs` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_payment_actions` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_payment_methods` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_plan_versions` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_plans` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_play_purchases` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_program` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_provider_events` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_referral_codes` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_referrals` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_subscription_history` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_subscriptions` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_webhook_rejections` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.bot_afk` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.bot_alert_watches` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.bot_giveaways` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.bot_levels` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.bot_listings` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.bot_runtime_events` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.bot_starboard` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.bot_wordy_games` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.bot_wordy_recaps` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.bot_wordy_stats` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.branch_members` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.branches` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.bug_reports` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify safety service; no client role grant |
| `meldiq.call_hands` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify calls service; no client role grant |
| `meldiq.call_participants` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify calls service; no client role grant |
| `meldiq.calls` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify calls service; no client role grant |
| `meldiq.channel_categories` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.channel_options` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.channel_overwrites` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.channel_webhooks` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.community_discovery` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.community_expressions` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.community_lobbies` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.community_lobby_feeds` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.community_lobby_posts` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.community_lobby_seen` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.community_member_defaults` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.community_migration_runs` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.community_onboarding` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.community_profiles` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.community_safety` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.community_settings` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.community_standard_invites` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.community_templates` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.community_tickets` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.community_vanity_invites` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.community_voice_bans` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.community_voice_mutes` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.connections` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify relationships service; no client role grant |
| `meldiq.conversation_members` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify conversations service; no client role grant |
| `meldiq.conversations` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify conversations service; no client role grant |
| `meldiq.delivery_queue` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify relay service; no client role grant |
| `meldiq.departments` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.devices` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify identity service; no client role grant |
| `meldiq.discord_connections` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.discord_import_items` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.discord_imports` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.discord_oauth_states` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify ephemeral service; no client role grant |
| `meldiq.discovery_boosts` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.discovery_clicks` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.discovery_visits` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.dm_requests` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify relationships service; no client role grant |
| `meldiq.document_comments` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.document_members` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.document_versions` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.documents` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.fcm_tokens` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify identity service; no client role grant |
| `meldiq.federation_blocks` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify federation service; no client role grant |
| `meldiq.federation_domains` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify federation service; no client role grant |
| `meldiq.federation_inbox` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify federation service; no client role grant |
| `meldiq.federation_nonces` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify ephemeral service; no client role grant |
| `meldiq.federation_outbox` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify federation service; no client role grant |
| `meldiq.federation_peers` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify federation service; no client role grant |
| `meldiq.history_accounts` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify history service; no client role grant |
| `meldiq.history_items` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify history service; no client role grant |
| `meldiq.inbox_accounts` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.inbox_contacts` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.inbox_conversations` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.inbox_events` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.inbox_messages` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.inbox_queues` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.inbox_settings` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.integration_accounts` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify integrations service; no client role grant |
| `meldiq.integration_channel_events` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify integrations service; no client role grant |
| `meldiq.integration_credentials` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify integrations service; no client role grant |
| `meldiq.integration_deliveries` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify integrations service; no client role grant |
| `meldiq.integration_hooks` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify integrations service; no client role grant |
| `meldiq.integration_installs` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify integrations service; no client role grant |
| `meldiq.integration_jobs` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify integrations service; no client role grant |
| `meldiq.integration_oauth_states` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify integrations service; no client role grant |
| `meldiq.integration_policies` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify integrations service; no client role grant |
| `meldiq.integration_subscriptions` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify integrations service; no client role grant |
| `meldiq.invitations` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.join_applications` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.legacy_tickets` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify accounts service; no client role grant |
| `meldiq.loadtest_registrations` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify identity service; no client role grant |
| `meldiq.meeting_participants` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.meetings` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.mention_all_events` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify conversations service; no client role grant |
| `meldiq.message_events` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify history service; no client role grant |
| `meldiq.messaging_settings` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify relationships service; no client role grant |
| `meldiq.mojo_controls` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.mojo_gift_credits` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.mojo_gift_deliveries` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.mojo_gifts` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.mojo_profile` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.nav_preferences` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify preferences service; no client role grant |
| `meldiq.official_bots` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.official_bots_plus` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.onboarding_answers` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.onboarding_completions` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.operator_accounts` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.org_bans` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.org_deletions` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.org_entitlements` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.org_members` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.org_nicknames` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.org_role_extras` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.org_role_members` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.org_roles` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.orgs` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.pairing_requests` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify ephemeral service; no client role grant |
| `meldiq.pending_blob_deletes` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify files service; no client role grant |
| `meldiq.platform_admin_challenges` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify ephemeral service; no client role grant |
| `meldiq.platform_admin_enrolments` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify ephemeral service; no client role grant |
| `meldiq.platform_admin_passkeys` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.platform_admin_sessions` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify ephemeral service; no client role grant |
| `meldiq.platform_admins` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.platform_audit` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.platform_incident_events` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.platform_incidents` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.platform_report_cases` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.platform_report_events` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.platform_restrictions` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.platform_settings` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.presence_hourly` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.presence_samples` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify ephemeral service; no client role grant |
| `meldiq.profile_collectible_assets` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify identity service; no client role grant |
| `meldiq.profile_collectible_catalog` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify identity service; no client role grant |
| `meldiq.profile_collectible_inventory` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify identity service; no client role grant |
| `meldiq.profile_collectible_transactions` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify identity service; no client role grant |
| `meldiq.profile_collectible_uploads` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify identity service; no client role grant |
| `meldiq.promoted_bookings` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.push_endpoints` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify identity service; no client role grant |
| `meldiq.quota_counters` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.quota_events` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.quota_plan_members` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.quota_plans` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.quota_policies` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.quota_reservations` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.reaction_roles` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.registration_invites` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify identity service; no client role grant |
| `meldiq.reminder_occurrences` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify identity service; no client role grant |
| `meldiq.reminders` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify identity service; no client role grant |
| `meldiq.reports` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify reports service; no client role grant |
| `meldiq.resource_hourly` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.resource_samples` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify ephemeral service; no client role grant |
| `meldiq.session_clients` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.sessions` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify ephemeral service; no client role grant |
| `meldiq.spark_assignments` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.spark_purchases` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.stage_speakers` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.submitted_messages` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify relay service; no client role grant |
| `meldiq.team_members` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.teams` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.telemetry_epochs` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.ticket_panels` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.tickets` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.traffic_user_daily` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.usage_daily` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.user_blocks` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify identity service; no client role grant |
| `meldiq.user_group_members` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.user_groups` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.users` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify identity service; no client role grant |
| `meldiq.webhook_deliveries` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.webhooks` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.workflow_runs` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq.workflows` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify workspace service; no client role grant |
| `meldiq_private.auth_links` | Deny all raw table access | `trusted_backend`: meldiq_api only | Server/operator ownership, transaction and retention rules |
| `meldiq_private.revoked_auth_sessions` | Deny all raw table access | `trusted_backend`: meldiq_api only | Server/operator ownership, transaction and retention rules |
| `meldiq_private.row_counters` | Deny all raw table access | `trusted_backend`: meldiq_api only | Server/operator ownership, transaction and retention rules |
| `meldiq_private.migration_runs` | Deny all raw table access | `trusted_backend`: meldiq_api only | Server/operator ownership, transaction and retention rules |
| `meldiq_private.migration_batches` | Deny all raw table access | `trusted_backend`: meldiq_api only | Server/operator ownership, transaction and retention rules |
| `meldiq_private.outbox` | Deny all raw table access | `trusted_backend`: meldiq_api only | Server/operator ownership, transaction and retention rules |
| `meldiq_private.realtime_grants` | Deny all raw table access | `trusted_backend`: meldiq_api only | Server/operator ownership, transaction and retention rules |

## Native relations added after the initial catalog

| Relation | Client operations | Backend policy | Ownership |
|---|---|---|---|
| `meldiq.points_accounts` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | identity; explicit FKs and typed columns |
| `meldiq.points_ledger` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | identity; explicit FKs and typed columns |
| `meldiq.points_days` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | identity; explicit FKs and typed columns |
| `meldiq.points_invites` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | identity; explicit FKs and typed columns |
| `meldiq.oauth_apps` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | identity; explicit FKs and typed columns |
| `meldiq.oauth_codes` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | identity; explicit FKs and typed columns |
| `meldiq.oauth_grants` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | identity; explicit FKs and typed columns |
| `meldiq.oauth_tokens` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | identity; explicit FKs and typed columns |
| `meldiq.bots` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | identity; explicit FKs and typed columns |
| `meldiq.bot_interactions` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | identity; explicit FKs and typed columns |
| `meldiq.profile_decorations` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | identity; explicit FKs and typed columns |
| `meldiq.decoration_favorites` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | identity; explicit FKs and typed columns |
| `meldiq.community_pins` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | workspace; explicit FKs and typed columns |
| `meldiq.community_pin_awards` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | workspace; explicit FKs and typed columns |
| `meldiq.community_rules` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | workspace; explicit FKs and typed columns |
| `meldiq.community_rule_agreements` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | workspace; explicit FKs and typed columns |
| `meldiq.user_activities` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | identity; explicit FKs and typed columns |
| `meldiq.username_holds` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | identity; explicit FKs and typed columns |
| `meldiq.creator_verifications` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | identity; explicit FKs and typed columns |
| `meldiq.creator_program` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | identity; explicit FKs and typed columns |
| `meldiq.creator_posts` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | identity; explicit FKs and typed columns |
| `meldiq.linked_accounts` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | identity; explicit FKs and typed columns |
| `meldiq.linked_account_starts` | Deny raw SELECT/INSERT/UPDATE/DELETE | `trusted_backend`, meldiq_api only | identity; explicit FKs and typed columns |

| `meldiq.billing_promotion_redemptions` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.billing_promotions` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.collectible_orders` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify billing service; no client role grant |
| `meldiq.platform_appeal_challenges` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify ephemeral service; no client role grant |
| `meldiq.platform_appeals` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.platform_notice_receipts` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.platform_notices` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |
| `meldiq.platform_ownership_requests` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify platform service; no client role grant |

| `meldiq.privacy_settings` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Fastify privacy service; no client role grant |

| `meldiq.auth_device_sessions` | Deny all; privileges revoked, FORCE RLS | `trusted_backend`: meldiq_api only | Exact certified device, immutable provider-session binding and durable revocation; no credential tokens |

## Exposed authorization functions and managed Realtime

| Surface | Operation | Allowed condition |
|---|---|---|
| session_active(uuid,uuid) | EXECUTE, backend only | Exact live Auth session belongs to subject, has not expired or been locally revoked, and its provider user is not banned or soft deleted |
| active_user_id() | EXECUTE, authenticated | Current Auth UUID maps to the same legacy account/user and certified-device binding; neither owner/device is disabled/deleted/revoked; password epoch matches; provider session remains active |
| can_join_topic(topic,extension,sending) | EXECUTE, authenticated | Fixed boolean only; active identity plus owner-only read topic or short-lived server-issued exact topic lease |
| realtime.messages / meldiq_private_receive | SELECT probe | Authenticated owner of user:<id>, or current exact-topic grant; Broadcast/Presence only |
| realtime.messages / meldiq_ephemeral_send | INSERT probe | Current exact-topic lease; Presence explicitly allowed or Broadcast permitted only for ephemeral:<id> |
| realtime.messages / meldiq_outbox_publish | Column-scoped INSERT, meldiq_api only | Private message.changed invalidation; exact payload/event/topic and matching live leased, undelivered, non-dead Realtime outbox row; raw client roles receive no persistent publishing privilege |
| All client mutations to payments/gifts/entitlements/admin/audit/accounts/roles | None | Always denied; use existing server authorization/step-up/webhook verification |

Realtime owns its messages table and already enables RLS. No migration changes its ownership/RLS setting. Check for any other permissive policies before hosted acceptance: policies are OR-combined and an unrelated USING(true) can widen access. Staging's public access is disabled and behaviorally rejected after its Realtime restart; verify this again on production. Use private:true clients and short-lived JWTs/grants. Permission-cache revocation limits are documented in realtime-architecture.md; contents are fetched through authorized API after ID-only invalidations.

The seven private tables, 279 application tables, ownership/revocation functions and actual Realtime insert-policy behavior are covered by local PostgreSQL tests. Hosted probes and full application negative tests are separate gates. Authentication role metadata never creates platform-admin access.
