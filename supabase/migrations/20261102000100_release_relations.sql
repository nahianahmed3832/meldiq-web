-- Generated from release 695f80b1361f85ccb2a9806a3024a14227a48754; do not edit by hand.
-- Epoch-millisecond columns preserve the released UTC/API contract. New operational time columns use timestamptz.
CREATE SCHEMA meldiq;
CREATE SCHEMA meldiq_private;
REVOKE ALL ON SCHEMA meldiq, meldiq_private FROM PUBLIC, anon, authenticated;
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'meldiq_api') THEN CREATE ROLE meldiq_api NOLOGIN NOBYPASSRLS; END IF; END $$;
GRANT USAGE ON SCHEMA meldiq, meldiq_private TO meldiq_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA meldiq, meldiq_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE TABLE meldiq."abandoned_uploads" (
  "id" text NOT NULL,
  "multipart_id" text,
  "attempts" bigint NOT NULL DEFAULT 0,
  "next_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
ALTER TABLE meldiq."abandoned_uploads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."abandoned_uploads" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."abandoned_uploads" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."abandoned_uploads" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."abandoned_uploads" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."account_codes" (
  "account_id" text NOT NULL,
  "purpose" text NOT NULL,
  "code_hash" text NOT NULL,
  "attempts" bigint NOT NULL DEFAULT 0,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("account_id", "purpose"),
  CHECK (purpose IN ('verify_email','reset_password'))
);
CREATE INDEX "account_codes_idx_account_codes_expiry" ON meldiq."account_codes" ("expires_at");
ALTER TABLE meldiq."account_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."account_codes" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."account_codes" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."account_codes" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."account_codes" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."account_email_changes" (
  "account_id" text NOT NULL,
  "new_email" text NOT NULL,
  "code_hash" text NOT NULL,
  "attempts" bigint NOT NULL DEFAULT 0,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("account_id")
);
ALTER TABLE meldiq."account_email_changes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."account_email_changes" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."account_email_changes" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."account_email_changes" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."account_email_changes" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."account_key_backups" (
  "account_id" text NOT NULL,
  "identity_key" text NOT NULL,
  "password_changed_at" bigint NOT NULL,
  "version" bigint NOT NULL,
  "iterations" bigint NOT NULL,
  "salt" text NOT NULL,
  "nonce" text NOT NULL,
  "ciphertext" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("account_id")
);
ALTER TABLE meldiq."account_key_backups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."account_key_backups" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."account_key_backups" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."account_key_backups" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."account_key_backups" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."account_key_unlocks" (
  "account_id" text NOT NULL,
  "session_id" text NOT NULL,
  "code_hash" text NOT NULL,
  "attempts" bigint NOT NULL DEFAULT 0,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("account_id")
);
CREATE INDEX "account_key_unlocks_idx_account_key_unlocks_expiry" ON meldiq."account_key_unlocks" ("expires_at");
ALTER TABLE meldiq."account_key_unlocks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."account_key_unlocks" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."account_key_unlocks" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."account_key_unlocks" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."account_key_unlocks" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."account_passkey_challenges" (
  "id" text NOT NULL,
  "purpose" text NOT NULL,
  "account_id" text,
  "challenge" text NOT NULL,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (purpose IN ('register', 'login'))
);
CREATE INDEX "account_passkey_challenges_idx_account_passkey_cha_32e063551747" ON meldiq."account_passkey_challenges" ("expires_at");
ALTER TABLE meldiq."account_passkey_challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."account_passkey_challenges" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."account_passkey_challenges" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."account_passkey_challenges" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."account_passkey_challenges" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."account_passkeys" (
  "id" text NOT NULL,
  "account_id" text NOT NULL,
  "public_key" text NOT NULL,
  "counter" bigint NOT NULL DEFAULT 0,
  "transports" text,
  "name" text NOT NULL,
  "backed_up" bigint NOT NULL DEFAULT 0,
  "created_at" bigint NOT NULL,
  "last_used_at" bigint,
  PRIMARY KEY ("id")
);
CREATE INDEX "account_passkeys_idx_account_passkeys_account" ON meldiq."account_passkeys" ("account_id");
ALTER TABLE meldiq."account_passkeys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."account_passkeys" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."account_passkeys" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."account_passkeys" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."account_passkeys" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."account_recovery_codes" (
  "id" text NOT NULL,
  "account_id" text NOT NULL,
  "code_hash" text NOT NULL,
  "created_at" bigint NOT NULL,
  "used_at" bigint,
  PRIMARY KEY ("id")
);
CREATE INDEX "account_recovery_codes_idx_account_recovery_codes_account" ON meldiq."account_recovery_codes" ("account_id");
CREATE UNIQUE INDEX "account_recovery_codes_sqlite_autoindex_account_re_b4da9be20be4" ON meldiq."account_recovery_codes" ("code_hash");
ALTER TABLE meldiq."account_recovery_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."account_recovery_codes" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."account_recovery_codes" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."account_recovery_codes" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."account_recovery_codes" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."account_recovery_tickets" (
  "ticket_hash" text NOT NULL,
  "account_id" text NOT NULL,
  "new_email" text NOT NULL,
  "email_code_hash" text NOT NULL,
  "attempts" bigint NOT NULL DEFAULT 0,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "used_at" bigint,
  PRIMARY KEY ("ticket_hash")
);
CREATE INDEX "account_recovery_tickets_idx_account_recovery_tickets_expiry" ON meldiq."account_recovery_tickets" ("expires_at");
ALTER TABLE meldiq."account_recovery_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."account_recovery_tickets" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."account_recovery_tickets" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."account_recovery_tickets" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."account_recovery_tickets" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."account_session_factors" (
  "id" text NOT NULL,
  "account_id" text NOT NULL,
  "verified_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "account_session_factors_idx_session_factors_expiry" ON meldiq."account_session_factors" ("expires_at");
ALTER TABLE meldiq."account_session_factors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."account_session_factors" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."account_session_factors" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."account_session_factors" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."account_session_factors" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."account_sessions" (
  "id" text NOT NULL,
  "account_id" text NOT NULL,
  "device_id" text,
  "label" text NOT NULL,
  "access_hash" text NOT NULL,
  "access_expires_at" bigint NOT NULL,
  "refresh_hash" text NOT NULL,
  "previous_refresh_hash" text,
  "refresh_expires_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "created_at" bigint NOT NULL,
  "refreshed_at" bigint NOT NULL,
  "last_used_at" bigint NOT NULL,
  "revoked_at" bigint,
  "revoke_reason" text,
  "previous_refresh_answer" text,
  PRIMARY KEY ("id")
);
CREATE INDEX "account_sessions_idx_account_sessions_expiry" ON meldiq."account_sessions" ("expires_at");
CREATE INDEX "account_sessions_idx_account_sessions_device" ON meldiq."account_sessions" ("device_id") WHERE "device_id" IS NOT NULL;
CREATE INDEX "account_sessions_idx_account_sessions_account" ON meldiq."account_sessions" ("account_id");
CREATE UNIQUE INDEX "account_sessions_sqlite_autoindex_account_sessions_3" ON meldiq."account_sessions" ("refresh_hash");
CREATE UNIQUE INDEX "account_sessions_sqlite_autoindex_account_sessions_2" ON meldiq."account_sessions" ("access_hash");
ALTER TABLE meldiq."account_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."account_sessions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."account_sessions" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."account_sessions" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."account_sessions" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."account_social_flows" (
  "id" text NOT NULL,
  "data" text NOT NULL,
  "stage" text NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "account_social_flows_account_social_flows_expiry" ON meldiq."account_social_flows" ("expires_at");
ALTER TABLE meldiq."account_social_flows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."account_social_flows" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."account_social_flows" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."account_social_flows" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."account_social_flows" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."account_social_identities" (
  "id" text NOT NULL,
  "account_id" text NOT NULL,
  "provider" text NOT NULL,
  "issuer" text NOT NULL,
  "subject" text NOT NULL,
  "email" text,
  "connected_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (provider IN ('google','apple','discord'))
);
CREATE UNIQUE INDEX "account_social_identities_sqlite_autoindex_account_2d44e63b338c" ON meldiq."account_social_identities" ("account_id", "provider");
CREATE UNIQUE INDEX "account_social_identities_sqlite_autoindex_account_7e2af4c463f4" ON meldiq."account_social_identities" ("provider", "issuer", "subject");
ALTER TABLE meldiq."account_social_identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."account_social_identities" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."account_social_identities" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."account_social_identities" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."account_social_identities" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."account_totp" (
  "account_id" text NOT NULL,
  "secret" text NOT NULL,
  "created_at" bigint NOT NULL,
  "enabled_at" bigint,
  "last_step" bigint NOT NULL DEFAULT 0,
  PRIMARY KEY ("account_id")
);
ALTER TABLE meldiq."account_totp" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."account_totp" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."account_totp" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."account_totp" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."account_totp" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."account_totp_backup" (
  "id" text NOT NULL,
  "account_id" text NOT NULL,
  "code_hash" text NOT NULL,
  "created_at" bigint NOT NULL,
  "used_at" bigint,
  PRIMARY KEY ("id")
);
CREATE INDEX "account_totp_backup_idx_account_totp_backup_account" ON meldiq."account_totp_backup" ("account_id");
CREATE UNIQUE INDEX "account_totp_backup_sqlite_autoindex_account_totp_backup_2" ON meldiq."account_totp_backup" ("code_hash");
ALTER TABLE meldiq."account_totp_backup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."account_totp_backup" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."account_totp_backup" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."account_totp_backup" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."account_totp_backup" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."account_warnings" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "reason" text NOT NULL,
  "created_by" text,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "revoked_at" bigint,
  PRIMARY KEY ("id")
);
CREATE INDEX "account_warnings_idx_account_warnings_user" ON meldiq."account_warnings" ("user_id", "expires_at");
ALTER TABLE meldiq."account_warnings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."account_warnings" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."account_warnings" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."account_warnings" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."account_warnings" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."accounts" (
  "id" text NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "password_hash" text NOT NULL,
  "password_changed_at" bigint NOT NULL,
  "email_verified_at" bigint,
  "user_id" text,
  "legacy_linked_at" bigint,
  "selected_workspace_id" text,
  "admitted_via" text,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "disabled_at" bigint,
  PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "accounts_sqlite_autoindex_accounts_3" ON meldiq."accounts" ("user_id") WHERE "user_id" IS NOT NULL;
CREATE UNIQUE INDEX "accounts_sqlite_autoindex_accounts_2" ON meldiq."accounts" ((translate("email", 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')));
ALTER TABLE meldiq."accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."accounts" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."accounts" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."accounts" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."accounts" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."activity_daily" (
  "day" text NOT NULL,
  "user_id" text NOT NULL,
  "platform" text NOT NULL,
  "client_version" text NOT NULL DEFAULT '',
  "first_at" bigint NOT NULL,
  "last_at" bigint NOT NULL,
  "requests" bigint NOT NULL DEFAULT 0,
  "actions" bigint NOT NULL DEFAULT 0,
  "first_action_at" bigint,
  "signup_at" bigint,
  PRIMARY KEY ("day", "user_id", "platform", "client_version")
);
CREATE INDEX "activity_daily_idx_activity_daily_signup" ON meldiq."activity_daily" ("signup_at", "day");
CREATE INDEX "activity_daily_idx_activity_daily_user" ON meldiq."activity_daily" ("user_id", "day");
ALTER TABLE meldiq."activity_daily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."activity_daily" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."activity_daily" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."activity_daily" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."activity_daily" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_agent_channels" (
  "install_id" text NOT NULL,
  "conversation_id" text NOT NULL,
  "org_id" text NOT NULL,
  "activation" text NOT NULL,
  "added_by" text NOT NULL,
  "added_at" bigint NOT NULL,
  PRIMARY KEY ("install_id", "conversation_id"),
  CHECK (activation IN ('mention', 'command', 'explicit'))
);
CREATE INDEX "ai_agent_channels_idx_ai_agent_channels_conv" ON meldiq."ai_agent_channels" ("conversation_id");
ALTER TABLE meldiq."ai_agent_channels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_agent_channels" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_agent_channels" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_agent_channels" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_agent_channels" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_agent_identities" (
  "install_id" text NOT NULL,
  "user_id" text NOT NULL,
  "identity_seed" text NOT NULL,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("install_id")
);
CREATE UNIQUE INDEX "ai_agent_identities_sqlite_autoindex_ai_agent_identities_2" ON meldiq."ai_agent_identities" ("user_id");
ALTER TABLE meldiq."ai_agent_identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_agent_identities" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_agent_identities" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_agent_identities" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_agent_identities" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_agent_installs" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "agent_id" text NOT NULL,
  "live_agent" text,
  "version" bigint NOT NULL,
  "state" text NOT NULL,
  "display_name" text NOT NULL,
  "avatar_blob" text,
  "avatar_sha256" text,
  "avatar_color" text,
  "description" text NOT NULL,
  "role_title" text NOT NULL,
  "language" text,
  "style" text NOT NULL DEFAULT 'balanced',
  "instructions" text NOT NULL DEFAULT '',
  "tools" text NOT NULL,
  "execution_mode" text NOT NULL DEFAULT 'review',
  "max_jobs_per_day" bigint,
  "max_concurrent" bigint,
  "invokers" text NOT NULL DEFAULT '{"everyone":true,"roles":[]}',
  "rev" bigint NOT NULL,
  "installed_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "autonomy" text NOT NULL DEFAULT 'assisted',
  "max_runtime_sec" bigint,
  "max_attempts" bigint,
  "active_hours" text,
  "max_cost_micro_month" bigint,
  PRIMARY KEY ("id"),
  CHECK (state IN ('active', 'disabled', 'uninstalled')),
  CHECK (execution_mode IN ('review', 'auto')),
  CHECK (autonomy IN ('manual', 'assisted', 'guarded', 'continuous'))
);
CREATE INDEX "ai_agent_installs_idx_ai_agent_installs_org" ON meldiq."ai_agent_installs" ("org_id", "state");
CREATE UNIQUE INDEX "ai_agent_installs_idx_ai_agent_installs_live" ON meldiq."ai_agent_installs" ("org_id", "live_agent") WHERE "live_agent" IS NOT NULL;
ALTER TABLE meldiq."ai_agent_installs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_agent_installs" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_agent_installs" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_agent_installs" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_agent_installs" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_agent_templates" (
  "agent_id" text NOT NULL,
  "version" bigint NOT NULL,
  "status" text NOT NULL,
  "availability" text NOT NULL DEFAULT 'all',
  "policy" text NOT NULL DEFAULT '{}',
  "updated_by" text,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("agent_id", "version"),
  CHECK (status IN ('draft', 'published', 'disabled', 'retired')),
  CHECK (availability IN ('all', 'entitled'))
);
ALTER TABLE meldiq."ai_agent_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_agent_templates" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_agent_templates" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_agent_templates" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_agent_templates" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_approvals" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "job_id" text NOT NULL,
  "action" text NOT NULL,
  "artifact_id" text,
  "artifact_sha" text,
  "payload_hash" text,
  "summary" text NOT NULL,
  "state" text NOT NULL,
  "requested_at" bigint NOT NULL,
  "decided_by" text,
  "decided_at" bigint,
  "note" text,
  PRIMARY KEY ("id"),
  CHECK (state IN ('pending', 'approved', 'rejected', 'invalidated'))
);
CREATE INDEX "ai_approvals_idx_ai_approvals_org" ON meldiq."ai_approvals" ("org_id", "state");
CREATE INDEX "ai_approvals_idx_ai_approvals_job" ON meldiq."ai_approvals" ("job_id");
ALTER TABLE meldiq."ai_approvals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_approvals" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_approvals" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_approvals" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_approvals" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_channel_context" (
  "reader_id" text NOT NULL,
  "message_id" text NOT NULL,
  "sender_user_id" text NOT NULL,
  "sent_at" bigint NOT NULL,
  "thread_root" text,
  "body" text NOT NULL,
  "edited_at" bigint,
  "received_at" bigint NOT NULL,
  PRIMARY KEY ("reader_id", "message_id")
);
CREATE INDEX "ai_channel_context_idx_ai_context_time" ON meldiq."ai_channel_context" ("reader_id", "sent_at");
ALTER TABLE meldiq."ai_channel_context" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_channel_context" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_channel_context" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_channel_context" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_channel_context" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_channel_posts" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "conversation_id" text NOT NULL,
  "thread_root" text,
  "install_id" text NOT NULL,
  "job_id" text,
  "kind" text NOT NULL,
  "body" text NOT NULL,
  "file_ids" text NOT NULL DEFAULT '[]',
  "approval_id" text,
  "author_id" text,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (kind IN ('request', 'ack', 'progress', 'result', 'approval', 'error'))
);
CREATE INDEX "ai_channel_posts_idx_ai_channel_posts_expiry" ON meldiq."ai_channel_posts" ("expires_at");
CREATE INDEX "ai_channel_posts_idx_ai_channel_posts_conv" ON meldiq."ai_channel_posts" ("conversation_id", "created_at");
ALTER TABLE meldiq."ai_channel_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_channel_posts" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_channel_posts" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_channel_posts" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_channel_posts" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_channel_readers" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "install_id" text NOT NULL,
  "conversation_id" text NOT NULL,
  "device_id" text NOT NULL,
  "reader_key" text,
  "device_keys" text,
  "state" text NOT NULL,
  "mode" text NOT NULL DEFAULT 'channel',
  "turned_on_by" text NOT NULL,
  "reason" text NOT NULL,
  "created_at" bigint NOT NULL,
  "turned_off_at" bigint,
  "turned_off_by" text,
  "off_reason" text,
  PRIMARY KEY ("id"),
  CHECK (state IN ('on', 'off')),
  CHECK (mode IN ('channel', 'direct'))
);
CREATE INDEX "ai_channel_readers_idx_ai_readers_install" ON meldiq."ai_channel_readers" ("install_id", "state");
CREATE INDEX "ai_channel_readers_idx_ai_readers_conv" ON meldiq."ai_channel_readers" ("conversation_id", "state");
CREATE UNIQUE INDEX "ai_channel_readers_sqlite_autoindex_ai_channel_readers_2" ON meldiq."ai_channel_readers" ("device_id");
ALTER TABLE meldiq."ai_channel_readers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_channel_readers" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_channel_readers" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_channel_readers" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_channel_readers" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_files" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "role" text NOT NULL,
  "job_id" text,
  "install_id" text,
  "agent_id" text,
  "skill_version" bigint,
  "conversation_id" text,
  "uploaded_by" text,
  "kind" text,
  "name" text NOT NULL,
  "mime" text NOT NULL,
  "size" bigint NOT NULL,
  "sha256" text NOT NULL,
  "blob_key" text NOT NULL,
  "artifact_version" bigint NOT NULL DEFAULT 1,
  "supersedes" text,
  "approval_state" text NOT NULL DEFAULT 'not_required',
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "deleted_at" bigint,
  "task_id" text,
  PRIMARY KEY ("id"),
  CHECK (role IN ('input', 'artifact', 'avatar')),
  CHECK (approval_state IN ('not_required', 'pending', 'approved', 'rejected', 'superseded'))
);
CREATE INDEX "ai_files_idx_ai_files_task" ON meldiq."ai_files" ("task_id");
CREATE INDEX "ai_files_idx_ai_files_expiry" ON meldiq."ai_files" ("expires_at");
CREATE INDEX "ai_files_idx_ai_files_org" ON meldiq."ai_files" ("org_id", "role", "created_at");
CREATE INDEX "ai_files_idx_ai_files_job" ON meldiq."ai_files" ("job_id");
ALTER TABLE meldiq."ai_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_files" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_files" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_files" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_files" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_job_events" (
  "id" bigint NOT NULL,
  "job_id" text NOT NULL,
  "at" bigint NOT NULL,
  "kind" text NOT NULL,
  "detail" text NOT NULL DEFAULT '{}',
  PRIMARY KEY ("id")
);
CREATE INDEX "ai_job_events_idx_ai_job_events_job" ON meldiq."ai_job_events" ("job_id", "id");
ALTER TABLE meldiq."ai_job_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_job_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_job_events" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_job_events" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_job_events" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_jobs" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "install_id" text NOT NULL,
  "agent_id" text NOT NULL,
  "version" bigint NOT NULL,
  "skill_id" text NOT NULL,
  "requested_by" text NOT NULL,
  "conversation_id" text,
  "thread_root" text,
  "parent_job_id" text,
  "root_job_id" text NOT NULL,
  "depth" bigint NOT NULL DEFAULT 0,
  "depends_on" text NOT NULL DEFAULT '[]',
  "waiting_on" text,
  "state" text NOT NULL,
  "input" text NOT NULL,
  "output" text,
  "checkpoint" text,
  "revision" bigint NOT NULL DEFAULT 0,
  "progress" bigint NOT NULL DEFAULT 0,
  "progress_note" text,
  "attempts" bigint NOT NULL DEFAULT 0,
  "max_attempts" bigint NOT NULL,
  "next_at" bigint NOT NULL,
  "lease_until" bigint,
  "worker" text,
  "deadline_at" bigint NOT NULL,
  "idempotency_key" text,
  "cancel_requested" bigint NOT NULL DEFAULT 0,
  "error_code" text,
  "error_detail" text,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "started_at" bigint,
  "finished_at" bigint,
  "expires_at" bigint NOT NULL,
  "trigger_id" text,
  "source_job_id" text,
  "chain" bigint NOT NULL DEFAULT 0,
  PRIMARY KEY ("id"),
  CHECK (state IN ('queued', 'planning', 'running', 'awaiting_input', 'awaiting_approval', 'completed', 'failed', 'cancelled'))
);
CREATE INDEX "ai_jobs_idx_ai_jobs_trigger" ON meldiq."ai_jobs" ("trigger_id", "created_at");
CREATE INDEX "ai_jobs_idx_ai_jobs_expiry" ON meldiq."ai_jobs" ("expires_at");
CREATE INDEX "ai_jobs_idx_ai_jobs_root" ON meldiq."ai_jobs" ("root_job_id");
CREATE INDEX "ai_jobs_idx_ai_jobs_org" ON meldiq."ai_jobs" ("org_id", "created_at");
CREATE INDEX "ai_jobs_idx_ai_jobs_due" ON meldiq."ai_jobs" ("state", "next_at");
CREATE UNIQUE INDEX "ai_jobs_idx_ai_jobs_idem" ON meldiq."ai_jobs" ("org_id", "requested_by", "idempotency_key") WHERE "idempotency_key" IS NOT NULL;
ALTER TABLE meldiq."ai_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_jobs" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_jobs" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_jobs" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_jobs" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_model_capabilities" (
  "provider_id" text NOT NULL,
  "model" text NOT NULL,
  "capability" text NOT NULL,
  "verified_at" bigint,
  "verify_ok" bigint,
  "verify_detail" text,
  PRIMARY KEY ("provider_id", "model", "capability"),
  CHECK (capability IN ('text', 'vision', 'transcription', 'speech', 'image_generation', 'embeddings'))
);
ALTER TABLE meldiq."ai_model_capabilities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_model_capabilities" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_model_capabilities" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_model_capabilities" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_model_capabilities" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_models" (
  "provider_id" text NOT NULL,
  "model" text NOT NULL,
  "enabled" bigint NOT NULL DEFAULT 1,
  "input_price_micro" bigint,
  "output_price_micro" bigint,
  "price_source" text NOT NULL DEFAULT '',
  "price_updated_at" bigint,
  "quality_rank" bigint,
  "auto_routable" bigint NOT NULL DEFAULT 1,
  "request_price_micro" bigint,
  "minute_price_micro" bigint,
  PRIMARY KEY ("provider_id", "model")
);
ALTER TABLE meldiq."ai_models" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_models" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_models" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_models" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_models" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_org_entitlements" (
  "org_id" text NOT NULL,
  "doc" text NOT NULL,
  "rev" bigint NOT NULL,
  "updated_by" text,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("org_id")
);
ALTER TABLE meldiq."ai_org_entitlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_org_entitlements" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_org_entitlements" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_org_entitlements" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_org_entitlements" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_providers" (
  "id" text NOT NULL,
  "kind" text NOT NULL,
  "name" text NOT NULL,
  "enabled" bigint NOT NULL DEFAULT 0,
  "secret_ciphertext" text,
  "secret_set_at" bigint,
  "timeout_ms" bigint NOT NULL DEFAULT 30000,
  "max_retries" bigint NOT NULL DEFAULT 1,
  "fallback_id" text,
  "last_test_at" bigint,
  "last_test_ok" bigint,
  "last_test_detail" text,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (kind IN ('anthropic', 'openai', 'google'))
);
CREATE UNIQUE INDEX "ai_providers_sqlite_autoindex_ai_providers_2" ON meldiq."ai_providers" ("name");
ALTER TABLE meldiq."ai_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_providers" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_providers" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_providers" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_providers" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_reader_choices" (
  "reader_id" text NOT NULL,
  "user_id" text NOT NULL,
  "choice" text NOT NULL,
  "at" bigint NOT NULL,
  PRIMARY KEY ("reader_id", "user_id"),
  CHECK (choice IN ('share', 'keep'))
);
ALTER TABLE meldiq."ai_reader_choices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_reader_choices" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_reader_choices" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_reader_choices" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_reader_choices" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_reader_events" (
  "reader_id" text NOT NULL,
  "message_id" text NOT NULL,
  "outcome" text NOT NULL,
  "job_id" text,
  "at" bigint NOT NULL,
  PRIMARY KEY ("reader_id", "message_id")
);
CREATE INDEX "ai_reader_events_idx_ai_reader_events_time" ON meldiq."ai_reader_events" ("reader_id", "at");
ALTER TABLE meldiq."ai_reader_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_reader_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_reader_events" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_reader_events" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_reader_events" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_routing" (
  "category" text NOT NULL,
  "provider_id" text,
  "model" text,
  "fallbacks" text NOT NULL DEFAULT '[]',
  "prefer" text NOT NULL DEFAULT 'quality',
  "max_price_micro" bigint,
  "updated_by" text,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("category"),
  CHECK (prefer IN ('quality', 'cost', 'latency'))
);
ALTER TABLE meldiq."ai_routing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_routing" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_routing" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_routing" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_routing" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_shared_messages" (
  "job_id" text NOT NULL,
  "org_id" text NOT NULL,
  "conversation_id" text NOT NULL,
  "shared_by" text NOT NULL,
  "messages" text NOT NULL,
  "count" bigint NOT NULL,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("job_id")
);
CREATE INDEX "ai_shared_messages_idx_ai_shared_messages_expiry" ON meldiq."ai_shared_messages" ("expires_at");
ALTER TABLE meldiq."ai_shared_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_shared_messages" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_shared_messages" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_shared_messages" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_shared_messages" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_system_checks" (
  "id" text NOT NULL,
  "scope" text NOT NULL,
  "org_id" text,
  "requested_by" text NOT NULL,
  "started_at" bigint NOT NULL,
  "finished_at" bigint NOT NULL,
  "worst" text NOT NULL,
  "summary" text NOT NULL,
  "report" text NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (scope IN ('community', 'platform'))
);
CREATE INDEX "ai_system_checks_idx_ai_system_checks_scope" ON meldiq."ai_system_checks" ("scope", "org_id", "started_at");
ALTER TABLE meldiq."ai_system_checks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_system_checks" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_system_checks" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_system_checks" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_system_checks" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_task_events" (
  "id" bigint NOT NULL,
  "task_id" text NOT NULL,
  "at" bigint NOT NULL,
  "actor_id" text,
  "kind" text NOT NULL,
  "detail" text NOT NULL DEFAULT '{}',
  PRIMARY KEY ("id")
);
CREATE INDEX "ai_task_events_idx_ai_task_events_task" ON meldiq."ai_task_events" ("task_id", "id");
ALTER TABLE meldiq."ai_task_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_task_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_task_events" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_task_events" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_task_events" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_task_settings" (
  "org_id" text NOT NULL,
  "roles" text NOT NULL DEFAULT '[]',
  "users" text NOT NULL DEFAULT '[]',
  "updated_by" text NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("org_id")
);
ALTER TABLE meldiq."ai_task_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_task_settings" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_task_settings" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_task_settings" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_task_settings" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_tasks" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "title" text NOT NULL,
  "instructions" text NOT NULL,
  "deliverables" text NOT NULL DEFAULT '',
  "assignee_id" text NOT NULL,
  "created_by" text NOT NULL,
  "install_id" text,
  "job_id" text,
  "conversation_id" text,
  "priority" text NOT NULL DEFAULT 'normal',
  "state" text NOT NULL DEFAULT 'open',
  "depends_on" text NOT NULL DEFAULT '[]',
  "reference_files" text NOT NULL DEFAULT '[]',
  "due_at" bigint,
  "blocked_reason" text,
  "submission_note" text,
  "return_reason" text,
  "returns" bigint NOT NULL DEFAULT 0,
  "reminders" bigint NOT NULL DEFAULT 0,
  "last_reminder_at" bigint,
  "escalated_at" bigint,
  "cancel_reason" text,
  "rev" bigint NOT NULL DEFAULT 1,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "opened_at" bigint,
  "accepted_at" bigint,
  "submitted_at" bigint,
  "done_at" bigint,
  "done_by" text,
  PRIMARY KEY ("id"),
  CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CHECK (state IN ('waiting', 'open', 'accepted', 'in_progress', 'blocked', 'submitted', 'done', 'cancelled'))
);
CREATE INDEX "ai_tasks_idx_ai_tasks_job" ON meldiq."ai_tasks" ("job_id");
CREATE INDEX "ai_tasks_idx_ai_tasks_assignee" ON meldiq."ai_tasks" ("assignee_id", "state");
CREATE INDEX "ai_tasks_idx_ai_tasks_org" ON meldiq."ai_tasks" ("org_id", "state", "due_at");
ALTER TABLE meldiq."ai_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_tasks" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_tasks" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_tasks" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_tasks" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_tool_policies" (
  "tool" text NOT NULL,
  "mode" text NOT NULL,
  "updated_by" text,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("tool"),
  CHECK (mode IN ('allowed', 'approval', 'disabled'))
);
ALTER TABLE meldiq."ai_tool_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_tool_policies" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_tool_policies" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_tool_policies" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_tool_policies" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_triggers" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "install_id" text NOT NULL,
  "kind" text NOT NULL,
  "enabled" bigint NOT NULL DEFAULT 1,
  "label" text NOT NULL,
  "brief" text NOT NULL,
  "conversation_id" text,
  "config" text NOT NULL,
  "source_install_id" text,
  "secret_hash" text,
  "run_as" text NOT NULL,
  "next_run_at" bigint,
  "last_fired_at" bigint,
  "last_job_id" text,
  "last_error" text,
  "failures" bigint NOT NULL DEFAULT 0,
  "rev" bigint NOT NULL,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (kind IN ('schedule', 'webhook', 'after_agent'))
);
CREATE INDEX "ai_triggers_idx_ai_triggers_source" ON meldiq."ai_triggers" ("source_install_id") WHERE "source_install_id" IS NOT NULL;
CREATE INDEX "ai_triggers_idx_ai_triggers_install" ON meldiq."ai_triggers" ("install_id");
CREATE INDEX "ai_triggers_idx_ai_triggers_due" ON meldiq."ai_triggers" ("kind", "enabled", "next_run_at");
ALTER TABLE meldiq."ai_triggers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_triggers" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_triggers" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_triggers" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_triggers" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ai_usage" (
  "id" bigint NOT NULL,
  "at" bigint NOT NULL,
  "provider_id" text NOT NULL,
  "model" text NOT NULL,
  "feature" text NOT NULL,
  "user_id" text,
  "org_id" text,
  "outcome" text NOT NULL,
  "status" bigint,
  "input_tokens" bigint,
  "output_tokens" bigint,
  "tokens_source" text NOT NULL DEFAULT 'provider',
  "cost_micro" bigint,
  "latency_ms" bigint,
  "error_kind" text,
  "job_id" text,
  "install_id" text,
  "agent_id" text,
  "capability" text,
  "route" text,
  PRIMARY KEY ("id"),
  CHECK (outcome IN ('ok', 'error', 'blocked', 'timeout')),
  CHECK (tokens_source IN ('provider', 'estimate', 'none'))
);
CREATE INDEX "ai_usage_idx_ai_usage_install" ON meldiq."ai_usage" ("install_id", "at");
CREATE INDEX "ai_usage_idx_ai_usage_org" ON meldiq."ai_usage" ("org_id", "at");
CREATE INDEX "ai_usage_idx_ai_usage_job" ON meldiq."ai_usage" ("job_id");
CREATE INDEX "ai_usage_idx_ai_usage_at" ON meldiq."ai_usage" ("at");
ALTER TABLE meldiq."ai_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ai_usage" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ai_usage" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ai_usage" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ai_usage" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."alert_deliveries" (
  "id" bigint NOT NULL,
  "at" bigint NOT NULL,
  "incident_id" text NOT NULL,
  "channel" text NOT NULL,
  "outcome" text NOT NULL,
  "detail" text,
  PRIMARY KEY ("id"),
  CHECK (outcome IN ('sent', 'failed', 'not_configured'))
);
CREATE INDEX "alert_deliveries_idx_alert_deliveries_incident" ON meldiq."alert_deliveries" ("incident_id", "at");
ALTER TABLE meldiq."alert_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."alert_deliveries" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."alert_deliveries" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."alert_deliveries" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."alert_deliveries" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."alert_rules" (
  "key" text NOT NULL,
  "enabled" bigint NOT NULL DEFAULT 1,
  "threshold" double precision NOT NULL,
  "window_minutes" bigint NOT NULL,
  "severity" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("key"),
  CHECK (severity IN ('sev1', 'sev2', 'sev3', 'sev4'))
);
ALTER TABLE meldiq."alert_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."alert_rules" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."alert_rules" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."alert_rules" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."alert_rules" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."alert_state" (
  "key" text NOT NULL,
  "breaching" bigint NOT NULL DEFAULT 0,
  "since" bigint,
  "last_value" double precision,
  "last_eval_at" bigint NOT NULL,
  "incident_id" text,
  PRIMARY KEY ("key")
);
ALTER TABLE meldiq."alert_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."alert_state" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."alert_state" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."alert_state" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."alert_state" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."analytics_daily" (
  "day" text NOT NULL,
  "event" text NOT NULL,
  "dims" text NOT NULL,
  "platform" text NOT NULL,
  "experiment" text NOT NULL DEFAULT '',
  "variant" text NOT NULL DEFAULT '',
  "count" bigint NOT NULL DEFAULT 0,
  "value_count" bigint NOT NULL DEFAULT 0,
  "value_sum" double precision NOT NULL DEFAULT 0,
  PRIMARY KEY ("day", "event", "dims", "platform", "experiment", "variant")
);
ALTER TABLE meldiq."analytics_daily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."analytics_daily" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."analytics_daily" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."analytics_daily" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."analytics_daily" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."api_keys" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "name" text NOT NULL,
  "hint" text NOT NULL,
  "secret_hash" text NOT NULL,
  "scopes" text NOT NULL,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "last_used_at" bigint,
  "revoked_at" bigint,
  PRIMARY KEY ("id")
);
CREATE INDEX "api_keys_idx_api_keys_org" ON meldiq."api_keys" ("org_id");
ALTER TABLE meldiq."api_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."api_keys" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."api_keys" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."api_keys" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."api_keys" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."attachment_uploads" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "device_id" text NOT NULL,
  "conversation_id" text NOT NULL,
  "size" bigint NOT NULL,
  "sha256" text NOT NULL,
  "multipart_id" text,
  "part_size" bigint,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "attachment_uploads_idx_attachment_uploads_expiry" ON meldiq."attachment_uploads" ("expires_at");
CREATE INDEX "attachment_uploads_idx_attachment_uploads_user" ON meldiq."attachment_uploads" ("user_id");
ALTER TABLE meldiq."attachment_uploads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."attachment_uploads" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."attachment_uploads" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."attachment_uploads" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."attachment_uploads" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."attachments" (
  "id" text NOT NULL,
  "conversation_id" text NOT NULL,
  "uploader_user_id" text NOT NULL,
  "size" bigint NOT NULL,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "kept" bigint NOT NULL DEFAULT 0,
  PRIMARY KEY ("id")
);
CREATE INDEX "attachments_idx_attachments_uploader_kept" ON meldiq."attachments" ("uploader_user_id", "kept", "expires_at");
CREATE INDEX "attachments_idx_attachments_uploader" ON meldiq."attachments" ("uploader_user_id", "created_at");
CREATE INDEX "attachments_idx_attachments_expiry" ON meldiq."attachments" ("expires_at");
ALTER TABLE meldiq."attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."attachments" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."attachments" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."attachments" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."attachments" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."audit_log" (
  "id" bigint NOT NULL,
  "at" bigint NOT NULL,
  "actor_id" text,
  "org_id" text,
  "action" text NOT NULL,
  "target" text,
  "detail" text,
  PRIMARY KEY ("id")
);
CREATE INDEX "audit_log_idx_audit_actor" ON meldiq."audit_log" ("actor_id", "at");
CREATE INDEX "audit_log_idx_audit_action" ON meldiq."audit_log" ("action", "at");
CREATE INDEX "audit_log_idx_audit_org" ON meldiq."audit_log" ("org_id", "at");
ALTER TABLE meldiq."audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."audit_log" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."audit_log" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."audit_log" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."audit_log" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."auth_challenges" (
  "nonce" text NOT NULL,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("nonce")
);
ALTER TABLE meldiq."auth_challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."auth_challenges" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."auth_challenges" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."auth_challenges" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."auth_challenges" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_card_charge_attempts" (
  "id" text NOT NULL,
  "charge_id" text NOT NULL,
  "generation" bigint NOT NULL,
  "provider_order_ref" text,
  "provider_capture_ref" text,
  "status" text NOT NULL,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "billing_card_charge_attempts_sqlite_autoindex_bill_5847ff566020" ON meldiq."billing_card_charge_attempts" ("charge_id", "generation");
ALTER TABLE meldiq."billing_card_charge_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_card_charge_attempts" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_card_charge_attempts" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_card_charge_attempts" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_card_charge_attempts" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_card_charges" (
  "id" text NOT NULL,
  "mandate_id" text NOT NULL,
  "period_start" bigint NOT NULL,
  "period_end" bigint NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "generation" bigint NOT NULL DEFAULT 0,
  "request_started_at" bigint,
  "provider_order_ref" text,
  "provider_capture_ref" text,
  "amount_minor" bigint NOT NULL,
  "currency" text NOT NULL,
  "lease_until" bigint,
  "attempts" bigint NOT NULL DEFAULT 0,
  "next_attempt_at" bigint NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "grant_id" text,
  PRIMARY KEY ("id"),
  CHECK (amount_minor>0)
);
CREATE UNIQUE INDEX "billing_card_charges_sqlite_autoindex_billing_card_charges_3" ON meldiq."billing_card_charges" ("mandate_id", "period_start");
CREATE UNIQUE INDEX "billing_card_charges_sqlite_autoindex_billing_card_charges_2" ON meldiq."billing_card_charges" ("provider_capture_ref") WHERE "provider_capture_ref" IS NOT NULL;
ALTER TABLE meldiq."billing_card_charges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_card_charges" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_card_charges" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_card_charges" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_card_charges" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_card_mandates" (
  "id" text NOT NULL,
  "account_id" text NOT NULL,
  "org_id" text,
  "user_id" text,
  "payment_method_id" text NOT NULL,
  "plan_version_id" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "currency" text NOT NULL,
  "amount_minor" bigint NOT NULL,
  "interval_months" bigint NOT NULL DEFAULT 1,
  "consent_version" text NOT NULL,
  "consent_at" bigint NOT NULL,
  "consent_request_id" text NOT NULL,
  "billing_anchor_at" bigint NOT NULL,
  "cycle_index" bigint NOT NULL DEFAULT 0,
  "next_billing_at" bigint NOT NULL,
  "paid_through" bigint,
  "cancel_at" bigint,
  "retry_count" bigint NOT NULL DEFAULT 0,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (amount_minor>0)
);
CREATE INDEX "billing_card_mandates_idx_card_mandates_due" ON meldiq."billing_card_mandates" ("status", "next_billing_at");
CREATE UNIQUE INDEX "billing_card_mandates_sqlite_autoindex_billing_card_mandates_2" ON meldiq."billing_card_mandates" ("account_id", "consent_request_id");
ALTER TABLE meldiq."billing_card_mandates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_card_mandates" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_card_mandates" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_card_mandates" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_card_mandates" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_card_setups" (
  "id" text NOT NULL,
  "account_id" text NOT NULL,
  "request_key" text NOT NULL,
  "provider" text NOT NULL,
  "provider_ref" text,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "completed_at" bigint,
  "payment_method_id" text,
  PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "billing_card_setups_sqlite_autoindex_billing_card_setups_3" ON meldiq."billing_card_setups" ("provider", "provider_ref") WHERE "provider_ref" IS NOT NULL;
CREATE UNIQUE INDEX "billing_card_setups_sqlite_autoindex_billing_card_setups_2" ON meldiq."billing_card_setups" ("account_id", "request_key");
ALTER TABLE meldiq."billing_card_setups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_card_setups" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_card_setups" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_card_setups" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_card_setups" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_checkouts" (
  "id" text NOT NULL,
  "owner_kind" text NOT NULL DEFAULT 'org',
  "org_id" text,
  "account_id" text,
  "user_id" text,
  "started_by_account_id" text,
  "plan_version_id" text NOT NULL,
  "provider" text NOT NULL,
  "provider_session_ref" text,
  "provider_subscription_ref" text,
  "status" text NOT NULL,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "completed_at" bigint,
  "quantity" bigint NOT NULL DEFAULT 1,
  "request_key" text,
  PRIMARY KEY ("id"),
  CHECK (owner_kind IN ('org', 'account')),
  CHECK (status IN ('open', 'completed', 'expired', 'superseded')),
  CHECK (quantity >= 1),
  CHECK ((owner_kind = 'org' AND org_id IS NOT NULL) OR (owner_kind = 'account' AND account_id IS NOT NULL))
);
CREATE UNIQUE INDEX "billing_checkouts_idx_billing_checkout_request" ON meldiq."billing_checkouts" ("provider", "account_id", "request_key") WHERE "request_key" IS NOT NULL;
CREATE INDEX "billing_checkouts_idx_billing_checkouts_open" ON meldiq."billing_checkouts" ("status", "expires_at");
CREATE INDEX "billing_checkouts_idx_billing_checkouts_account" ON meldiq."billing_checkouts" ("account_id", "created_at");
CREATE INDEX "billing_checkouts_idx_billing_checkouts_org" ON meldiq."billing_checkouts" ("org_id", "created_at");
ALTER TABLE meldiq."billing_checkouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_checkouts" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_checkouts" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_checkouts" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_checkouts" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_commerce_orders" (
  "id" text NOT NULL,
  "account_id" text NOT NULL,
  "product" text NOT NULL,
  "product_ref" text NOT NULL,
  "subtotal_minor" bigint NOT NULL,
  "discount_minor" bigint NOT NULL DEFAULT 0,
  "tax_minor" bigint NOT NULL DEFAULT 0,
  "total_minor" bigint NOT NULL,
  "currency" text NOT NULL,
  "coupon_id" text,
  "tax_status" text NOT NULL DEFAULT 'not_collected',
  "provider" text NOT NULL,
  "purchase_ref" text NOT NULL,
  "status" text NOT NULL,
  "entitlement_status" text NOT NULL DEFAULT 'pending',
  "metadata" text NOT NULL DEFAULT '{}',
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (subtotal_minor>=0 AND discount_minor>=0 AND tax_minor>=0 AND total_minor=subtotal_minor-discount_minor+tax_minor)
);
CREATE INDEX "billing_commerce_orders_idx_commerce_orders_owner" ON meldiq."billing_commerce_orders" ("account_id", "created_at");
CREATE UNIQUE INDEX "billing_commerce_orders_sqlite_autoindex_billing_c_2df2d3b52236" ON meldiq."billing_commerce_orders" ("purchase_ref");
ALTER TABLE meldiq."billing_commerce_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_commerce_orders" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_commerce_orders" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_commerce_orders" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_commerce_orders" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_coupon_uses" (
  "id" text NOT NULL,
  "coupon_id" text NOT NULL,
  "order_id" text NOT NULL,
  "account_id" text NOT NULL,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "billing_coupon_uses_sqlite_autoindex_billing_coupon_uses_3" ON meldiq."billing_coupon_uses" ("coupon_id", "account_id");
CREATE UNIQUE INDEX "billing_coupon_uses_sqlite_autoindex_billing_coupon_uses_2" ON meldiq."billing_coupon_uses" ("order_id");
ALTER TABLE meldiq."billing_coupon_uses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_coupon_uses" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_coupon_uses" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_coupon_uses" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_coupon_uses" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_coupons" (
  "id" text NOT NULL,
  "code_hash" text NOT NULL,
  "product" text NOT NULL,
  "kind" text NOT NULL,
  "value" bigint NOT NULL,
  "currency" text NOT NULL DEFAULT 'USD',
  "starts_at" bigint NOT NULL,
  "ends_at" bigint NOT NULL,
  "max_redemptions" bigint NOT NULL,
  "enabled" bigint NOT NULL DEFAULT 0,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (kind IN ('fixed','percent')),
  CHECK (value>0)
);
CREATE UNIQUE INDEX "billing_coupons_sqlite_autoindex_billing_coupons_2" ON meldiq."billing_coupons" ("code_hash");
ALTER TABLE meldiq."billing_coupons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_coupons" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_coupons" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_coupons" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_coupons" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_customers" (
  "id" text NOT NULL,
  "provider" text NOT NULL,
  "owner_kind" text NOT NULL,
  "owner_id" text NOT NULL,
  "provider_customer_ref" text NOT NULL,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (owner_kind IN ('org', 'account'))
);
CREATE UNIQUE INDEX "billing_customers_sqlite_autoindex_billing_customers_3" ON meldiq."billing_customers" ("provider", "provider_customer_ref");
CREATE UNIQUE INDEX "billing_customers_sqlite_autoindex_billing_customers_2" ON meldiq."billing_customers" ("provider", "owner_kind", "owner_id");
ALTER TABLE meldiq."billing_customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_customers" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_customers" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_customers" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_customers" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_grant_notes" (
  "grant_id" text NOT NULL,
  "granted_by" text,
  "note" text,
  "ended_at" bigint,
  "ended_by" text,
  "original_starts_at" bigint,
  "original_ends_at" bigint,
  PRIMARY KEY ("grant_id")
);
ALTER TABLE meldiq."billing_grant_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_grant_notes" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_grant_notes" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_grant_notes" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_grant_notes" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_grants" (
  "id" text NOT NULL,
  "account_id" text NOT NULL,
  "user_id" text,
  "plan_key" text NOT NULL,
  "source" text NOT NULL,
  "reference" text,
  "once_key" text,
  "starts_at" bigint NOT NULL,
  "ends_at" bigint NOT NULL,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (source IN ('signup_trial', 'referral_invitee', 'referral_inviter', 'gift', 'operator')),
  CHECK (ends_at > starts_at)
);
CREATE INDEX "billing_grants_idx_billing_grants_user" ON meldiq."billing_grants" ("user_id") WHERE "user_id" IS NOT NULL;
CREATE INDEX "billing_grants_idx_billing_grants_account" ON meldiq."billing_grants" ("account_id", "ends_at");
CREATE UNIQUE INDEX "billing_grants_idx_billing_grants_reference" ON meldiq."billing_grants" ("account_id", "reference") WHERE "reference" IS NOT NULL;
CREATE UNIQUE INDEX "billing_grants_sqlite_autoindex_billing_grants_2" ON meldiq."billing_grants" ("once_key") WHERE "once_key" IS NOT NULL;
ALTER TABLE meldiq."billing_grants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_grants" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_grants" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_grants" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_grants" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_invoices" (
  "id" text NOT NULL,
  "provider" text NOT NULL,
  "provider_invoice_ref" text NOT NULL,
  "subscription_id" text,
  "owner_kind" text NOT NULL DEFAULT 'org',
  "org_id" text,
  "account_id" text,
  "status" text NOT NULL,
  "currency" text NOT NULL,
  "amount_due_minor" bigint NOT NULL,
  "amount_paid_minor" bigint NOT NULL DEFAULT 0,
  "amount_refunded_minor" bigint NOT NULL DEFAULT 0,
  "tax_minor" bigint,
  "period_start" bigint,
  "period_end" bigint,
  "issued_at" bigint NOT NULL,
  "paid_at" bigint,
  "provider_updated_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (owner_kind IN ('org', 'account')),
  CHECK (status IN ('open', 'paid', 'payment_failed', 'void', 'uncollectible')),
  CHECK (amount_due_minor >= 0),
  CHECK (amount_paid_minor >= 0),
  CHECK (amount_refunded_minor >= 0),
  CHECK ((owner_kind = 'org' AND org_id IS NOT NULL) OR (owner_kind = 'account' AND account_id IS NOT NULL))
);
CREATE INDEX "billing_invoices_idx_billing_invoices_paid" ON meldiq."billing_invoices" ("status", "paid_at");
CREATE INDEX "billing_invoices_idx_billing_invoices_account" ON meldiq."billing_invoices" ("account_id", "issued_at");
CREATE INDEX "billing_invoices_idx_billing_invoices_org" ON meldiq."billing_invoices" ("org_id", "issued_at");
CREATE UNIQUE INDEX "billing_invoices_sqlite_autoindex_billing_invoices_2" ON meldiq."billing_invoices" ("provider", "provider_invoice_ref");
ALTER TABLE meldiq."billing_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_invoices" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_invoices" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_invoices" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_invoices" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_notification_jobs" (
  "id" text NOT NULL,
  "dedupe_key" text NOT NULL,
  "account_id" text,
  "gift_id" text,
  "kind" text NOT NULL,
  "resource_id" text,
  "status" text NOT NULL DEFAULT 'pending',
  "attempts" bigint NOT NULL DEFAULT 0,
  "lease_until" bigint,
  "next_attempt_at" bigint NOT NULL,
  "created_at" bigint NOT NULL,
  "sent_at" bigint,
  "last_error" text,
  PRIMARY KEY ("id")
);
CREATE INDEX "billing_notification_jobs_idx_billing_notifications_due" ON meldiq."billing_notification_jobs" ("status", "next_attempt_at");
CREATE UNIQUE INDEX "billing_notification_jobs_sqlite_autoindex_billing_3e08d851445a" ON meldiq."billing_notification_jobs" ("dedupe_key");
ALTER TABLE meldiq."billing_notification_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_notification_jobs" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_notification_jobs" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_notification_jobs" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_notification_jobs" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_payment_actions" (
  "id" text NOT NULL,
  "provider" text NOT NULL,
  "purchase_id" text NOT NULL,
  "payment_ref" text NOT NULL,
  "actor_account_id" text NOT NULL,
  "reason" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "provider_ref" text,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "billing_payment_actions_idx_billing_actions_status" ON meldiq."billing_payment_actions" ("status", "updated_at");
CREATE UNIQUE INDEX "billing_payment_actions_sqlite_autoindex_billing_p_056f2aaf098e" ON meldiq."billing_payment_actions" ("provider", "purchase_id");
ALTER TABLE meldiq."billing_payment_actions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_payment_actions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_payment_actions" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_payment_actions" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_payment_actions" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_payment_methods" (
  "id" text NOT NULL,
  "account_id" text NOT NULL,
  "provider" text NOT NULL,
  "token_encrypted" text NOT NULL,
  "customer_encrypted" text NOT NULL,
  "brand" text NOT NULL,
  "last_four" text NOT NULL,
  "expiry" text,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "billing_payment_methods_idx_payment_methods_owner" ON meldiq."billing_payment_methods" ("account_id", "status");
ALTER TABLE meldiq."billing_payment_methods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_payment_methods" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_payment_methods" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_payment_methods" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_payment_methods" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_plan_versions" (
  "id" text NOT NULL,
  "plan_id" text NOT NULL,
  "version" bigint NOT NULL,
  "interval" text NOT NULL,
  "currency" text NOT NULL,
  "amount_minor" bigint NOT NULL,
  "provider" text,
  "provider_price_ref" text,
  "trial_days" bigint NOT NULL DEFAULT 0,
  "grace_days" bigint NOT NULL DEFAULT 0,
  "limits" text NOT NULL DEFAULT '{}',
  "notes" text NOT NULL DEFAULT '',
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "published_at" bigint,
  "published_by" text,
  "retired_at" bigint,
  "quota_plan_id" text,
  PRIMARY KEY ("id"),
  CHECK (interval IN ('month', 'year')),
  CHECK (amount_minor >= 0),
  CHECK (trial_days BETWEEN 0 AND 365),
  CHECK (grace_days BETWEEN 0 AND 60)
);
CREATE INDEX "billing_plan_versions_idx_billing_plan_versions_plan" ON meldiq."billing_plan_versions" ("plan_id", "version");
CREATE UNIQUE INDEX "billing_plan_versions_idx_billing_price_ref" ON meldiq."billing_plan_versions" ("provider", "provider_price_ref") WHERE "provider_price_ref" IS NOT NULL;
CREATE UNIQUE INDEX "billing_plan_versions_sqlite_autoindex_billing_plan_versions_2" ON meldiq."billing_plan_versions" ("plan_id", "version");
ALTER TABLE meldiq."billing_plan_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_plan_versions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_plan_versions" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_plan_versions" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_plan_versions" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_plans" (
  "id" text NOT NULL,
  "key" text NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "segment" text NOT NULL DEFAULT '',
  "public" bigint NOT NULL DEFAULT 0,
  "status" text NOT NULL,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "audience" text NOT NULL DEFAULT 'organization',
  PRIMARY KEY ("id"),
  CHECK (status IN ('draft', 'active', 'archived')),
  CHECK (audience IN ('personal', 'organization'))
);
CREATE UNIQUE INDEX "billing_plans_sqlite_autoindex_billing_plans_2" ON meldiq."billing_plans" ("key");
ALTER TABLE meldiq."billing_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_plans" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_plans" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_plans" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_plans" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_play_purchases" (
  "id" text NOT NULL,
  "token_hash" text NOT NULL,
  "purchase_token" text NOT NULL,
  "product_id" text NOT NULL,
  "kind" text NOT NULL,
  "account_id" text NOT NULL,
  "reference" text,
  "state" text NOT NULL,
  "acknowledged" bigint NOT NULL DEFAULT 0,
  "consumed" bigint NOT NULL DEFAULT 0,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "checked_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (kind IN ('plan', 'spark', 'gift')),
  CHECK (acknowledged IN (0, 1)),
  CHECK (consumed IN (0, 1))
);
CREATE INDEX "billing_play_purchases_idx_play_purchases_checked" ON meldiq."billing_play_purchases" ("checked_at");
CREATE INDEX "billing_play_purchases_idx_play_purchases_account" ON meldiq."billing_play_purchases" ("account_id");
CREATE UNIQUE INDEX "billing_play_purchases_sqlite_autoindex_billing_pl_4f5bb8de118e" ON meldiq."billing_play_purchases" ("token_hash");
ALTER TABLE meldiq."billing_play_purchases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_play_purchases" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_play_purchases" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_play_purchases" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_play_purchases" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_program" (
  "id" bigint NOT NULL,
  "enabled" bigint NOT NULL,
  "starts_at" bigint,
  "plan_key" text NOT NULL,
  "days" bigint NOT NULL,
  "referral_days" bigint NOT NULL,
  "referral_cap_days" bigint NOT NULL,
  "claim_window_days" bigint NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (id = 1),
  CHECK (enabled IN (0, 1)),
  CHECK (days BETWEEN 0 AND 365),
  CHECK (referral_days BETWEEN 0 AND 365),
  CHECK (referral_cap_days BETWEEN 0 AND 3650),
  CHECK (claim_window_days BETWEEN 0 AND 90),
  CHECK (enabled = 0 OR starts_at IS NOT NULL)
);
ALTER TABLE meldiq."billing_program" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_program" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_program" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_program" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_program" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_provider_events" (
  "id" text NOT NULL,
  "provider" text NOT NULL,
  "event_ref" text NOT NULL,
  "type" text NOT NULL,
  "provider_created_at" bigint NOT NULL,
  "received_at" bigint NOT NULL,
  "status" text NOT NULL,
  "attempts" bigint NOT NULL DEFAULT 0,
  "next_attempt_at" bigint,
  "last_error" text,
  "processed_at" bigint,
  "subscription_id" text,
  "summary" text NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (status IN ('received', 'processed', 'ignored', 'failed', 'dead'))
);
CREATE INDEX "billing_provider_events_idx_billing_events_received" ON meldiq."billing_provider_events" ("received_at");
CREATE INDEX "billing_provider_events_idx_billing_events_status" ON meldiq."billing_provider_events" ("status", "next_attempt_at");
CREATE UNIQUE INDEX "billing_provider_events_sqlite_autoindex_billing_p_c7520547e76b" ON meldiq."billing_provider_events" ("provider", "event_ref");
ALTER TABLE meldiq."billing_provider_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_provider_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_provider_events" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_provider_events" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_provider_events" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_referral_codes" (
  "account_id" text NOT NULL,
  "code" text NOT NULL,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("account_id")
);
CREATE UNIQUE INDEX "billing_referral_codes_sqlite_autoindex_billing_re_3fdaf88c5e53" ON meldiq."billing_referral_codes" ("code");
ALTER TABLE meldiq."billing_referral_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_referral_codes" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_referral_codes" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_referral_codes" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_referral_codes" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_referrals" (
  "id" text NOT NULL,
  "inviter_account_id" text NOT NULL,
  "invitee_account_id" text NOT NULL,
  "code" text NOT NULL,
  "inviter_days" bigint NOT NULL,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (inviter_days >= 0)
);
CREATE INDEX "billing_referrals_idx_billing_referrals_inviter" ON meldiq."billing_referrals" ("inviter_account_id", "created_at");
CREATE UNIQUE INDEX "billing_referrals_sqlite_autoindex_billing_referrals_2" ON meldiq."billing_referrals" ("invitee_account_id");
ALTER TABLE meldiq."billing_referrals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_referrals" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_referrals" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_referrals" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_referrals" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_subscription_history" (
  "id" bigint NOT NULL,
  "subscription_id" text NOT NULL,
  "at" bigint NOT NULL,
  "from_status" text,
  "to_status" text NOT NULL,
  "plan_version_id" text NOT NULL,
  "source" text NOT NULL,
  "detail" text,
  PRIMARY KEY ("id")
);
CREATE INDEX "billing_subscription_history_idx_billing_history_at" ON meldiq."billing_subscription_history" ("at");
CREATE INDEX "billing_subscription_history_idx_billing_history_subscription" ON meldiq."billing_subscription_history" ("subscription_id", "id");
ALTER TABLE meldiq."billing_subscription_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_subscription_history" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_subscription_history" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_subscription_history" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_subscription_history" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_subscriptions" (
  "id" text NOT NULL,
  "owner_kind" text NOT NULL DEFAULT 'org',
  "org_id" text,
  "account_id" text,
  "owner_user_id" text,
  "billing_user_id" text,
  "billing_account_id" text,
  "plan_version_id" text NOT NULL,
  "status" text NOT NULL,
  "provider" text NOT NULL,
  "provider_customer_ref" text,
  "provider_subscription_ref" text NOT NULL,
  "checkout_id" text,
  "current_period_start" bigint,
  "current_period_end" bigint,
  "trial_end" bigint,
  "cancel_at_period_end" bigint NOT NULL DEFAULT 0,
  "canceled_at" bigint,
  "past_due_since" bigint,
  "provider_updated_at" bigint NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "quantity" bigint NOT NULL DEFAULT 1,
  PRIMARY KEY ("id"),
  CHECK (owner_kind IN ('org', 'account')),
  CHECK (status IN ('incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'paused', 'canceled', 'incomplete_expired')),
  CHECK (quantity >= 0),
  CHECK ((owner_kind = 'org' AND org_id IS NOT NULL) OR (owner_kind = 'account' AND account_id IS NOT NULL))
);
CREATE UNIQUE INDEX "billing_subscriptions_idx_billing_subscriptions_checkout" ON meldiq."billing_subscriptions" ("checkout_id") WHERE "checkout_id" IS NOT NULL;
CREATE INDEX "billing_subscriptions_idx_billing_subscriptions_status" ON meldiq."billing_subscriptions" ("status", "updated_at");
CREATE INDEX "billing_subscriptions_idx_billing_subscriptions_owner_user" ON meldiq."billing_subscriptions" ("owner_user_id") WHERE "owner_user_id" IS NOT NULL;
CREATE INDEX "billing_subscriptions_idx_billing_subscriptions_account" ON meldiq."billing_subscriptions" ("account_id", "updated_at");
CREATE INDEX "billing_subscriptions_idx_billing_subscriptions_org" ON meldiq."billing_subscriptions" ("org_id", "updated_at");
CREATE UNIQUE INDEX "billing_subscriptions_sqlite_autoindex_billing_subscriptions_2" ON meldiq."billing_subscriptions" ("provider", "provider_subscription_ref");
ALTER TABLE meldiq."billing_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_subscriptions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_subscriptions" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_subscriptions" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_subscriptions" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."billing_webhook_rejections" (
  "day" text NOT NULL,
  "provider" text NOT NULL,
  "reason" text NOT NULL,
  "count" bigint NOT NULL,
  PRIMARY KEY ("day", "provider", "reason")
);
ALTER TABLE meldiq."billing_webhook_rejections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_webhook_rejections" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_webhook_rejections" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."billing_webhook_rejections" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_webhook_rejections" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."bot_afk" (
  "org_id" text NOT NULL,
  "user_id" text NOT NULL,
  "reason" text NOT NULL,
  "since" bigint NOT NULL,
  "notified" text NOT NULL DEFAULT '[]',
  PRIMARY KEY ("org_id", "user_id")
);
CREATE INDEX "bot_afk_idx_bot_afk_user" ON meldiq."bot_afk" ("user_id");
ALTER TABLE meldiq."bot_afk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."bot_afk" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."bot_afk" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."bot_afk" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."bot_afk" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."bot_alert_watches" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "source" text NOT NULL,
  "yt_channel_id" text NOT NULL,
  "creator" text NOT NULL,
  "uploads_id" text NOT NULL,
  "channel_id" text NOT NULL,
  "role_id" text,
  "message" text,
  "seen" text NOT NULL DEFAULT '[]',
  "checked_at" bigint,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bot_alert_watches_idx_bot_alert_watches_unique" ON meldiq."bot_alert_watches" ("org_id", "yt_channel_id", "channel_id");
CREATE INDEX "bot_alert_watches_idx_bot_alert_watches_org" ON meldiq."bot_alert_watches" ("org_id");
ALTER TABLE meldiq."bot_alert_watches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."bot_alert_watches" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."bot_alert_watches" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."bot_alert_watches" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."bot_alert_watches" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."bot_giveaways" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "channel_id" text NOT NULL,
  "message_id" text,
  "prize" text NOT NULL,
  "winners" bigint NOT NULL,
  "host_id" text NOT NULL,
  "required_role_id" text,
  "entrants" bigint NOT NULL DEFAULT 0,
  "ends_at" bigint NOT NULL,
  "ended_at" bigint,
  "winner_ids" text NOT NULL DEFAULT '[]',
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "bot_giveaways_idx_bot_giveaways_message" ON meldiq."bot_giveaways" ("message_id");
CREATE INDEX "bot_giveaways_idx_bot_giveaways_due" ON meldiq."bot_giveaways" ("ended_at", "ends_at");
CREATE INDEX "bot_giveaways_idx_bot_giveaways_org" ON meldiq."bot_giveaways" ("org_id");
ALTER TABLE meldiq."bot_giveaways" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."bot_giveaways" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."bot_giveaways" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."bot_giveaways" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."bot_giveaways" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."bot_levels" (
  "org_id" text NOT NULL,
  "user_id" text NOT NULL,
  "xp" bigint NOT NULL,
  "last_xp_at" bigint NOT NULL,
  PRIMARY KEY ("org_id", "user_id")
);
CREATE INDEX "bot_levels_idx_bot_levels_user" ON meldiq."bot_levels" ("user_id");
CREATE INDEX "bot_levels_idx_bot_levels_xp" ON meldiq."bot_levels" ("org_id", "xp");
ALTER TABLE meldiq."bot_levels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."bot_levels" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."bot_levels" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."bot_levels" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."bot_levels" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."bot_listings" (
  "bot_id" text NOT NULL,
  "owner_id" text NOT NULL,
  "listed" bigint NOT NULL,
  "category" text NOT NULL,
  "description" text NOT NULL,
  "listed_at" bigint,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("bot_id"),
  CHECK (listed IN (0, 1)),
  CHECK (category IN ('moderation', 'fun', 'games', 'utility', 'music', 'economy', 'social', 'ai', 'other'))
);
CREATE INDEX "bot_listings_idx_bot_listings_listed" ON meldiq."bot_listings" ("listed");
ALTER TABLE meldiq."bot_listings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."bot_listings" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."bot_listings" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."bot_listings" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."bot_listings" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."bot_runtime_events" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "bot_key" text NOT NULL,
  "kind" text NOT NULL,
  "outcome" text NOT NULL,
  "at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (outcome IN ('ok','failed'))
);
CREATE INDEX "bot_runtime_events_idx_bot_runtime_events_scope" ON meldiq."bot_runtime_events" ("org_id", "bot_key", "at", "id");
ALTER TABLE meldiq."bot_runtime_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."bot_runtime_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."bot_runtime_events" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."bot_runtime_events" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."bot_runtime_events" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."bot_starboard" (
  "message_id" text NOT NULL,
  "org_id" text NOT NULL,
  "channel_id" text NOT NULL,
  "star_channel_id" text NOT NULL,
  "star_message_id" text,
  "stars" bigint NOT NULL,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("message_id")
);
CREATE INDEX "bot_starboard_idx_bot_starboard_org" ON meldiq."bot_starboard" ("org_id");
ALTER TABLE meldiq."bot_starboard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."bot_starboard" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."bot_starboard" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."bot_starboard" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."bot_starboard" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."bot_wordy_games" (
  "org_id" text NOT NULL,
  "day" text NOT NULL,
  "user_id" text NOT NULL,
  "guesses" text NOT NULL DEFAULT '[]',
  "solved" bigint NOT NULL DEFAULT 0,
  "started_at" bigint NOT NULL,
  "finished_at" bigint,
  PRIMARY KEY ("org_id", "day", "user_id"),
  CHECK (solved IN (0, 1))
);
CREATE INDEX "bot_wordy_games_idx_bot_wordy_games_day" ON meldiq."bot_wordy_games" ("day");
CREATE INDEX "bot_wordy_games_idx_bot_wordy_games_user" ON meldiq."bot_wordy_games" ("user_id");
ALTER TABLE meldiq."bot_wordy_games" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."bot_wordy_games" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."bot_wordy_games" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."bot_wordy_games" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."bot_wordy_games" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."bot_wordy_recaps" (
  "org_id" text NOT NULL,
  "day" text NOT NULL,
  "posted_at" bigint NOT NULL,
  PRIMARY KEY ("org_id", "day")
);
ALTER TABLE meldiq."bot_wordy_recaps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."bot_wordy_recaps" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."bot_wordy_recaps" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."bot_wordy_recaps" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."bot_wordy_recaps" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."bot_wordy_stats" (
  "org_id" text NOT NULL,
  "user_id" text NOT NULL,
  "played" bigint NOT NULL,
  "won" bigint NOT NULL,
  "streak" bigint NOT NULL,
  "best_streak" bigint NOT NULL,
  "last_day" text NOT NULL,
  "last_won_day" text,
  "distribution" text NOT NULL,
  PRIMARY KEY ("org_id", "user_id")
);
CREATE INDEX "bot_wordy_stats_idx_bot_wordy_stats_won" ON meldiq."bot_wordy_stats" ("org_id", "won");
CREATE INDEX "bot_wordy_stats_idx_bot_wordy_stats_user" ON meldiq."bot_wordy_stats" ("user_id");
ALTER TABLE meldiq."bot_wordy_stats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."bot_wordy_stats" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."bot_wordy_stats" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."bot_wordy_stats" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."bot_wordy_stats" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."branch_members" (
  "branch_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role" text NOT NULL,
  "joined_at" bigint NOT NULL,
  PRIMARY KEY ("branch_id", "user_id"),
  CHECK (role IN ('MANAGER','MEMBER'))
);
CREATE INDEX "branch_members_idx_branch_members_user" ON meldiq."branch_members" ("user_id");
ALTER TABLE meldiq."branch_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."branch_members" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."branch_members" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."branch_members" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."branch_members" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."branches" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "location" text,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "archived_at" bigint,
  PRIMARY KEY ("id")
);
CREATE INDEX "branches_idx_branches_org" ON meldiq."branches" ("org_id");
ALTER TABLE meldiq."branches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."branches" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."branches" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."branches" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."branches" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."bug_reports" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "summary" text NOT NULL,
  "details" text NOT NULL,
  "page" text,
  "client" text,
  "status" text NOT NULL DEFAULT 'open',
  "staff_note" text,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (status IN ('open', 'confirmed', 'fixed', 'not_a_bug', 'duplicate'))
);
CREATE INDEX "bug_reports_idx_bug_reports_status" ON meldiq."bug_reports" ("status", "created_at");
CREATE INDEX "bug_reports_idx_bug_reports_user" ON meldiq."bug_reports" ("user_id", "created_at");
ALTER TABLE meldiq."bug_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."bug_reports" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."bug_reports" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."bug_reports" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."bug_reports" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."call_hands" (
  "call_id" text NOT NULL,
  "user_id" text NOT NULL,
  "raised_at" bigint NOT NULL,
  PRIMARY KEY ("call_id", "user_id")
);
ALTER TABLE meldiq."call_hands" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."call_hands" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."call_hands" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."call_hands" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."call_hands" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."call_participants" (
  "call_id" text NOT NULL,
  "user_id" text NOT NULL,
  "device_id" text NOT NULL,
  "joined_at" bigint NOT NULL,
  "left_at" bigint,
  PRIMARY KEY ("call_id", "device_id")
);
ALTER TABLE meldiq."call_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."call_participants" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."call_participants" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."call_participants" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."call_participants" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."calls" (
  "id" text NOT NULL,
  "conversation_id" text NOT NULL,
  "room_name" text NOT NULL,
  "created_by" text NOT NULL,
  "video" bigint NOT NULL DEFAULT 0,
  "state" text NOT NULL,
  "created_at" bigint NOT NULL,
  "answered_at" bigint,
  "ended_at" bigint,
  "end_reason" text,
  "alerted_at" bigint,
  "host_server_id" text,
  "room" bigint NOT NULL DEFAULT 0,
  PRIMARY KEY ("id"),
  CHECK (state IN ('RINGING','ACTIVE','ENDED'))
);
CREATE INDEX "calls_idx_calls_conversation" ON meldiq."calls" ("conversation_id", "state");
CREATE UNIQUE INDEX "calls_sqlite_autoindex_calls_2" ON meldiq."calls" ("room_name");
ALTER TABLE meldiq."calls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."calls" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."calls" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."calls" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."calls" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."channel_categories" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "name" text NOT NULL,
  "position" bigint NOT NULL,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "channel_categories_idx_channel_categories_org" ON meldiq."channel_categories" ("org_id", "position");
ALTER TABLE meldiq."channel_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."channel_categories" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."channel_categories" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."channel_categories" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."channel_categories" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."channel_options" (
  "conversation_id" text NOT NULL,
  "org_id" text NOT NULL,
  "text_only" bigint NOT NULL DEFAULT 0,
  "no_gifs" bigint NOT NULL DEFAULT 0,
  "stage" bigint NOT NULL DEFAULT 0,
  "read_only" bigint NOT NULL DEFAULT 0,
  "poster_role_ids" text NOT NULL DEFAULT '[]',
  "updated_by" text NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("conversation_id"),
  CHECK (text_only IN (0, 1)),
  CHECK (no_gifs IN (0, 1)),
  CHECK (stage IN (0, 1)),
  CHECK (read_only IN (0, 1))
);
CREATE INDEX "channel_options_channel_options_org" ON meldiq."channel_options" ("org_id");
ALTER TABLE meldiq."channel_options" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."channel_options" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."channel_options" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."channel_options" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."channel_options" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."channel_overwrites" (
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "org_id" text NOT NULL,
  "subject" text NOT NULL,
  "allow" text NOT NULL,
  "deny" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("target_type", "target_id", "subject"),
  CHECK (target_type IN ('category', 'channel'))
);
CREATE INDEX "channel_overwrites_idx_channel_overwrites_org" ON meldiq."channel_overwrites" ("org_id");
ALTER TABLE meldiq."channel_overwrites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."channel_overwrites" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."channel_overwrites" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."channel_overwrites" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."channel_overwrites" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."channel_webhooks" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "channel_id" text NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "avatar_rev" bigint,
  "token_hash" text NOT NULL,
  "token_rotated_at" bigint NOT NULL,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "last_used_at" bigint,
  PRIMARY KEY ("id")
);
CREATE INDEX "channel_webhooks_idx_channel_webhooks_org" ON meldiq."channel_webhooks" ("org_id");
CREATE INDEX "channel_webhooks_idx_channel_webhooks_channel" ON meldiq."channel_webhooks" ("channel_id");
CREATE UNIQUE INDEX "channel_webhooks_sqlite_autoindex_channel_webhooks_2" ON meldiq."channel_webhooks" ("token_hash");
ALTER TABLE meldiq."channel_webhooks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."channel_webhooks" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."channel_webhooks" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."channel_webhooks" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."channel_webhooks" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."community_discovery" (
  "org_id" text NOT NULL,
  "discoverable" bigint NOT NULL DEFAULT 1,
  "blurb" text,
  "tags" text NOT NULL DEFAULT '[]',
  "removed_at" bigint,
  "removed_reason" text,
  "official" bigint NOT NULL DEFAULT 0,
  "updated_by" text NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("org_id"),
  CHECK (discoverable IN (0, 1)),
  CHECK (official IN (0, 1))
);
ALTER TABLE meldiq."community_discovery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_discovery" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_discovery" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_discovery" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_discovery" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."community_expressions" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "kind" text NOT NULL,
  "name" text NOT NULL,
  "mime" text NOT NULL,
  "animated" bigint NOT NULL DEFAULT 0,
  "sha256" text NOT NULL,
  "size" bigint NOT NULL,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (kind IN ('emoji', 'sticker'))
);
CREATE INDEX "community_expressions_community_expressions_org" ON meldiq."community_expressions" ("org_id", "kind", "name");
ALTER TABLE meldiq."community_expressions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_expressions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_expressions" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_expressions" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_expressions" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."community_lobbies" (
  "org_id" text NOT NULL,
  "settings" text NOT NULL,
  "rev" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "updated_by" text NOT NULL,
  PRIMARY KEY ("org_id")
);
ALTER TABLE meldiq."community_lobbies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_lobbies" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_lobbies" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_lobbies" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_lobbies" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."community_lobby_feeds" (
  "org_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "created_at" bigint NOT NULL,
  "created_by" text NOT NULL,
  "last_post_at" bigint,
  PRIMARY KEY ("org_id")
);
CREATE UNIQUE INDEX "community_lobby_feeds_sqlite_autoindex_community_lobby_feeds_2" ON meldiq."community_lobby_feeds" ("token_hash");
ALTER TABLE meldiq."community_lobby_feeds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_lobby_feeds" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_lobby_feeds" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_lobby_feeds" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_lobby_feeds" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."community_lobby_posts" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "title" text,
  "text" text,
  "url" text,
  "image" text,
  "posted_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "community_lobby_posts_idx_community_lobby_posts_org" ON meldiq."community_lobby_posts" ("org_id", "posted_at");
ALTER TABLE meldiq."community_lobby_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_lobby_posts" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_lobby_posts" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_lobby_posts" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_lobby_posts" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."community_lobby_seen" (
  "org_id" text NOT NULL,
  "user_id" text NOT NULL,
  "seen_at" bigint NOT NULL,
  PRIMARY KEY ("org_id", "user_id")
);
CREATE INDEX "community_lobby_seen_idx_community_lobby_seen_user" ON meldiq."community_lobby_seen" ("user_id");
ALTER TABLE meldiq."community_lobby_seen" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_lobby_seen" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_lobby_seen" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_lobby_seen" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_lobby_seen" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."community_member_defaults" (
  "org_id" text NOT NULL,
  "added" text NOT NULL,
  "removed" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("org_id")
);
ALTER TABLE meldiq."community_member_defaults" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_member_defaults" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_member_defaults" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_member_defaults" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_member_defaults" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."community_migration_runs" (
  "source_type" text NOT NULL,
  "source_id" text NOT NULL,
  "org_id" text NOT NULL,
  "role_id" text,
  "category_id" text,
  "channels" bigint NOT NULL,
  "members" bigint NOT NULL,
  "converted_at" bigint NOT NULL,
  PRIMARY KEY ("source_type", "source_id"),
  CHECK (source_type IN ('branch', 'team'))
);
ALTER TABLE meldiq."community_migration_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_migration_runs" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_migration_runs" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_migration_runs" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_migration_runs" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."community_onboarding" (
  "org_id" text NOT NULL,
  "enabled" bigint NOT NULL DEFAULT 0,
  "prompts" text NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("org_id")
);
ALTER TABLE meldiq."community_onboarding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_onboarding" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_onboarding" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_onboarding" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_onboarding" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."community_profiles" (
  "org_id" text NOT NULL,
  "user_id" text NOT NULL,
  "profile" text NOT NULL,
  "rev" bigint NOT NULL DEFAULT 1,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("org_id", "user_id")
);
ALTER TABLE meldiq."community_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_profiles" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_profiles" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_profiles" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_profiles" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."community_safety" (
  "org_id" text NOT NULL,
  "verification_level" text NOT NULL DEFAULT 'none',
  "new_account_gate" text NOT NULL DEFAULT 'off',
  "raid_protection" bigint NOT NULL DEFAULT 1,
  "locked_until" bigint,
  "lock_reason" text,
  "locked_by" text,
  "updated_at" bigint NOT NULL,
  "updated_by" text,
  PRIMARY KEY ("org_id"),
  CHECK (verification_level IN ('none', 'low', 'medium', 'high')),
  CHECK (new_account_gate IN ('off', '10m', '1h', '1d', '7d')),
  CHECK (raid_protection IN (0, 1)),
  CHECK (lock_reason IN ('manual', 'raid'))
);
ALTER TABLE meldiq."community_safety" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_safety" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_safety" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_safety" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_safety" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."community_settings" (
  "org_id" text NOT NULL,
  "background" text,
  "links" text NOT NULL DEFAULT '[]',
  "onboarding_required" bigint NOT NULL DEFAULT 0,
  "onboarding_required_since" bigint,
  "start_channel_id" text,
  "updated_at" bigint NOT NULL,
  "updated_by" text NOT NULL,
  PRIMARY KEY ("org_id")
);
ALTER TABLE meldiq."community_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_settings" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_settings" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_settings" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_settings" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."community_standard_invites" (
  "org_id" text NOT NULL,
  "user_id" text NOT NULL,
  "invite_id" text NOT NULL,
  "code" text NOT NULL,
  PRIMARY KEY ("org_id", "user_id")
);
CREATE INDEX "community_standard_invites_idx_community_standard_invites_user" ON meldiq."community_standard_invites" ("user_id");
ALTER TABLE meldiq."community_standard_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_standard_invites" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_standard_invites" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_standard_invites" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_standard_invites" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."community_templates" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "snapshot" text NOT NULL,
  "uses" bigint NOT NULL DEFAULT 0,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "community_templates_sqlite_autoindex_community_templates_3" ON meldiq."community_templates" ("code");
CREATE UNIQUE INDEX "community_templates_sqlite_autoindex_community_templates_2" ON meldiq."community_templates" ("org_id");
ALTER TABLE meldiq."community_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_templates" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_templates" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_templates" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_templates" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."community_tickets" (
  "org_id" text NOT NULL,
  "enabled" bigint NOT NULL,
  "max_open" bigint NOT NULL,
  "next_number" bigint NOT NULL DEFAULT 1,
  "poster_id" text,
  "updated_by" text NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("org_id"),
  CHECK (enabled IN (0, 1)),
  CHECK (max_open BETWEEN 1 AND 10)
);
ALTER TABLE meldiq."community_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_tickets" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_tickets" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_tickets" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_tickets" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."community_vanity_invites" (
  "slug" text NOT NULL,
  "org_id" text NOT NULL,
  "invite_id" text NOT NULL,
  "claimed_by" text NOT NULL,
  "claimed_at" bigint NOT NULL,
  PRIMARY KEY ("slug")
);
CREATE UNIQUE INDEX "community_vanity_invites_sqlite_autoindex_communit_f1beaf878403" ON meldiq."community_vanity_invites" ("org_id");
ALTER TABLE meldiq."community_vanity_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_vanity_invites" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_vanity_invites" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_vanity_invites" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_vanity_invites" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."community_voice_bans" (
  "org_id" text NOT NULL,
  "user_id" text NOT NULL,
  "reason" text,
  "banned_by" text NOT NULL,
  "banned_at" bigint NOT NULL,
  PRIMARY KEY ("org_id", "user_id")
);
CREATE INDEX "community_voice_bans_idx_community_voice_bans_user" ON meldiq."community_voice_bans" ("user_id");
ALTER TABLE meldiq."community_voice_bans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_voice_bans" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_voice_bans" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_voice_bans" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_voice_bans" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."community_voice_mutes" (
  "org_id" text NOT NULL,
  "user_id" text NOT NULL,
  "muted_by" text NOT NULL,
  "muted_at" bigint NOT NULL,
  PRIMARY KEY ("org_id", "user_id")
);
CREATE INDEX "community_voice_mutes_idx_community_voice_mutes_user" ON meldiq."community_voice_mutes" ("user_id");
ALTER TABLE meldiq."community_voice_mutes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_voice_mutes" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_voice_mutes" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_voice_mutes" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_voice_mutes" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."connections" (
  "pair" text NOT NULL,
  "a" text NOT NULL,
  "b" text NOT NULL,
  "state" text NOT NULL,
  "requested_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "accepted_at" bigint,
  PRIMARY KEY ("pair"),
  CHECK (state IN ('pending', 'accepted'))
);
CREATE INDEX "connections_connections_b" ON meldiq."connections" ("b", "state");
CREATE INDEX "connections_connections_a" ON meldiq."connections" ("a", "state");
ALTER TABLE meldiq."connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."connections" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."connections" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."connections" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."connections" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."conversation_members" (
  "conversation_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role" text NOT NULL,
  "joined_at" bigint NOT NULL,
  "last_post_at" bigint,
  PRIMARY KEY ("conversation_id", "user_id"),
  CHECK (role IN ('ADMIN','MEMBER'))
);
CREATE INDEX "conversation_members_idx_conv_members_user" ON meldiq."conversation_members" ("user_id");
ALTER TABLE meldiq."conversation_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."conversation_members" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."conversation_members" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."conversation_members" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."conversation_members" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."conversations" (
  "id" text NOT NULL,
  "type" text NOT NULL,
  "org_id" text,
  "scope" text,
  "scope_id" text,
  "kind" text,
  "name" text,
  "topic" text,
  "dm_key" text,
  "auto_join" bigint NOT NULL DEFAULT 0,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "archived_at" bigint,
  "voice" bigint NOT NULL DEFAULT 0,
  "category_id" text,
  "position" bigint NOT NULL DEFAULT 0,
  "format" text NOT NULL DEFAULT 'text',
  "forum_tags" text,
  "slowmode_sec" bigint NOT NULL DEFAULT 0,
  "photo_rev" bigint,
  "guidelines" text,
  PRIMARY KEY ("id"),
  CHECK (type IN ('DM','GROUP','CHANNEL')),
  CHECK (scope IN ('ORG','BRANCH','TEAM')),
  CHECK (kind IN ('PUBLIC','PRIVATE','ANNOUNCEMENT')),
  CHECK (format IN ('text', 'forum'))
);
CREATE INDEX "conversations_idx_conversations_category" ON meldiq."conversations" ("category_id");
CREATE INDEX "conversations_idx_conversations_org" ON meldiq."conversations" ("org_id");
CREATE UNIQUE INDEX "conversations_sqlite_autoindex_conversations_2" ON meldiq."conversations" ("dm_key") WHERE "dm_key" IS NOT NULL;
ALTER TABLE meldiq."conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."conversations" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."conversations" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."conversations" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."conversations" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."delivery_queue" (
  "id" bigint NOT NULL,
  "recipient_device_id" text NOT NULL,
  "kind" text NOT NULL,
  "conversation_id" text NOT NULL,
  "message_id" text NOT NULL,
  "sender_user_id" text NOT NULL,
  "sender_device_id" text NOT NULL,
  "payload" text NOT NULL,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (kind IN ('envelope','receipt','message'))
);
CREATE UNIQUE INDEX "delivery_queue_idx_queue_unique" ON meldiq."delivery_queue" ("recipient_device_id", "kind", "message_id", "sender_device_id");
CREATE INDEX "delivery_queue_idx_queue_expiry" ON meldiq."delivery_queue" ("expires_at");
CREATE INDEX "delivery_queue_idx_queue_recipient" ON meldiq."delivery_queue" ("recipient_device_id", "id");
ALTER TABLE meldiq."delivery_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."delivery_queue" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."delivery_queue" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."delivery_queue" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."delivery_queue" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."departments" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "branch_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "departments_idx_departments_branch" ON meldiq."departments" ("branch_id");
ALTER TABLE meldiq."departments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."departments" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."departments" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."departments" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."departments" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."devices" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "signing_key" text NOT NULL,
  "encryption_key" text NOT NULL,
  "certificate" text NOT NULL,
  "created_at" bigint NOT NULL,
  "last_seen_at" bigint,
  "revoked_at" bigint,
  PRIMARY KEY ("id")
);
CREATE INDEX "devices_idx_devices_user" ON meldiq."devices" ("user_id");
CREATE UNIQUE INDEX "devices_sqlite_autoindex_devices_2" ON meldiq."devices" ("signing_key");
ALTER TABLE meldiq."devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."devices" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."devices" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."devices" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."devices" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."discord_connections" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "guild_id" text NOT NULL,
  "guild_name" text NOT NULL,
  "discord_user_id" text NOT NULL,
  "verified_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "discord_connections_idx_discord_connections_user" ON meldiq."discord_connections" ("user_id", "expires_at");
ALTER TABLE meldiq."discord_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."discord_connections" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."discord_connections" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."discord_connections" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."discord_connections" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."discord_import_items" (
  "import_id" text NOT NULL,
  "source_key" text NOT NULL,
  "position" bigint NOT NULL,
  "kind" text NOT NULL,
  "name" text NOT NULL,
  "spec" text NOT NULL,
  "status" text NOT NULL,
  "target_id" text,
  "note" text,
  PRIMARY KEY ("import_id", "source_key")
);
ALTER TABLE meldiq."discord_import_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."discord_import_items" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."discord_import_items" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."discord_import_items" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."discord_import_items" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."discord_imports" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "guild_id" text NOT NULL,
  "guild_name" text NOT NULL,
  "org_id" text,
  "new_name" text,
  "options" text NOT NULL,
  "status" text NOT NULL,
  "error" text,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "finished_at" bigint,
  PRIMARY KEY ("id")
);
CREATE INDEX "discord_imports_idx_discord_imports_user" ON meldiq."discord_imports" ("user_id", "created_at");
ALTER TABLE meldiq."discord_imports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."discord_imports" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."discord_imports" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."discord_imports" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."discord_imports" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."discord_oauth_states" (
  "state_hash" text NOT NULL,
  "user_id" text NOT NULL,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("state_hash")
);
CREATE INDEX "discord_oauth_states_idx_discord_oauth_states_expiry" ON meldiq."discord_oauth_states" ("expires_at");
ALTER TABLE meldiq."discord_oauth_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."discord_oauth_states" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."discord_oauth_states" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."discord_oauth_states" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."discord_oauth_states" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."discovery_boosts" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "tier" text NOT NULL,
  "state" text NOT NULL,
  "source" text NOT NULL,
  "price_cents" bigint NOT NULL,
  "starts_at" bigint NOT NULL,
  "ends_at" bigint NOT NULL,
  "note" text,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (tier IN ('boost', 'super', 'mega')),
  CHECK (state IN ('pending', 'active', 'cancelled')),
  CHECK (source IN ('grant', 'purchase'))
);
CREATE INDEX "discovery_boosts_idx_discovery_boosts_ends" ON meldiq."discovery_boosts" ("ends_at");
CREATE INDEX "discovery_boosts_idx_discovery_boosts_org" ON meldiq."discovery_boosts" ("org_id");
ALTER TABLE meldiq."discovery_boosts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."discovery_boosts" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."discovery_boosts" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."discovery_boosts" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."discovery_boosts" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."discovery_clicks" (
  "org_id" text NOT NULL,
  "user_id" text NOT NULL,
  "at" bigint NOT NULL,
  PRIMARY KEY ("org_id", "user_id")
);
CREATE INDEX "discovery_clicks_idx_discovery_clicks_user" ON meldiq."discovery_clicks" ("user_id");
ALTER TABLE meldiq."discovery_clicks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."discovery_clicks" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."discovery_clicks" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."discovery_clicks" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."discovery_clicks" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."discovery_visits" (
  "day" text NOT NULL,
  "user_id" text NOT NULL,
  PRIMARY KEY ("day", "user_id")
);
CREATE INDEX "discovery_visits_idx_discovery_visits_user" ON meldiq."discovery_visits" ("user_id");
ALTER TABLE meldiq."discovery_visits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."discovery_visits" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."discovery_visits" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."discovery_visits" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."discovery_visits" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."dm_requests" (
  "conversation_id" text NOT NULL,
  "recipient" text NOT NULL,
  "sender" text NOT NULL,
  "state" text NOT NULL,
  "sent" bigint NOT NULL DEFAULT 0,
  "created_at" bigint NOT NULL,
  "answered_at" bigint,
  PRIMARY KEY ("conversation_id"),
  CHECK (state IN ('pending', 'declined'))
);
CREATE INDEX "dm_requests_dm_requests_sender" ON meldiq."dm_requests" ("sender");
CREATE INDEX "dm_requests_dm_requests_recipient" ON meldiq."dm_requests" ("recipient", "state", "created_at");
ALTER TABLE meldiq."dm_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."dm_requests" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."dm_requests" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."dm_requests" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."dm_requests" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."document_comments" (
  "id" text NOT NULL,
  "document_id" text NOT NULL,
  "author_id" text NOT NULL,
  "body" text NOT NULL,
  "quote" text,
  "resolved_at" bigint,
  "resolved_by" text,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "document_comments_idx_document_comments_doc" ON meldiq."document_comments" ("document_id", "created_at");
ALTER TABLE meldiq."document_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."document_comments" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."document_comments" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."document_comments" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."document_comments" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."document_members" (
  "document_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role" text NOT NULL,
  "added_by" text NOT NULL,
  "added_at" bigint NOT NULL,
  PRIMARY KEY ("document_id", "user_id"),
  CHECK (role IN ('view','comment','edit','admin'))
);
CREATE INDEX "document_members_idx_document_members_user" ON meldiq."document_members" ("user_id");
ALTER TABLE meldiq."document_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."document_members" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."document_members" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."document_members" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."document_members" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."document_versions" (
  "id" text NOT NULL,
  "document_id" text NOT NULL,
  "rev" bigint NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "author_id" text NOT NULL,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "document_versions_sqlite_autoindex_document_versions_2" ON meldiq."document_versions" ("document_id", "rev");
ALTER TABLE meldiq."document_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."document_versions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."document_versions" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."document_versions" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."document_versions" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."documents" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "access" text NOT NULL,
  "default_role" text NOT NULL,
  "channel_id" text,
  "created_by" text NOT NULL,
  "updated_by" text NOT NULL,
  "rev" bigint NOT NULL DEFAULT 1,
  "archived_at" bigint,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (access IN ('workspace','channel','restricted')),
  CHECK (default_role IN ('view','comment','edit'))
);
CREATE INDEX "documents_idx_documents_channel" ON meldiq."documents" ("channel_id");
CREATE INDEX "documents_idx_documents_org" ON meldiq."documents" ("org_id", "updated_at");
ALTER TABLE meldiq."documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."documents" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."documents" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."documents" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."documents" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."fcm_tokens" (
  "device_id" text NOT NULL,
  "token" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "last_wake_at" bigint,
  "failing_since" bigint,
  PRIMARY KEY ("device_id")
);
CREATE UNIQUE INDEX "fcm_tokens_sqlite_autoindex_fcm_tokens_2" ON meldiq."fcm_tokens" ("token");
ALTER TABLE meldiq."fcm_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."fcm_tokens" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."fcm_tokens" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."fcm_tokens" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."fcm_tokens" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."federation_blocks" (
  "server_id" text NOT NULL,
  "reason" text,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("server_id")
);
ALTER TABLE meldiq."federation_blocks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."federation_blocks" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."federation_blocks" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."federation_blocks" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."federation_blocks" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."federation_domains" (
  "domain" text NOT NULL,
  "server_id" text NOT NULL,
  "verified_at" bigint NOT NULL,
  PRIMARY KEY ("domain")
);
ALTER TABLE meldiq."federation_domains" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."federation_domains" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."federation_domains" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."federation_domains" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."federation_domains" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."federation_inbox" (
  "item_key" text NOT NULL,
  "peer_server_id" text NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("item_key")
);
CREATE INDEX "federation_inbox_idx_fed_inbox_expiry" ON meldiq."federation_inbox" ("expires_at");
ALTER TABLE meldiq."federation_inbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."federation_inbox" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."federation_inbox" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."federation_inbox" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."federation_inbox" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."federation_nonces" (
  "nonce" text NOT NULL,
  "peer_server_id" text NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("nonce")
);
ALTER TABLE meldiq."federation_nonces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."federation_nonces" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."federation_nonces" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."federation_nonces" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."federation_nonces" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."federation_outbox" (
  "id" bigint NOT NULL,
  "peer_server_id" text NOT NULL,
  "kind" text NOT NULL,
  "item_key" text NOT NULL,
  "body" text NOT NULL,
  "size" bigint NOT NULL,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "attempts" bigint NOT NULL DEFAULT 0,
  "next_attempt_at" bigint NOT NULL,
  "last_error" text,
  PRIMARY KEY ("id"),
  CHECK (kind IN ('envelope','receipt','attachment'))
);
CREATE INDEX "federation_outbox_idx_fed_outbox_expiry" ON meldiq."federation_outbox" ("expires_at");
CREATE INDEX "federation_outbox_idx_fed_outbox_peer" ON meldiq."federation_outbox" ("peer_server_id", "id");
CREATE UNIQUE INDEX "federation_outbox_sqlite_autoindex_federation_outbox_1" ON meldiq."federation_outbox" ("item_key");
ALTER TABLE meldiq."federation_outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."federation_outbox" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."federation_outbox" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."federation_outbox" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."federation_outbox" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."federation_peers" (
  "server_id" text NOT NULL,
  "domain" text NOT NULL,
  "descriptor" text NOT NULL,
  "seq" bigint NOT NULL,
  "state" text NOT NULL,
  "final" text,
  "verified_at" bigint NOT NULL,
  "agreeing" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("server_id")
);
ALTER TABLE meldiq."federation_peers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."federation_peers" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."federation_peers" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."federation_peers" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."federation_peers" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."history_accounts" (
  "user_id" text NOT NULL,
  "next_seq" bigint NOT NULL,
  "items" bigint NOT NULL,
  "bytes" bigint NOT NULL,
  PRIMARY KEY ("user_id")
);
ALTER TABLE meldiq."history_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."history_accounts" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."history_accounts" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."history_accounts" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."history_accounts" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."history_items" (
  "user_id" text NOT NULL,
  "tag" text NOT NULL,
  "conv_tag" text NOT NULL,
  "seq" bigint NOT NULL,
  "ts" bigint NOT NULL,
  "body" bytea,
  "size" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("user_id", "tag")
);
CREATE INDEX "history_items_idx_history_tombstones" ON meldiq."history_items" ("updated_at");
CREATE INDEX "history_items_idx_history_conv" ON meldiq."history_items" ("user_id", "conv_tag", "ts");
CREATE UNIQUE INDEX "history_items_idx_history_seq" ON meldiq."history_items" ("user_id", "seq");
ALTER TABLE meldiq."history_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."history_items" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."history_items" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."history_items" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."history_items" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."inbox_accounts" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "provider" text NOT NULL,
  "external_id" text NOT NULL,
  "name" text NOT NULL,
  "meta_json" text NOT NULL DEFAULT '{}',
  "token_sealed" text,
  "token_expires_at" bigint,
  "status" text NOT NULL DEFAULT 'active',
  "live_key" text,
  "last_error" text,
  "last_event_at" bigint,
  "connected_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "inbox_accounts_inbox_accounts_live" ON meldiq."inbox_accounts" ("live_key") WHERE "live_key" IS NOT NULL;
CREATE INDEX "inbox_accounts_inbox_accounts_org" ON meldiq."inbox_accounts" ("org_id");
ALTER TABLE meldiq."inbox_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."inbox_accounts" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."inbox_accounts" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."inbox_accounts" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."inbox_accounts" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."inbox_contacts" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "account_id" text NOT NULL,
  "external_user_id" text NOT NULL,
  "display_name" text,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "inbox_contacts_sqlite_autoindex_inbox_contacts_2" ON meldiq."inbox_contacts" ("account_id", "external_user_id");
ALTER TABLE meldiq."inbox_contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."inbox_contacts" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."inbox_contacts" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."inbox_contacts" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."inbox_contacts" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."inbox_conversations" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "account_id" text NOT NULL,
  "contact_id" text NOT NULL,
  "provider" text NOT NULL,
  "status" text NOT NULL DEFAULT 'waiting_agent',
  "priority" text NOT NULL DEFAULT 'normal',
  "assignee_id" text,
  "queue_id" text,
  "handling" text NOT NULL DEFAULT 'human',
  "escalation_reason" text,
  "tags_json" text NOT NULL DEFAULT '[]',
  "rev" bigint NOT NULL DEFAULT 1,
  "unread" bigint NOT NULL DEFAULT 0,
  "last_message_at" bigint NOT NULL,
  "last_inbound_at" bigint,
  "first_response_at" bigint,
  "sla_notified_at" bigint,
  "auto_replies_json" text NOT NULL DEFAULT '[]',
  "resolved_at" bigint,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "inbox_conversations_inbox_conversations_org" ON meldiq."inbox_conversations" ("org_id", "last_message_at");
CREATE UNIQUE INDEX "inbox_conversations_sqlite_autoindex_inbox_conversations_2" ON meldiq."inbox_conversations" ("account_id", "contact_id");
ALTER TABLE meldiq."inbox_conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."inbox_conversations" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."inbox_conversations" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."inbox_conversations" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."inbox_conversations" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."inbox_events" (
  "id" text NOT NULL,
  "provider" text NOT NULL,
  "payload_sealed" text NOT NULL,
  "state" text NOT NULL DEFAULT 'pending',
  "attempts" bigint NOT NULL DEFAULT 0,
  "next_attempt_at" bigint NOT NULL,
  "error_kind" text,
  "received_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "inbox_events_inbox_events_pending" ON meldiq."inbox_events" ("state", "next_attempt_at");
ALTER TABLE meldiq."inbox_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."inbox_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."inbox_events" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."inbox_events" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."inbox_events" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."inbox_messages" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "conversation_id" text NOT NULL,
  "direction" text NOT NULL,
  "external_id" text,
  "author_id" text,
  "origin" text NOT NULL DEFAULT 'human',
  "kind" text NOT NULL DEFAULT 'text',
  "body_sealed" text,
  "attachments_json" text NOT NULL DEFAULT '[]',
  "status" text NOT NULL,
  "error_kind" text,
  "attempts" bigint NOT NULL DEFAULT 0,
  "next_attempt_at" bigint,
  "provider_ts" bigint,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "inbox_messages_inbox_messages_outbox" ON meldiq."inbox_messages" ("status", "next_attempt_at");
CREATE UNIQUE INDEX "inbox_messages_inbox_messages_external" ON meldiq."inbox_messages" ("conversation_id", "external_id") WHERE "external_id" IS NOT NULL;
CREATE INDEX "inbox_messages_inbox_messages_conv" ON meldiq."inbox_messages" ("conversation_id", "created_at");
ALTER TABLE meldiq."inbox_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."inbox_messages" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."inbox_messages" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."inbox_messages" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."inbox_messages" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."inbox_queues" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "name" text NOT NULL,
  "members_json" text NOT NULL DEFAULT '[]',
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "inbox_queues_inbox_queues_org" ON meldiq."inbox_queues" ("org_id");
ALTER TABLE meldiq."inbox_queues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."inbox_queues" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."inbox_queues" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."inbox_queues" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."inbox_queues" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."inbox_settings" (
  "org_id" text NOT NULL,
  "json" text NOT NULL,
  "updated_by" text,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("org_id")
);
ALTER TABLE meldiq."inbox_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."inbox_settings" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."inbox_settings" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."inbox_settings" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."inbox_settings" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."integration_accounts" (
  "id" text NOT NULL,
  "workspace_id" text NOT NULL,
  "connector_id" text NOT NULL,
  "owner_type" text NOT NULL,
  "owner_key" text NOT NULL,
  "user_id" text NOT NULL,
  "external_id" text NOT NULL,
  "external_label" text,
  "scopes" text NOT NULL,
  "meta" text NOT NULL,
  "status" text NOT NULL,
  "rev" bigint NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "last_validated_at" bigint,
  "last_used_at" bigint,
  "last_error" text,
  "last_error_at" bigint,
  PRIMARY KEY ("id")
);
CREATE INDEX "integration_accounts_idx_integration_accounts_external" ON meldiq."integration_accounts" ("external_id", "connector_id");
CREATE INDEX "integration_accounts_idx_integration_accounts_user" ON meldiq."integration_accounts" ("user_id");
CREATE UNIQUE INDEX "integration_accounts_idx_integration_accounts_owner" ON meldiq."integration_accounts" ("workspace_id", "connector_id", "owner_key");
ALTER TABLE meldiq."integration_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."integration_accounts" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."integration_accounts" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."integration_accounts" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."integration_accounts" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."integration_channel_events" (
  "id" text NOT NULL,
  "workspace_id" text NOT NULL,
  "conversation_id" text NOT NULL,
  "connector_id" text NOT NULL,
  "subscription_id" text NOT NULL,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "url" text,
  "summary" text,
  "actor" text,
  "occurred_at" bigint NOT NULL,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "dedupe_key" text NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "integration_channel_events_idx_integration_channel_2fb2582ca078" ON meldiq."integration_channel_events" ("expires_at");
CREATE INDEX "integration_channel_events_idx_integration_channel_events_conv" ON meldiq."integration_channel_events" ("conversation_id", "created_at");
CREATE UNIQUE INDEX "integration_channel_events_sqlite_autoindex_integr_5fc2272fd2a3" ON meldiq."integration_channel_events" ("dedupe_key");
ALTER TABLE meldiq."integration_channel_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."integration_channel_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."integration_channel_events" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."integration_channel_events" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."integration_channel_events" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."integration_credentials" (
  "account_id" text NOT NULL,
  "key_id" text NOT NULL,
  "access_token" text NOT NULL,
  "refresh_token" text,
  "expires_at" bigint,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("account_id")
);
ALTER TABLE meldiq."integration_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."integration_credentials" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."integration_credentials" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."integration_credentials" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."integration_credentials" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."integration_deliveries" (
  "id" text NOT NULL,
  "connector_id" text NOT NULL,
  "event" text NOT NULL,
  "status" text NOT NULL,
  "received_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "integration_deliveries_idx_integration_deliveries_expiry" ON meldiq."integration_deliveries" ("expires_at");
ALTER TABLE meldiq."integration_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."integration_deliveries" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."integration_deliveries" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."integration_deliveries" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."integration_deliveries" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."integration_hooks" (
  "id" text NOT NULL,
  "workspace_id" text NOT NULL,
  "conversation_id" text NOT NULL,
  "name" text NOT NULL,
  "secret" text NOT NULL,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "active" bigint NOT NULL,
  "last_delivery_at" bigint,
  "last_error" text,
  PRIMARY KEY ("id")
);
CREATE INDEX "integration_hooks_idx_integration_hooks_ws" ON meldiq."integration_hooks" ("workspace_id");
ALTER TABLE meldiq."integration_hooks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."integration_hooks" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."integration_hooks" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."integration_hooks" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."integration_hooks" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."integration_installs" (
  "id" text NOT NULL,
  "workspace_id" text NOT NULL,
  "connector_id" text NOT NULL,
  "connector_version" bigint NOT NULL,
  "state" text NOT NULL,
  "requested_caps" text NOT NULL,
  "granted_caps" text NOT NULL,
  "config" text NOT NULL,
  "requested_by" text,
  "request_note" text,
  "installed_by" text,
  "decided_by" text,
  "decided_at" bigint,
  "rev" bigint NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "last_event_at" bigint,
  "last_error" text,
  "last_error_at" bigint,
  PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "integration_installs_idx_integration_installs_ws" ON meldiq."integration_installs" ("workspace_id", "connector_id");
ALTER TABLE meldiq."integration_installs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."integration_installs" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."integration_installs" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."integration_installs" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."integration_installs" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."integration_jobs" (
  "id" text NOT NULL,
  "kind" text NOT NULL,
  "workspace_id" text,
  "idempotency_key" text NOT NULL,
  "payload" text NOT NULL,
  "state" text NOT NULL,
  "attempts" bigint NOT NULL,
  "next_at" bigint NOT NULL,
  "lease_until" bigint,
  "last_error" text,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "integration_jobs_idx_integration_jobs_due" ON meldiq."integration_jobs" ("state", "next_at");
CREATE UNIQUE INDEX "integration_jobs_sqlite_autoindex_integration_jobs_2" ON meldiq."integration_jobs" ("idempotency_key");
ALTER TABLE meldiq."integration_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."integration_jobs" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."integration_jobs" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."integration_jobs" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."integration_jobs" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."integration_oauth_states" (
  "id" text NOT NULL,
  "state_hash" text NOT NULL,
  "begin_hash" text,
  "browser_hash" text,
  "finish_hash" text,
  "workspace_id" text NOT NULL,
  "connector_id" text NOT NULL,
  "user_id" text NOT NULL,
  "owner_type" text NOT NULL,
  "verifier" text,
  "redirect_uri" text NOT NULL,
  "scopes" text NOT NULL,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "used_at" bigint,
  "result" text,
  "error" text,
  "account_id" text,
  PRIMARY KEY ("id")
);
CREATE INDEX "integration_oauth_states_idx_integration_oauth_states_expiry" ON meldiq."integration_oauth_states" ("expires_at");
CREATE UNIQUE INDEX "integration_oauth_states_sqlite_autoindex_integrat_441fbbd3c421" ON meldiq."integration_oauth_states" ("state_hash");
ALTER TABLE meldiq."integration_oauth_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."integration_oauth_states" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."integration_oauth_states" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."integration_oauth_states" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."integration_oauth_states" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."integration_policies" (
  "id" text NOT NULL,
  "doc" text NOT NULL,
  "rev" bigint NOT NULL,
  "updated_by" text,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
ALTER TABLE meldiq."integration_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."integration_policies" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."integration_policies" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."integration_policies" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."integration_policies" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."integration_subscriptions" (
  "id" text NOT NULL,
  "workspace_id" text NOT NULL,
  "connector_id" text NOT NULL,
  "account_id" text NOT NULL,
  "conversation_id" text NOT NULL,
  "resource" text NOT NULL,
  "events" text NOT NULL,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "active" bigint NOT NULL,
  "last_delivery_at" bigint,
  "last_error" text,
  PRIMARY KEY ("id")
);
CREATE INDEX "integration_subscriptions_idx_integration_subscriptions_account" ON meldiq."integration_subscriptions" ("account_id");
CREATE UNIQUE INDEX "integration_subscriptions_idx_integration_subscriptions_target" ON meldiq."integration_subscriptions" ("workspace_id", "connector_id", "conversation_id", "resource");
ALTER TABLE meldiq."integration_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."integration_subscriptions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."integration_subscriptions" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."integration_subscriptions" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."integration_subscriptions" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."invitations" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "code_hash" text NOT NULL,
  "code_hint" text NOT NULL,
  "role" text NOT NULL,
  "branch_id" text,
  "team_id" text,
  "max_uses" bigint NOT NULL,
  "uses" bigint NOT NULL DEFAULT 0,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "revoked_at" bigint,
  "guest_days" bigint,
  "grant_role_id" text,
  PRIMARY KEY ("id"),
  CHECK (role IN ('ADMIN','MEMBER','GUEST'))
);
CREATE INDEX "invitations_idx_invitations_org" ON meldiq."invitations" ("org_id");
CREATE UNIQUE INDEX "invitations_sqlite_autoindex_invitations_2" ON meldiq."invitations" ("code_hash");
ALTER TABLE meldiq."invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."invitations" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."invitations" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."invitations" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."invitations" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."join_applications" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "user_id" text NOT NULL,
  "answers" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" bigint NOT NULL,
  "handled_by" text,
  "handled_at" bigint,
  "note" text,
  PRIMARY KEY ("id"),
  CHECK (status IN ('pending', 'approved', 'denied', 'withdrawn'))
);
CREATE INDEX "join_applications_join_applications_person" ON meldiq."join_applications" ("org_id", "user_id", "status");
CREATE INDEX "join_applications_join_applications_org" ON meldiq."join_applications" ("org_id", "status", "created_at");
ALTER TABLE meldiq."join_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."join_applications" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."join_applications" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."join_applications" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."join_applications" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."legacy_tickets" (
  "ticket_hash" text NOT NULL,
  "user_id" text NOT NULL,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "used_at" bigint,
  "account_id" text,
  PRIMARY KEY ("ticket_hash")
);
CREATE INDEX "legacy_tickets_idx_legacy_tickets_expiry" ON meldiq."legacy_tickets" ("expires_at");
ALTER TABLE meldiq."legacy_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."legacy_tickets" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."legacy_tickets" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."legacy_tickets" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."legacy_tickets" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."loadtest_registrations" (
  "id" bigint NOT NULL,
  "user_id" text NOT NULL,
  "invite_id" text NOT NULL,
  "network" text NOT NULL,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "loadtest_registrations_idx_loadtest_registrations_time" ON meldiq."loadtest_registrations" ("created_at");
ALTER TABLE meldiq."loadtest_registrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."loadtest_registrations" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."loadtest_registrations" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."loadtest_registrations" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."loadtest_registrations" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."meeting_participants" (
  "meeting_id" text NOT NULL,
  "user_id" text NOT NULL,
  "response" text NOT NULL DEFAULT 'pending',
  PRIMARY KEY ("meeting_id", "user_id"),
  CHECK (response IN ('pending','accepted','declined','tentative'))
);
CREATE INDEX "meeting_participants_idx_meeting_participants_user" ON meldiq."meeting_participants" ("user_id");
ALTER TABLE meldiq."meeting_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."meeting_participants" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."meeting_participants" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."meeting_participants" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."meeting_participants" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."meetings" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "room_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "starts_at" bigint NOT NULL,
  "ends_at" bigint NOT NULL,
  "time_zone" text NOT NULL,
  "organizer_id" text NOT NULL,
  "cancelled_at" bigint,
  "notified_at" bigint,
  "rev" bigint NOT NULL DEFAULT 1,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "repeat" text,
  PRIMARY KEY ("id")
);
CREATE INDEX "meetings_idx_meetings_soon" ON meldiq."meetings" ("starts_at");
CREATE INDEX "meetings_idx_meetings_org" ON meldiq."meetings" ("org_id", "starts_at");
ALTER TABLE meldiq."meetings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."meetings" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."meetings" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."meetings" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."meetings" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."mention_all_events" (
  "conversation_id" text NOT NULL,
  "user_id" text NOT NULL,
  "message_id" text NOT NULL,
  "at" bigint NOT NULL,
  "rowid" bigint NOT NULL PRIMARY KEY
);
CREATE INDEX "mention_all_events_idx_mention_all_events" ON meldiq."mention_all_events" ("conversation_id", "user_id", "at");
ALTER TABLE meldiq."mention_all_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."mention_all_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."mention_all_events" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."mention_all_events" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."mention_all_events" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."message_events" (
  "id" text NOT NULL,
  "conversation_id" text NOT NULL,
  "sender_user_id" text NOT NULL,
  "sender_device_id" text,
  "cls" text NOT NULL,
  "type" text NOT NULL,
  "target" text,
  "audience" text NOT NULL DEFAULT 'all',
  "payload" text NOT NULL,
  "sent_at" bigint NOT NULL,
  "server_ts" bigint NOT NULL,
  "mention_all" bigint NOT NULL DEFAULT 0,
  "imported_by" text,
  PRIMARY KEY ("id"),
  CHECK (cls IN ('message', 'control')),
  CHECK (audience IN ('all', 'self'))
);
CREATE INDEX "message_events_message_events_history_cursor" ON meldiq."message_events" ("conversation_id", "cls", "server_ts", "id");
CREATE INDEX "message_events_idx_message_events_sender" ON meldiq."message_events" ("sender_user_id");
CREATE INDEX "message_events_idx_message_events_target" ON meldiq."message_events" ("conversation_id", "target");
CREATE INDEX "message_events_idx_message_events_page" ON meldiq."message_events" ("conversation_id", "cls", "server_ts");
ALTER TABLE meldiq."message_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."message_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."message_events" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."message_events" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."message_events" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."messaging_settings" (
  "user_id" text NOT NULL,
  "dm_policy" text NOT NULL DEFAULT 'communities',
  "request_policy" text NOT NULL DEFAULT 'everyone',
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("user_id"),
  CHECK (dm_policy IN ('everyone', 'communities', 'connections')),
  CHECK (request_policy IN ('everyone', 'communities', 'nobody'))
);
ALTER TABLE meldiq."messaging_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."messaging_settings" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."messaging_settings" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."messaging_settings" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."messaging_settings" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."mojo_controls" (
  "id" bigint NOT NULL,
  "enforce" text,
  "plans" text NOT NULL DEFAULT '{}',
  "levels" text NOT NULL DEFAULT '{}',
  "updated_by" text NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (id = 1),
  CHECK (enforce IN ('on', 'off', 'auto'))
);
ALTER TABLE meldiq."mojo_controls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."mojo_controls" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."mojo_controls" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."mojo_controls" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."mojo_controls" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."mojo_gift_credits" (
  "gift_id" text NOT NULL,
  "account_id" text NOT NULL,
  "user_id" text NOT NULL,
  "status" text NOT NULL DEFAULT 'waiting',
  "next_check_at" bigint NOT NULL DEFAULT 0,
  "created_at" bigint NOT NULL,
  "applied_at" bigint,
  "grant_id" text,
  PRIMARY KEY ("gift_id")
);
CREATE INDEX "mojo_gift_credits_idx_gift_credits_owner" ON meldiq."mojo_gift_credits" ("account_id", "status");
ALTER TABLE meldiq."mojo_gift_credits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."mojo_gift_credits" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."mojo_gift_credits" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."mojo_gift_credits" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."mojo_gift_credits" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."mojo_gift_deliveries" (
  "gift_id" text NOT NULL,
  "recipient_kind" text NOT NULL,
  "recipient_email_encrypted" text,
  "recipient_email_hash" text,
  "token_hash" text,
  "redemption_expires_at" bigint,
  "delivery_status" text NOT NULL DEFAULT 'awaiting_payment',
  "delivered_at" bigint,
  "redeemed_by" text,
  "revoked_at" bigint,
  "revoked_by" text,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("gift_id"),
  CHECK (recipient_kind IN ('user','email','link'))
);
CREATE INDEX "mojo_gift_deliveries_idx_gift_delivery_email" ON meldiq."mojo_gift_deliveries" ("recipient_email_hash", "delivery_status");
CREATE UNIQUE INDEX "mojo_gift_deliveries_sqlite_autoindex_mojo_gift_deliveries_2" ON meldiq."mojo_gift_deliveries" ("token_hash") WHERE "token_hash" IS NOT NULL;
ALTER TABLE meldiq."mojo_gift_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."mojo_gift_deliveries" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."mojo_gift_deliveries" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."mojo_gift_deliveries" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."mojo_gift_deliveries" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."mojo_gifts" (
  "id" text NOT NULL,
  "buyer_account_id" text NOT NULL,
  "buyer_user_id" text,
  "recipient_user_id" text NOT NULL,
  "plan_key" text NOT NULL,
  "months" bigint NOT NULL,
  "currency" text NOT NULL,
  "amount_minor" bigint NOT NULL,
  "note" text,
  "status" text NOT NULL,
  "provider" text NOT NULL,
  "provider_session_ref" text,
  "provider_payment_ref" text,
  "grant_id" text,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "paid_at" bigint,
  "redeemed_at" bigint,
  "updated_at" bigint NOT NULL,
  "request_key" text,
  "refund_status" text NOT NULL DEFAULT 'none',
  "dispute_status" text,
  PRIMARY KEY ("id"),
  CHECK (plan_key IN ('go', 'plus')),
  CHECK (months IN (1, 3, 12)),
  CHECK (amount_minor > 0),
  CHECK (status IN ('pending', 'paid', 'redeemed', 'refunded', 'expired', 'failed'))
);
CREATE INDEX "mojo_gifts_idx_mojo_gifts_admin_status_time" ON meldiq."mojo_gifts" ("status", "created_at", "id");
CREATE INDEX "mojo_gifts_idx_mojo_gifts_admin_time" ON meldiq."mojo_gifts" ("created_at", "id");
CREATE UNIQUE INDEX "mojo_gifts_idx_mojo_gift_request" ON meldiq."mojo_gifts" ("provider", "buyer_account_id", "request_key") WHERE "request_key" IS NOT NULL;
CREATE INDEX "mojo_gifts_idx_mojo_gifts_payment" ON meldiq."mojo_gifts" ("provider", "provider_payment_ref") WHERE "provider_payment_ref" IS NOT NULL;
CREATE INDEX "mojo_gifts_idx_mojo_gifts_buyer" ON meldiq."mojo_gifts" ("buyer_account_id", "created_at");
CREATE INDEX "mojo_gifts_idx_mojo_gifts_recipient" ON meldiq."mojo_gifts" ("recipient_user_id", "status");
CREATE UNIQUE INDEX "mojo_gifts_sqlite_autoindex_mojo_gifts_2" ON meldiq."mojo_gifts" ("provider_session_ref") WHERE "provider_session_ref" IS NOT NULL;
ALTER TABLE meldiq."mojo_gifts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."mojo_gifts" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."mojo_gifts" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."mojo_gifts" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."mojo_gifts" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."mojo_profile" (
  "user_id" text NOT NULL,
  "badge_hidden" bigint NOT NULL DEFAULT 0,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("user_id"),
  CHECK (badge_hidden IN (0, 1))
);
ALTER TABLE meldiq."mojo_profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."mojo_profile" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."mojo_profile" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."mojo_profile" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."mojo_profile" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."nav_preferences" (
  "user_id" text NOT NULL,
  "workspace_id" text NOT NULL,
  "doc" text NOT NULL,
  "rev" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("user_id", "workspace_id")
);
CREATE INDEX "nav_preferences_idx_nav_preferences_workspace" ON meldiq."nav_preferences" ("workspace_id");
ALTER TABLE meldiq."nav_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."nav_preferences" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."nav_preferences" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."nav_preferences" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."nav_preferences" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."official_bots" (
  "org_id" text NOT NULL,
  "bot_key" text NOT NULL,
  "enabled" bigint NOT NULL,
  "settings" text NOT NULL,
  "look_name" text,
  "user_id" text,
  "updated_by" text NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("org_id", "bot_key"),
  CHECK (enabled IN (0, 1))
);
CREATE INDEX "official_bots_idx_official_bots_user" ON meldiq."official_bots" ("user_id");
ALTER TABLE meldiq."official_bots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."official_bots" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."official_bots" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."official_bots" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."official_bots" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."official_bots_plus" (
  "org_id" text NOT NULL,
  "granted_by" text NOT NULL,
  "granted_at" bigint NOT NULL,
  "expires_at" bigint,
  "reason" text NOT NULL,
  PRIMARY KEY ("org_id")
);
ALTER TABLE meldiq."official_bots_plus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."official_bots_plus" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."official_bots_plus" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."official_bots_plus" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."official_bots_plus" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."onboarding_answers" (
  "org_id" text NOT NULL,
  "user_id" text NOT NULL,
  "option_ids" text NOT NULL,
  "role_ids" text NOT NULL,
  "answered_at" bigint NOT NULL,
  PRIMARY KEY ("org_id", "user_id")
);
ALTER TABLE meldiq."onboarding_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."onboarding_answers" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."onboarding_answers" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."onboarding_answers" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."onboarding_answers" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."onboarding_completions" (
  "org_id" text NOT NULL,
  "user_id" text NOT NULL,
  "finished_at" bigint NOT NULL,
  PRIMARY KEY ("org_id", "user_id")
);
CREATE INDEX "onboarding_completions_idx_onboarding_completions_user" ON meldiq."onboarding_completions" ("user_id");
ALTER TABLE meldiq."onboarding_completions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."onboarding_completions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."onboarding_completions" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."onboarding_completions" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."onboarding_completions" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."operator_accounts" (
  "account_id" text NOT NULL,
  "verification" text NOT NULL,
  "code_hash" text,
  "code_expires_at" bigint,
  "tester" bigint NOT NULL DEFAULT 0,
  "note" text,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("account_id"),
  CHECK (verification IN ('verified', 'static_code', 'email')),
  CHECK (tester IN (0, 1)),
  CHECK ((verification = 'static_code') = (code_hash IS NOT NULL))
);
CREATE INDEX "operator_accounts_operator_accounts_created" ON meldiq."operator_accounts" ("created_at", "account_id");
ALTER TABLE meldiq."operator_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."operator_accounts" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."operator_accounts" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."operator_accounts" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."operator_accounts" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."org_bans" (
  "org_id" text NOT NULL,
  "user_id" text NOT NULL,
  "reason" text,
  "banned_by" text NOT NULL,
  "banned_at" bigint NOT NULL,
  PRIMARY KEY ("org_id", "user_id")
);
ALTER TABLE meldiq."org_bans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."org_bans" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."org_bans" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."org_bans" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."org_bans" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."org_deletions" (
  "org_id" text NOT NULL,
  "name_sha256" text NOT NULL,
  "deleted_by" text NOT NULL,
  "deleted_at" bigint NOT NULL,
  "request_id" text,
  "members" bigint NOT NULL,
  "channels" bigint NOT NULL,
  "files" bigint NOT NULL,
  PRIMARY KEY ("org_id")
);
ALTER TABLE meldiq."org_deletions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."org_deletions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."org_deletions" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."org_deletions" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."org_deletions" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."org_entitlements" (
  "org_id" text NOT NULL,
  "key" text NOT NULL,
  "limit_value" bigint NOT NULL,
  "set_by" text NOT NULL,
  "set_at" bigint NOT NULL,
  "expires_at" bigint,
  "reason" text,
  PRIMARY KEY ("org_id", "key")
);
ALTER TABLE meldiq."org_entitlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."org_entitlements" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."org_entitlements" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."org_entitlements" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."org_entitlements" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."org_members" (
  "org_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role" text NOT NULL,
  "title" text,
  "joined_at" bigint NOT NULL,
  "expires_at" bigint,
  "timeout_until" bigint,
  PRIMARY KEY ("org_id", "user_id"),
  CHECK (role IN ('OWNER','ADMIN','MEMBER','GUEST'))
);
CREATE INDEX "org_members_idx_org_members_user" ON meldiq."org_members" ("user_id");
ALTER TABLE meldiq."org_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."org_members" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."org_members" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."org_members" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."org_members" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."org_nicknames" (
  "org_id" text NOT NULL,
  "user_id" text NOT NULL,
  "nickname" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("org_id", "user_id")
);
ALTER TABLE meldiq."org_nicknames" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."org_nicknames" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."org_nicknames" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."org_nicknames" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."org_nicknames" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."org_role_extras" (
  "role_id" text NOT NULL,
  "org_id" text NOT NULL,
  "color2" text,
  "mentionable" bigint NOT NULL DEFAULT 0,
  "auto_assign" text NOT NULL DEFAULT 'none',
  "auto_before" bigint,
  "updated_by" text NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("role_id"),
  CHECK (mentionable IN (0, 1)),
  CHECK (auto_assign IN ('none', 'everyone', 'joined_before')),
  CHECK ((auto_assign = 'joined_before') = (auto_before IS NOT NULL))
);
CREATE INDEX "org_role_extras_org_role_extras_org" ON meldiq."org_role_extras" ("org_id");
ALTER TABLE meldiq."org_role_extras" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."org_role_extras" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."org_role_extras" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."org_role_extras" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."org_role_extras" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."org_role_members" (
  "role_id" text NOT NULL,
  "org_id" text NOT NULL,
  "user_id" text NOT NULL,
  "assigned_by" text NOT NULL,
  "assigned_at" bigint NOT NULL,
  PRIMARY KEY ("role_id", "user_id")
);
CREATE INDEX "org_role_members_idx_org_role_members_user" ON meldiq."org_role_members" ("org_id", "user_id");
ALTER TABLE meldiq."org_role_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."org_role_members" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."org_role_members" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."org_role_members" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."org_role_members" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."org_roles" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "color" text,
  "icon" text,
  "permissions" text NOT NULL,
  "denies" text NOT NULL,
  "template" text,
  "position" bigint NOT NULL,
  "rev" bigint NOT NULL,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "archived_at" bigint,
  "hoist" bigint NOT NULL DEFAULT 0,
  PRIMARY KEY ("id")
);
CREATE INDEX "org_roles_idx_org_roles_org" ON meldiq."org_roles" ("org_id");
ALTER TABLE meldiq."org_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."org_roles" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."org_roles" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."org_roles" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."org_roles" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."orgs" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "create_request_id" text,
  "photo_rev" bigint,
  "guests_allowed" bigint NOT NULL DEFAULT 1,
  "guest_max_days" bigint,
  "ai_enabled" bigint NOT NULL DEFAULT 0,
  "ai_provider" text,
  "ai_changed_by" text,
  "ai_changed_at" bigint,
  "kind" text NOT NULL DEFAULT 'team',
  "visibility" text NOT NULL DEFAULT 'private',
  "join_policy" text NOT NULL DEFAULT 'invite',
  "rules" text,
  "invites_paused_until" bigint,
  "dms_paused_until" bigint,
  "join_questions" text,
  "activity_alerts" bigint NOT NULL DEFAULT 1,
  "raid_alert_at" bigint,
  "raid_alert_count" bigint,
  "guide" text,
  "synthetic" bigint NOT NULL DEFAULT 0,
  "accent" text,
  "banner_rev" bigint,
  "tag" text,
  "platform_suspended_at" bigint,
  "platform_suspended_until" bigint,
  PRIMARY KEY ("id"),
  CHECK (kind IN ('team', 'community')),
  CHECK (visibility IN ('private', 'public')),
  CHECK (join_policy IN ('invite', 'open'))
);
CREATE INDEX "orgs_idx_orgs_platform_suspension" ON meldiq."orgs" ("platform_suspended_at", "platform_suspended_until");
CREATE INDEX "orgs_idx_orgs_public" ON meldiq."orgs" ("visibility", "name");
CREATE UNIQUE INDEX "orgs_idx_orgs_create_request" ON meldiq."orgs" ("created_by", "create_request_id") WHERE "create_request_id" IS NOT NULL;
CREATE UNIQUE INDEX "orgs_sqlite_autoindex_orgs_2" ON meldiq."orgs" ((translate("slug", 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')));
ALTER TABLE meldiq."orgs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."orgs" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."orgs" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."orgs" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."orgs" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."pairing_requests" (
  "id" text NOT NULL,
  "code_hash" text NOT NULL,
  "device_name" text NOT NULL,
  "signing_key" text NOT NULL,
  "encryption_key" text NOT NULL,
  "transfer_key" text NOT NULL,
  "approved_user_id" text,
  "certificate" text,
  "sealed_identity" text,
  "sealed_enc" text,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pairing_requests_sqlite_autoindex_pairing_requests_2" ON meldiq."pairing_requests" ("code_hash");
ALTER TABLE meldiq."pairing_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."pairing_requests" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."pairing_requests" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."pairing_requests" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."pairing_requests" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."pending_blob_deletes" (
  "kind" text NOT NULL,
  "blob_id" text NOT NULL,
  "attempts" bigint NOT NULL DEFAULT 0,
  "next_at" bigint NOT NULL,
  PRIMARY KEY ("kind", "blob_id"),
  CHECK (kind IN ('attachments','profile-photos'))
);
ALTER TABLE meldiq."pending_blob_deletes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."pending_blob_deletes" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."pending_blob_deletes" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."pending_blob_deletes" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."pending_blob_deletes" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."platform_admin_challenges" (
  "id" text NOT NULL,
  "purpose" text NOT NULL,
  "account_id" text NOT NULL,
  "session_id" text,
  "challenge" text NOT NULL,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (purpose IN ('login', 'register', 'reauth'))
);
CREATE INDEX "platform_admin_challenges_idx_platform_admin_challenges_expiry" ON meldiq."platform_admin_challenges" ("expires_at");
ALTER TABLE meldiq."platform_admin_challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."platform_admin_challenges" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."platform_admin_challenges" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."platform_admin_challenges" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."platform_admin_challenges" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."platform_admin_enrolments" (
  "account_id" text NOT NULL,
  "code_hash" text NOT NULL,
  "attempts" bigint NOT NULL DEFAULT 0,
  "issued_by" text,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("account_id")
);
ALTER TABLE meldiq."platform_admin_enrolments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."platform_admin_enrolments" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."platform_admin_enrolments" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."platform_admin_enrolments" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."platform_admin_enrolments" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."platform_admin_passkeys" (
  "id" text NOT NULL,
  "account_id" text NOT NULL,
  "public_key" text NOT NULL,
  "counter" bigint NOT NULL DEFAULT 0,
  "transports" text,
  "name" text NOT NULL,
  "backed_up" bigint NOT NULL DEFAULT 0,
  "created_at" bigint NOT NULL,
  "last_used_at" bigint,
  PRIMARY KEY ("id")
);
CREATE INDEX "platform_admin_passkeys_idx_platform_admin_passkeys_account" ON meldiq."platform_admin_passkeys" ("account_id");
ALTER TABLE meldiq."platform_admin_passkeys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."platform_admin_passkeys" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."platform_admin_passkeys" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."platform_admin_passkeys" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."platform_admin_passkeys" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."platform_admin_sessions" (
  "id" text NOT NULL,
  "token_hash" text NOT NULL,
  "account_id" text NOT NULL,
  "created_at" bigint NOT NULL,
  "last_used_at" bigint NOT NULL,
  "idle_expires_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "reauth_at" bigint NOT NULL,
  "network" text NOT NULL,
  "revoked_at" bigint,
  "revoke_reason" text,
  PRIMARY KEY ("id")
);
CREATE INDEX "platform_admin_sessions_idx_platform_admin_sessions_expiry" ON meldiq."platform_admin_sessions" ("expires_at");
CREATE INDEX "platform_admin_sessions_idx_platform_admin_sessions_account" ON meldiq."platform_admin_sessions" ("account_id");
CREATE UNIQUE INDEX "platform_admin_sessions_sqlite_autoindex_platform__95759b545497" ON meldiq."platform_admin_sessions" ("token_hash");
ALTER TABLE meldiq."platform_admin_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."platform_admin_sessions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."platform_admin_sessions" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."platform_admin_sessions" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."platform_admin_sessions" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."platform_admins" (
  "account_id" text NOT NULL,
  "role" text NOT NULL,
  "granted_by" text,
  "granted_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "revoked_at" bigint,
  "revoked_by" text,
  "note" text,
  "permissions" text,
  PRIMARY KEY ("account_id"),
  CHECK (role IN ('super_admin','operations_admin','platform_moderator','support_admin','billing_admin','auditor'))
);
CREATE INDEX "platform_admins_idx_platform_admins_role" ON meldiq."platform_admins" ("role");
ALTER TABLE meldiq."platform_admins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."platform_admins" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."platform_admins" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."platform_admins" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."platform_admins" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."platform_audit" (
  "id" bigint NOT NULL,
  "at" bigint NOT NULL,
  "request_id" text,
  "actor_account_id" text,
  "actor_role" text,
  "action" text NOT NULL,
  "target_type" text,
  "target_id" text,
  "outcome" text NOT NULL,
  "reason" text,
  "network" text,
  "detail" text,
  "prev_hash" text NOT NULL,
  "hash" text NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (outcome IN ('success', 'denied', 'failed'))
);
CREATE INDEX "platform_audit_idx_platform_audit_action" ON meldiq."platform_audit" ("action", "at");
CREATE INDEX "platform_audit_idx_platform_audit_target" ON meldiq."platform_audit" ("target_type", "target_id", "at");
CREATE INDEX "platform_audit_idx_platform_audit_actor" ON meldiq."platform_audit" ("actor_account_id", "at");
CREATE INDEX "platform_audit_idx_platform_audit_at" ON meldiq."platform_audit" ("at");
ALTER TABLE meldiq."platform_audit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."platform_audit" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."platform_audit" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."platform_audit" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."platform_audit" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."platform_incident_events" (
  "id" bigint NOT NULL,
  "incident_id" text NOT NULL,
  "at" bigint NOT NULL,
  "actor_account_id" text NOT NULL,
  "kind" text NOT NULL,
  "body" text NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (kind IN ('note', 'status', 'severity', 'assign', 'created'))
);
CREATE INDEX "platform_incident_events_idx_platform_incident_events_incident" ON meldiq."platform_incident_events" ("incident_id", "at");
ALTER TABLE meldiq."platform_incident_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."platform_incident_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."platform_incident_events" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."platform_incident_events" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."platform_incident_events" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."platform_incidents" (
  "id" text NOT NULL,
  "title" text NOT NULL,
  "severity" text NOT NULL,
  "status" text NOT NULL,
  "kind" text NOT NULL,
  "assignee_account_id" text,
  "user_ref" text,
  "org_ref" text,
  "notice" text,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "resolved_at" bigint,
  "service" text,
  "source" text NOT NULL DEFAULT 'manual',
  "dedupe_key" text,
  "first_seen_at" bigint,
  "last_seen_at" bigint,
  "acknowledged_at" bigint,
  "closed_at" bigint,
  "resolution" text,
  PRIMARY KEY ("id"),
  CHECK (severity IN ('sev1', 'sev2', 'sev3', 'sev4')),
  CHECK (status IN ('open', 'investigating', 'mitigated', 'resolved')),
  CHECK (kind IN ('incident', 'maintenance', 'support'))
);
CREATE INDEX "platform_incidents_idx_platform_incidents_dedupe" ON meldiq."platform_incidents" ("dedupe_key") WHERE "dedupe_key" IS NOT NULL;
CREATE INDEX "platform_incidents_idx_platform_incidents_user" ON meldiq."platform_incidents" ("user_ref");
CREATE INDEX "platform_incidents_idx_platform_incidents_org" ON meldiq."platform_incidents" ("org_ref");
CREATE INDEX "platform_incidents_idx_platform_incidents_status" ON meldiq."platform_incidents" ("status", "updated_at");
ALTER TABLE meldiq."platform_incidents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."platform_incidents" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."platform_incidents" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."platform_incidents" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."platform_incidents" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."platform_report_cases" (
  "report_id" text NOT NULL,
  "assignee_account_id" text,
  "priority" text NOT NULL DEFAULT 'normal',
  "appeal_status" text NOT NULL DEFAULT 'none',
  "sync_status" text NOT NULL DEFAULT 'synced',
  "intended_status" text,
  "version" bigint NOT NULL DEFAULT 1,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("report_id"),
  CHECK (priority IN ('low','normal','high','urgent')),
  CHECK (appeal_status IN ('none','open','upheld','overturned'))
);
CREATE INDEX "platform_report_cases_idx_platform_report_assignee" ON meldiq."platform_report_cases" ("assignee_account_id", "priority");
ALTER TABLE meldiq."platform_report_cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."platform_report_cases" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."platform_report_cases" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."platform_report_cases" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."platform_report_cases" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."platform_report_events" (
  "id" bigint NOT NULL,
  "report_id" text NOT NULL,
  "actor_account_id" text NOT NULL,
  "at" bigint NOT NULL,
  "kind" text NOT NULL,
  "body" text NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "platform_report_events_idx_platform_report_events" ON meldiq."platform_report_events" ("report_id", "id");
ALTER TABLE meldiq."platform_report_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."platform_report_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."platform_report_events" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."platform_report_events" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."platform_report_events" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."platform_restrictions" (
  "user_id" text NOT NULL,
  "kind" text NOT NULL,
  "until" bigint,
  "reason" text NOT NULL,
  "set_by" text NOT NULL,
  "set_at" bigint NOT NULL,
  PRIMARY KEY ("user_id"),
  CHECK (kind IN ('suspension'))
);
ALTER TABLE meldiq."platform_restrictions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."platform_restrictions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."platform_restrictions" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."platform_restrictions" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."platform_restrictions" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."platform_settings" (
  "key" text NOT NULL,
  "value" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("key")
);
ALTER TABLE meldiq."platform_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."platform_settings" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."platform_settings" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."platform_settings" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."platform_settings" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."presence_hourly" (
  "hour" bigint NOT NULL,
  "peak_users" bigint NOT NULL,
  "avg_users" double precision NOT NULL,
  "peak_sockets" bigint NOT NULL,
  "connects" bigint NOT NULL,
  "disconnects" bigint NOT NULL,
  "abnormal" bigint NOT NULL,
  "auth_failures" bigint NOT NULL,
  "samples" bigint NOT NULL,
  PRIMARY KEY ("hour")
);
ALTER TABLE meldiq."presence_hourly" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."presence_hourly" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."presence_hourly" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."presence_hourly" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."presence_hourly" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."presence_samples" (
  "minute" bigint NOT NULL,
  "users" bigint NOT NULL,
  "active_users" bigint NOT NULL,
  "devices" bigint NOT NULL,
  "sockets" bigint NOT NULL,
  "connects" bigint NOT NULL,
  "disconnects" bigint NOT NULL,
  "abnormal" bigint NOT NULL,
  "auth_failures" bigint NOT NULL,
  "calls" bigint NOT NULL,
  "call_people" bigint NOT NULL,
  "platforms" text NOT NULL,
  PRIMARY KEY ("minute")
);
ALTER TABLE meldiq."presence_samples" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."presence_samples" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."presence_samples" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."presence_samples" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."presence_samples" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."profile_collectible_assets" (
  "id" text NOT NULL,
  "metadata" text NOT NULL,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
ALTER TABLE meldiq."profile_collectible_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."profile_collectible_assets" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."profile_collectible_assets" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."profile_collectible_assets" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."profile_collectible_assets" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."profile_collectible_catalog" (
  "id" text NOT NULL,
  "metadata" text NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
ALTER TABLE meldiq."profile_collectible_catalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."profile_collectible_catalog" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."profile_collectible_catalog" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."profile_collectible_catalog" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."profile_collectible_catalog" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."profile_collectible_inventory" (
  "user_id" text NOT NULL,
  "decoration_id" text NOT NULL,
  "acquired_at" bigint NOT NULL,
  "acquisition_source" text NOT NULL,
  "is_favorite" bigint NOT NULL DEFAULT 0,
  PRIMARY KEY ("user_id", "decoration_id")
);
CREATE INDEX "profile_collectible_inventory_idx_collectible_inventory_recent" ON meldiq."profile_collectible_inventory" ("user_id", "acquired_at");
ALTER TABLE meldiq."profile_collectible_inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."profile_collectible_inventory" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."profile_collectible_inventory" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."profile_collectible_inventory" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."profile_collectible_inventory" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."profile_collectible_transactions" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "decoration_id" text NOT NULL,
  "transaction_type" text NOT NULL,
  "price" bigint NOT NULL,
  "currency" text NOT NULL,
  "payment_reference" text,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "profile_collectible_transactions_idx_collectible_t_51971bbef907" ON meldiq."profile_collectible_transactions" ("user_id", "created_at");
CREATE UNIQUE INDEX "profile_collectible_transactions_sqlite_autoindex__dd92ab4840b8" ON meldiq."profile_collectible_transactions" ("user_id", "decoration_id");
ALTER TABLE meldiq."profile_collectible_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."profile_collectible_transactions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."profile_collectible_transactions" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."profile_collectible_transactions" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."profile_collectible_transactions" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."profile_collectible_uploads" (
  "id" text NOT NULL,
  "actor_id" text NOT NULL,
  "size" bigint NOT NULL,
  "sha256" text NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "profile_collectible_uploads_idx_collectible_upload_expiry" ON meldiq."profile_collectible_uploads" ("expires_at");
ALTER TABLE meldiq."profile_collectible_uploads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."profile_collectible_uploads" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."profile_collectible_uploads" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."profile_collectible_uploads" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."profile_collectible_uploads" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."promoted_bookings" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "week_start" bigint NOT NULL,
  "state" text NOT NULL,
  "source" text NOT NULL,
  "price_cents" bigint NOT NULL,
  "starts_at" bigint NOT NULL,
  "ends_at" bigint NOT NULL,
  "views" bigint NOT NULL DEFAULT 0,
  "clicks" bigint NOT NULL DEFAULT 0,
  "joins" bigint NOT NULL DEFAULT 0,
  "note" text,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (state IN ('pending', 'active', 'cancelled')),
  CHECK (source IN ('grant', 'purchase'))
);
CREATE INDEX "promoted_bookings_idx_promoted_bookings_org" ON meldiq."promoted_bookings" ("org_id");
CREATE INDEX "promoted_bookings_idx_promoted_bookings_week" ON meldiq."promoted_bookings" ("week_start");
ALTER TABLE meldiq."promoted_bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."promoted_bookings" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."promoted_bookings" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."promoted_bookings" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."promoted_bookings" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."push_endpoints" (
  "device_id" text NOT NULL,
  "kind" text NOT NULL,
  "endpoint" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "last_wake_at" bigint,
  "failing_since" bigint,
  PRIMARY KEY ("device_id"),
  CHECK (kind IN ('unifiedpush'))
);
CREATE UNIQUE INDEX "push_endpoints_sqlite_autoindex_push_endpoints_2" ON meldiq."push_endpoints" ("endpoint");
ALTER TABLE meldiq."push_endpoints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."push_endpoints" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."push_endpoints" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."push_endpoints" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."push_endpoints" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."quota_counters" (
  "scope_type" text NOT NULL,
  "scope_id" text NOT NULL,
  "quota_key" text NOT NULL,
  "period_start" text NOT NULL,
  "used" bigint NOT NULL DEFAULT 0,
  "reserved" bigint NOT NULL DEFAULT 0,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("scope_type", "scope_id", "quota_key", "period_start")
);
ALTER TABLE meldiq."quota_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."quota_counters" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."quota_counters" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."quota_counters" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."quota_counters" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."quota_events" (
  "id" bigint NOT NULL,
  "at" bigint NOT NULL,
  "quota_key" text NOT NULL,
  "scope_type" text NOT NULL,
  "scope_id" text NOT NULL,
  "outcome" text NOT NULL,
  "amount" bigint NOT NULL,
  "used" bigint NOT NULL,
  "limit_value" bigint,
  "policy_id" text,
  "actor" text,
  "detail" text,
  PRIMARY KEY ("id"),
  CHECK (outcome IN ('warned', 'throttled', 'blocked', 'observed_over', 'soft_over', 'adjusted', 'expired_reservation'))
);
CREATE INDEX "quota_events_idx_quota_events_scope" ON meldiq."quota_events" ("scope_type", "scope_id", "at");
CREATE INDEX "quota_events_idx_quota_events_at" ON meldiq."quota_events" ("at");
ALTER TABLE meldiq."quota_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."quota_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."quota_events" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."quota_events" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."quota_events" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."quota_plan_members" (
  "scope_type" text NOT NULL,
  "scope_id" text NOT NULL,
  "plan_id" text NOT NULL,
  "assigned_by" text NOT NULL,
  "assigned_at" bigint NOT NULL,
  PRIMARY KEY ("scope_type", "scope_id"),
  CHECK (scope_type IN ('org', 'user'))
);
ALTER TABLE meldiq."quota_plan_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."quota_plan_members" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."quota_plan_members" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."quota_plan_members" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."quota_plan_members" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."quota_plans" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "archived_at" bigint,
  PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "quota_plans_sqlite_autoindex_quota_plans_2" ON meldiq."quota_plans" ("name");
ALTER TABLE meldiq."quota_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."quota_plans" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."quota_plans" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."quota_plans" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."quota_plans" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."quota_policies" (
  "id" text NOT NULL,
  "scope_type" text NOT NULL,
  "scope_id" text NOT NULL DEFAULT '',
  "quota_key" text NOT NULL,
  "limit_value" bigint,
  "mode" text NOT NULL,
  "hard" bigint NOT NULL DEFAULT 0,
  "warn_pct" bigint NOT NULL DEFAULT 80,
  "grace_pct" bigint NOT NULL DEFAULT 0,
  "override" bigint NOT NULL DEFAULT 0,
  "expires_at" bigint,
  "reason" text NOT NULL,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "superseded_at" bigint,
  "superseded_by" text,
  PRIMARY KEY ("id"),
  CHECK (scope_type IN ('global', 'pool', 'plan', 'org', 'user')),
  CHECK (mode IN ('observe', 'warn', 'soft', 'throttle', 'block'))
);
CREATE INDEX "quota_policies_idx_quota_policies_key" ON meldiq."quota_policies" ("quota_key");
CREATE INDEX "quota_policies_idx_quota_policies_scope" ON meldiq."quota_policies" ("scope_type", "scope_id", "quota_key");
ALTER TABLE meldiq."quota_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."quota_policies" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."quota_policies" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."quota_policies" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."quota_policies" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."quota_reservations" (
  "id" text NOT NULL,
  "idempotency_key" text,
  "quota_key" text NOT NULL,
  "scopes" text NOT NULL,
  "amount" bigint NOT NULL,
  "state" text NOT NULL,
  "settled_amount" bigint,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "settled_at" bigint,
  PRIMARY KEY ("id"),
  CHECK (state IN ('reserved', 'committed', 'released', 'expired'))
);
CREATE INDEX "quota_reservations_idx_quota_reservations_open" ON meldiq."quota_reservations" ("expires_at");
CREATE UNIQUE INDEX "quota_reservations_sqlite_autoindex_quota_reservations_2" ON meldiq."quota_reservations" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL;
ALTER TABLE meldiq."quota_reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."quota_reservations" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."quota_reservations" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."quota_reservations" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."quota_reservations" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."reaction_roles" (
  "message_id" text NOT NULL,
  "emoji" text NOT NULL,
  "org_id" text NOT NULL,
  "channel_id" text NOT NULL,
  "role_id" text NOT NULL,
  "position" bigint NOT NULL,
  "set_by" text NOT NULL,
  "set_at" bigint NOT NULL,
  PRIMARY KEY ("message_id", "emoji")
);
CREATE INDEX "reaction_roles_idx_reaction_roles_role" ON meldiq."reaction_roles" ("role_id");
CREATE INDEX "reaction_roles_idx_reaction_roles_org" ON meldiq."reaction_roles" ("org_id");
ALTER TABLE meldiq."reaction_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."reaction_roles" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."reaction_roles" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."reaction_roles" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."reaction_roles" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."registration_invites" (
  "id" text NOT NULL,
  "code_hash" text NOT NULL,
  "code_hint" text NOT NULL,
  "note" text,
  "max_uses" bigint NOT NULL,
  "uses" bigint NOT NULL DEFAULT 0,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "revoked_at" bigint,
  "purpose" text NOT NULL DEFAULT 'registration',
  PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "registration_invites_sqlite_autoindex_registration_invites_2" ON meldiq."registration_invites" ("code_hash");
ALTER TABLE meldiq."registration_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."registration_invites" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."registration_invites" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."registration_invites" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."registration_invites" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."reminder_occurrences" (
  "reminder_id" text NOT NULL,
  "occurrence_at" bigint NOT NULL,
  "fired_at" bigint NOT NULL,
  PRIMARY KEY ("reminder_id", "occurrence_at")
);
CREATE INDEX "reminder_occurrences_idx_reminder_occurrences_fired" ON meldiq."reminder_occurrences" ("fired_at");
ALTER TABLE meldiq."reminder_occurrences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."reminder_occurrences" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."reminder_occurrences" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."reminder_occurrences" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."reminder_occurrences" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."reminders" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "sealed" text NOT NULL,
  "due_at" bigint NOT NULL,
  "time_zone" text NOT NULL,
  "recurrence" text,
  "local_time" text,
  "anchor_date" text,
  "state" text NOT NULL,
  "fired_at" bigint,
  "delivered_at" bigint,
  "attempts" bigint NOT NULL DEFAULT 0,
  "next_attempt_at" bigint,
  "last_error" text,
  "rev" bigint NOT NULL DEFAULT 1,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "completed_at" bigint,
  PRIMARY KEY ("id"),
  CHECK (recurrence IN ('daily','weekdays','weekly','monthly')),
  CHECK (state IN ('scheduled','fired','done','dismissed'))
);
CREATE INDEX "reminders_idx_reminders_user" ON meldiq."reminders" ("user_id", "state", "due_at");
CREATE INDEX "reminders_idx_reminders_due" ON meldiq."reminders" ("state", "due_at");
ALTER TABLE meldiq."reminders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."reminders" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."reminders" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."reminders" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."reminders" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."reports" (
  "id" text NOT NULL,
  "org_id" text,
  "reporter_id" text NOT NULL,
  "target_user_id" text NOT NULL,
  "conversation_id" text,
  "message_id" text,
  "reason" text NOT NULL,
  "note" text,
  "content" text,
  "status" text NOT NULL DEFAULT 'open',
  "handled_by" text,
  "handled_note" text,
  "created_at" bigint NOT NULL,
  "handled_at" bigint,
  PRIMARY KEY ("id"),
  CHECK (status IN ('open', 'actioned', 'dismissed'))
);
CREATE INDEX "reports_idx_reports_admin" ON meldiq."reports" ("status", "created_at", "id");
CREATE INDEX "reports_reports_target" ON meldiq."reports" ("target_user_id");
CREATE INDEX "reports_reports_reporter" ON meldiq."reports" ("reporter_id", "created_at");
CREATE INDEX "reports_reports_org_status" ON meldiq."reports" ("org_id", "status", "created_at");
ALTER TABLE meldiq."reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."reports" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."reports" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."reports" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."reports" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."resource_hourly" (
  "hour" bigint NOT NULL,
  "series" text NOT NULL,
  "avg" double precision NOT NULL,
  "min" double precision NOT NULL,
  "max" double precision NOT NULL,
  "samples" bigint NOT NULL,
  PRIMARY KEY ("series", "hour")
);
ALTER TABLE meldiq."resource_hourly" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."resource_hourly" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."resource_hourly" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."resource_hourly" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."resource_hourly" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."resource_samples" (
  "minute" bigint NOT NULL,
  "series" text NOT NULL,
  "value" double precision NOT NULL,
  PRIMARY KEY ("series", "minute")
);
CREATE INDEX "resource_samples_idx_resource_samples_minute" ON meldiq."resource_samples" ("minute");
ALTER TABLE meldiq."resource_samples" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."resource_samples" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."resource_samples" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."resource_samples" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."resource_samples" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."session_clients" (
  "session_id" text NOT NULL,
  "platform" text NOT NULL,
  "client" text NOT NULL,
  "client_version" text NOT NULL DEFAULT '',
  "os" text NOT NULL DEFAULT '',
  "first_seen_at" bigint NOT NULL,
  "last_seen_at" bigint NOT NULL,
  PRIMARY KEY ("session_id")
);
ALTER TABLE meldiq."session_clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."session_clients" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."session_clients" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."session_clients" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."session_clients" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."sessions" (
  "token_hash" text NOT NULL,
  "user_id" text NOT NULL,
  "device_id" text NOT NULL,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("token_hash")
);
CREATE INDEX "sessions_idx_sessions_device" ON meldiq."sessions" ("device_id");
ALTER TABLE meldiq."sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."sessions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."sessions" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."sessions" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."sessions" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."spark_assignments" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "org_id" text NOT NULL,
  "assigned_at" bigint NOT NULL,
  "removed_at" bigint,
  "removed_reason" text,
  PRIMARY KEY ("id"),
  CHECK (removed_reason IN ('removed', 'moved', 'left', 'org_deleted', 'account_deleted'))
);
CREATE INDEX "spark_assignments_idx_spark_assignments_org" ON meldiq."spark_assignments" ("org_id");
CREATE INDEX "spark_assignments_idx_spark_assignments_user" ON meldiq."spark_assignments" ("user_id", "assigned_at");
ALTER TABLE meldiq."spark_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."spark_assignments" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."spark_assignments" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."spark_assignments" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."spark_assignments" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."spark_purchases" (
  "id" text NOT NULL,
  "buyer_account_id" text,
  "buyer_user_id" text,
  "quantity" bigint NOT NULL,
  "currency" text NOT NULL,
  "amount_minor" bigint NOT NULL,
  "status" text NOT NULL,
  "provider" text NOT NULL,
  "provider_session_ref" text,
  "provider_payment_ref" text,
  "request_key" text,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "paid_at" bigint,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id"),
  CHECK (quantity > 0 AND quantity <= 20),
  CHECK (amount_minor > 0),
  CHECK (status IN ('pending','paid','refunded','expired','failed'))
);
CREATE INDEX "spark_purchases_idx_spark_purchase_slots" ON meldiq."spark_purchases" ("buyer_user_id", "status");
CREATE UNIQUE INDEX "spark_purchases_idx_spark_purchase_payment" ON meldiq."spark_purchases" ("provider", "provider_payment_ref") WHERE "provider_payment_ref" IS NOT NULL;
CREATE UNIQUE INDEX "spark_purchases_idx_spark_purchase_request" ON meldiq."spark_purchases" ("provider", "buyer_account_id", "request_key") WHERE "request_key" IS NOT NULL;
ALTER TABLE meldiq."spark_purchases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."spark_purchases" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."spark_purchases" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."spark_purchases" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."spark_purchases" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."stage_speakers" (
  "conversation_id" text NOT NULL,
  "user_id" text NOT NULL,
  "granted_by" text NOT NULL,
  "granted_at" bigint NOT NULL,
  PRIMARY KEY ("conversation_id", "user_id")
);
ALTER TABLE meldiq."stage_speakers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."stage_speakers" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."stage_speakers" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."stage_speakers" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."stage_speakers" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."submitted_messages" (
  "message_id" text NOT NULL,
  "sender_device_id" text NOT NULL,
  "sender_user_id" text NOT NULL,
  "conversation_id" text NOT NULL,
  "recipient_count" bigint NOT NULL,
  "server_ts" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY ("message_id")
);
CREATE INDEX "submitted_messages_idx_submitted_expiry" ON meldiq."submitted_messages" ("expires_at");
ALTER TABLE meldiq."submitted_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."submitted_messages" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."submitted_messages" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."submitted_messages" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."submitted_messages" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."team_members" (
  "team_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role" text NOT NULL,
  "joined_at" bigint NOT NULL,
  PRIMARY KEY ("team_id", "user_id"),
  CHECK (role IN ('LEAD','MEMBER'))
);
CREATE INDEX "team_members_idx_team_members_user" ON meldiq."team_members" ("user_id");
ALTER TABLE meldiq."team_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."team_members" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."team_members" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."team_members" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."team_members" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."teams" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "branch_id" text,
  "department_id" text,
  "name" text NOT NULL,
  "description" text,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "archived_at" bigint,
  PRIMARY KEY ("id")
);
CREATE INDEX "teams_idx_teams_branch" ON meldiq."teams" ("branch_id");
CREATE INDEX "teams_idx_teams_org" ON meldiq."teams" ("org_id");
ALTER TABLE meldiq."teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."teams" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."teams" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."teams" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."teams" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."telemetry_epochs" (
  "kind" text NOT NULL,
  "started_at" bigint NOT NULL,
  PRIMARY KEY ("kind")
);
ALTER TABLE meldiq."telemetry_epochs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."telemetry_epochs" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."telemetry_epochs" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."telemetry_epochs" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."telemetry_epochs" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."ticket_panels" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "name" text NOT NULL,
  "position" bigint NOT NULL,
  "post_channel_id" text,
  "category_id" text,
  "log_channel_id" text,
  "posted_message_id" text,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "ticket_panels_idx_ticket_panels_org" ON meldiq."ticket_panels" ("org_id");
ALTER TABLE meldiq."ticket_panels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."ticket_panels" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."ticket_panels" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."ticket_panels" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."ticket_panels" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."tickets" (
  "channel_id" text NOT NULL,
  "org_id" text NOT NULL,
  "panel_id" text,
  "number" bigint NOT NULL,
  "opener_id" text NOT NULL,
  "about" text NOT NULL,
  "opened_at" bigint NOT NULL,
  "closed_at" bigint,
  "closed_by" text,
  PRIMARY KEY ("channel_id")
);
CREATE INDEX "tickets_idx_tickets_opener" ON meldiq."tickets" ("org_id", "opener_id");
CREATE INDEX "tickets_idx_tickets_org" ON meldiq."tickets" ("org_id", "closed_at");
ALTER TABLE meldiq."tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."tickets" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."tickets" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."tickets" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."tickets" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."traffic_user_daily" (
  "day" text NOT NULL,
  "user_id" text NOT NULL,
  "metric" text NOT NULL,
  "value" bigint NOT NULL,
  PRIMARY KEY ("day", "user_id", "metric")
);
CREATE INDEX "traffic_user_daily_idx_traffic_user_daily_user" ON meldiq."traffic_user_daily" ("user_id", "day");
ALTER TABLE meldiq."traffic_user_daily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."traffic_user_daily" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."traffic_user_daily" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."traffic_user_daily" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."traffic_user_daily" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."usage_daily" (
  "org_id" text NOT NULL,
  "day" text NOT NULL,
  "metric" text NOT NULL,
  "value" bigint NOT NULL,
  PRIMARY KEY ("org_id", "day", "metric")
);
ALTER TABLE meldiq."usage_daily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."usage_daily" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."usage_daily" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."usage_daily" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."usage_daily" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."user_blocks" (
  "user_id" text NOT NULL,
  "blocked_user_id" text NOT NULL,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("user_id", "blocked_user_id")
);
ALTER TABLE meldiq."user_blocks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."user_blocks" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."user_blocks" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."user_blocks" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."user_blocks" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."user_group_members" (
  "group_id" text NOT NULL,
  "user_id" text NOT NULL,
  "added_by" text NOT NULL,
  "added_at" bigint NOT NULL,
  PRIMARY KEY ("group_id", "user_id")
);
CREATE INDEX "user_group_members_idx_user_group_members_user" ON meldiq."user_group_members" ("user_id");
ALTER TABLE meldiq."user_group_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."user_group_members" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."user_group_members" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."user_group_members" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."user_group_members" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."user_groups" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "name" text NOT NULL,
  "handle" text NOT NULL,
  "description" text,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_groups_sqlite_autoindex_user_groups_2" ON meldiq."user_groups" ("org_id", "handle");
ALTER TABLE meldiq."user_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."user_groups" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."user_groups" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."user_groups" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."user_groups" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."users" (
  "id" text NOT NULL,
  "username" text NOT NULL,
  "display_name" text NOT NULL,
  "identity_key" text NOT NULL,
  "avatar_color" bigint NOT NULL DEFAULT 0,
  "status_text" text,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "disabled_at" bigint,
  "home_server_id" text,
  "remote_synced_at" bigint,
  "first_name" text,
  "last_name" text,
  "birthday" text,
  "phone" text,
  "photo_rev" bigint,
  "privacy" text,
  "username_changed_at" bigint,
  "limited_until" bigint,
  "deleted_at" bigint,
  "status_emoji" text,
  "status_expires_at" bigint,
  "notifications_paused_until" bigint,
  "presence_mode" text,
  "presence_until" bigint,
  "pronouns" text,
  "synthetic" bigint NOT NULL DEFAULT 0,
  "kind" text NOT NULL DEFAULT 'person',
  "avatar_media" text,
  "profile_banner" text,
  "profile_style" text,
  "about_me" text,
  "profile_links" text,
  PRIMARY KEY ("id"),
  CHECK (kind IN ('person', 'agent'))
);
CREATE INDEX "users_idx_users_phone" ON meldiq."users" ("phone") WHERE "phone" IS NOT NULL;
CREATE INDEX "users_idx_users_home" ON meldiq."users" ("home_server_id") WHERE "home_server_id" IS NOT NULL;
CREATE UNIQUE INDEX "users_sqlite_autoindex_users_2" ON meldiq."users" ((translate("username", 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')));
ALTER TABLE meldiq."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."users" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."users" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."users" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."users" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."webhook_deliveries" (
  "id" text NOT NULL,
  "webhook_id" text NOT NULL,
  "org_id" text NOT NULL,
  "event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "payload" text NOT NULL,
  "state" text NOT NULL,
  "attempts" bigint NOT NULL DEFAULT 0,
  "next_at" bigint NOT NULL,
  "lease_until" bigint,
  "last_status" bigint,
  "last_error" text,
  "created_at" bigint NOT NULL,
  "delivered_at" bigint,
  PRIMARY KEY ("id"),
  CHECK (state IN ('queued','sending','delivered','failed'))
);
CREATE INDEX "webhook_deliveries_idx_webhook_deliveries_hook" ON meldiq."webhook_deliveries" ("webhook_id", "created_at");
CREATE INDEX "webhook_deliveries_idx_webhook_deliveries_due" ON meldiq."webhook_deliveries" ("state", "next_at");
CREATE UNIQUE INDEX "webhook_deliveries_sqlite_autoindex_webhook_deliveries_2" ON meldiq."webhook_deliveries" ("webhook_id", "event_id");
ALTER TABLE meldiq."webhook_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."webhook_deliveries" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."webhook_deliveries" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."webhook_deliveries" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."webhook_deliveries" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."webhooks" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "name" text NOT NULL,
  "url" text NOT NULL,
  "events" text NOT NULL,
  "secret_sealed" text NOT NULL,
  "enabled" bigint NOT NULL DEFAULT 1,
  "disabled_reason" text,
  "consecutive_failures" bigint NOT NULL DEFAULT 0,
  "verified_at" bigint,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "webhooks_idx_webhooks_org" ON meldiq."webhooks" ("org_id");
ALTER TABLE meldiq."webhooks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."webhooks" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."webhooks" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."webhooks" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."webhooks" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."workflow_runs" (
  "id" text NOT NULL,
  "workflow_id" text NOT NULL,
  "org_id" text NOT NULL,
  "event_key" text NOT NULL,
  "event_json" text NOT NULL,
  "depth" bigint NOT NULL DEFAULT 0,
  "state" text NOT NULL,
  "attempts" bigint NOT NULL DEFAULT 0,
  "next_at" bigint NOT NULL,
  "lease_until" bigint,
  "dry_run" bigint NOT NULL DEFAULT 0,
  "outcome_json" text,
  "error_kind" text,
  "created_at" bigint NOT NULL,
  "finished_at" bigint,
  PRIMARY KEY ("id"),
  CHECK (state IN ('queued','running','done','failed','skipped','cancelled'))
);
CREATE INDEX "workflow_runs_idx_workflow_runs_org" ON meldiq."workflow_runs" ("org_id", "created_at");
CREATE INDEX "workflow_runs_idx_workflow_runs_wf" ON meldiq."workflow_runs" ("workflow_id", "created_at");
CREATE INDEX "workflow_runs_idx_workflow_runs_due" ON meldiq."workflow_runs" ("state", "next_at");
CREATE UNIQUE INDEX "workflow_runs_sqlite_autoindex_workflow_runs_2" ON meldiq."workflow_runs" ("workflow_id", "event_key");
ALTER TABLE meldiq."workflow_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."workflow_runs" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."workflow_runs" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."workflow_runs" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."workflow_runs" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE TABLE meldiq."workflows" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "name" text NOT NULL,
  "trigger_type" text NOT NULL,
  "trigger_json" text NOT NULL,
  "conditions_json" text NOT NULL,
  "actions_json" text NOT NULL,
  "enabled" bigint NOT NULL DEFAULT 1,
  "owner_id" text NOT NULL,
  "next_run_at" bigint,
  "rev" bigint NOT NULL DEFAULT 1,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  PRIMARY KEY ("id")
);
CREATE INDEX "workflows_idx_workflows_schedule" ON meldiq."workflows" ("next_run_at") WHERE "next_run_at" IS NOT NULL;
CREATE INDEX "workflows_idx_workflows_org" ON meldiq."workflows" ("org_id", "trigger_type");
ALTER TABLE meldiq."workflows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."workflows" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."workflows" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."workflows" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."workflows" FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
ALTER TABLE meldiq."account_codes" ADD CONSTRAINT "account_codes_fk_0" FOREIGN KEY ("account_id") REFERENCES meldiq."accounts" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."account_key_backups" ADD CONSTRAINT "account_key_backups_fk_0" FOREIGN KEY ("account_id") REFERENCES meldiq."accounts" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."account_key_unlocks" ADD CONSTRAINT "account_key_unlocks_fk_0" FOREIGN KEY ("account_id") REFERENCES meldiq."accounts" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."account_recovery_codes" ADD CONSTRAINT "account_recovery_codes_fk_0" FOREIGN KEY ("account_id") REFERENCES meldiq."accounts" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."account_recovery_tickets" ADD CONSTRAINT "account_recovery_tickets_fk_0" FOREIGN KEY ("account_id") REFERENCES meldiq."accounts" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."account_session_factors" ADD CONSTRAINT "account_session_factors_fk_0" FOREIGN KEY ("account_id") REFERENCES meldiq."accounts" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."account_session_factors" ADD CONSTRAINT "account_session_factors_fk_1" FOREIGN KEY ("id") REFERENCES meldiq."account_sessions" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."account_sessions" ADD CONSTRAINT "account_sessions_fk_0" FOREIGN KEY ("device_id") REFERENCES meldiq."devices" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."account_sessions" ADD CONSTRAINT "account_sessions_fk_1" FOREIGN KEY ("account_id") REFERENCES meldiq."accounts" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."account_warnings" ADD CONSTRAINT "account_warnings_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."accounts" ADD CONSTRAINT "accounts_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."ai_models" ADD CONSTRAINT "ai_models_fk_0" FOREIGN KEY ("provider_id") REFERENCES meldiq."ai_providers" ("id") ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."api_keys" ADD CONSTRAINT "api_keys_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."attachment_uploads" ADD CONSTRAINT "attachment_uploads_fk_0" FOREIGN KEY ("conversation_id") REFERENCES meldiq."conversations" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."attachment_uploads" ADD CONSTRAINT "attachment_uploads_fk_1" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."attachments" ADD CONSTRAINT "attachments_fk_0" FOREIGN KEY ("conversation_id") REFERENCES meldiq."conversations" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."billing_checkouts" ADD CONSTRAINT "billing_checkouts_fk_0" FOREIGN KEY ("plan_version_id") REFERENCES meldiq."billing_plan_versions" ("id") ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."billing_plan_versions" ADD CONSTRAINT "billing_plan_versions_fk_0" FOREIGN KEY ("plan_id") REFERENCES meldiq."billing_plans" ("id") ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_fk_0" FOREIGN KEY ("plan_version_id") REFERENCES meldiq."billing_plan_versions" ("id") ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."bot_afk" ADD CONSTRAINT "bot_afk_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."bot_alert_watches" ADD CONSTRAINT "bot_alert_watches_fk_0" FOREIGN KEY ("channel_id") REFERENCES meldiq."conversations" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."bot_alert_watches" ADD CONSTRAINT "bot_alert_watches_fk_1" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."bot_giveaways" ADD CONSTRAINT "bot_giveaways_fk_0" FOREIGN KEY ("channel_id") REFERENCES meldiq."conversations" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."bot_giveaways" ADD CONSTRAINT "bot_giveaways_fk_1" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."bot_levels" ADD CONSTRAINT "bot_levels_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."bot_runtime_events" ADD CONSTRAINT "bot_runtime_events_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."bot_starboard" ADD CONSTRAINT "bot_starboard_fk_0" FOREIGN KEY ("channel_id") REFERENCES meldiq."conversations" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."bot_starboard" ADD CONSTRAINT "bot_starboard_fk_1" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."bot_wordy_games" ADD CONSTRAINT "bot_wordy_games_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."bot_wordy_recaps" ADD CONSTRAINT "bot_wordy_recaps_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."bot_wordy_stats" ADD CONSTRAINT "bot_wordy_stats_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."branch_members" ADD CONSTRAINT "branch_members_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."branch_members" ADD CONSTRAINT "branch_members_fk_1" FOREIGN KEY ("branch_id") REFERENCES meldiq."branches" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."branches" ADD CONSTRAINT "branches_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."bug_reports" ADD CONSTRAINT "bug_reports_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."call_hands" ADD CONSTRAINT "call_hands_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."call_hands" ADD CONSTRAINT "call_hands_fk_1" FOREIGN KEY ("call_id") REFERENCES meldiq."calls" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."call_participants" ADD CONSTRAINT "call_participants_fk_0" FOREIGN KEY ("call_id") REFERENCES meldiq."calls" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."calls" ADD CONSTRAINT "calls_fk_0" FOREIGN KEY ("created_by") REFERENCES meldiq."users" ("id") ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."calls" ADD CONSTRAINT "calls_fk_1" FOREIGN KEY ("conversation_id") REFERENCES meldiq."conversations" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."channel_categories" ADD CONSTRAINT "channel_categories_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."channel_options" ADD CONSTRAINT "channel_options_fk_0" FOREIGN KEY ("conversation_id") REFERENCES meldiq."conversations" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."channel_overwrites" ADD CONSTRAINT "channel_overwrites_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."channel_webhooks" ADD CONSTRAINT "channel_webhooks_fk_0" FOREIGN KEY ("channel_id") REFERENCES meldiq."conversations" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."channel_webhooks" ADD CONSTRAINT "channel_webhooks_fk_1" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_discovery" ADD CONSTRAINT "community_discovery_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_expressions" ADD CONSTRAINT "community_expressions_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_lobbies" ADD CONSTRAINT "community_lobbies_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_lobby_feeds" ADD CONSTRAINT "community_lobby_feeds_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_lobby_posts" ADD CONSTRAINT "community_lobby_posts_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_lobby_seen" ADD CONSTRAINT "community_lobby_seen_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_member_defaults" ADD CONSTRAINT "community_member_defaults_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_onboarding" ADD CONSTRAINT "community_onboarding_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_profiles" ADD CONSTRAINT "community_profiles_fk_0" FOREIGN KEY ("org_id", "user_id") REFERENCES meldiq."org_members" ("org_id", "user_id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_settings" ADD CONSTRAINT "community_settings_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_standard_invites" ADD CONSTRAINT "community_standard_invites_fk_0" FOREIGN KEY ("invite_id") REFERENCES meldiq."invitations" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_standard_invites" ADD CONSTRAINT "community_standard_invites_fk_1" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_templates" ADD CONSTRAINT "community_templates_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_tickets" ADD CONSTRAINT "community_tickets_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_vanity_invites" ADD CONSTRAINT "community_vanity_invites_fk_0" FOREIGN KEY ("invite_id") REFERENCES meldiq."invitations" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_vanity_invites" ADD CONSTRAINT "community_vanity_invites_fk_1" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."conversation_members" ADD CONSTRAINT "conversation_members_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."conversation_members" ADD CONSTRAINT "conversation_members_fk_1" FOREIGN KEY ("conversation_id") REFERENCES meldiq."conversations" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."conversations" ADD CONSTRAINT "conversations_fk_0" FOREIGN KEY ("category_id") REFERENCES meldiq."channel_categories" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."conversations" ADD CONSTRAINT "conversations_fk_1" FOREIGN KEY ("created_by") REFERENCES meldiq."users" ("id") ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."conversations" ADD CONSTRAINT "conversations_fk_2" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."departments" ADD CONSTRAINT "departments_fk_0" FOREIGN KEY ("branch_id") REFERENCES meldiq."branches" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."departments" ADD CONSTRAINT "departments_fk_1" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."devices" ADD CONSTRAINT "devices_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."discord_connections" ADD CONSTRAINT "discord_connections_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."discord_import_items" ADD CONSTRAINT "discord_import_items_fk_0" FOREIGN KEY ("import_id") REFERENCES meldiq."discord_imports" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."discord_imports" ADD CONSTRAINT "discord_imports_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."discord_imports" ADD CONSTRAINT "discord_imports_fk_1" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."discord_oauth_states" ADD CONSTRAINT "discord_oauth_states_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."discovery_boosts" ADD CONSTRAINT "discovery_boosts_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."discovery_clicks" ADD CONSTRAINT "discovery_clicks_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."document_comments" ADD CONSTRAINT "document_comments_fk_0" FOREIGN KEY ("document_id") REFERENCES meldiq."documents" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."document_members" ADD CONSTRAINT "document_members_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."document_members" ADD CONSTRAINT "document_members_fk_1" FOREIGN KEY ("document_id") REFERENCES meldiq."documents" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."document_versions" ADD CONSTRAINT "document_versions_fk_0" FOREIGN KEY ("document_id") REFERENCES meldiq."documents" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."documents" ADD CONSTRAINT "documents_fk_0" FOREIGN KEY ("channel_id") REFERENCES meldiq."conversations" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."documents" ADD CONSTRAINT "documents_fk_1" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."fcm_tokens" ADD CONSTRAINT "fcm_tokens_fk_0" FOREIGN KEY ("device_id") REFERENCES meldiq."devices" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."history_accounts" ADD CONSTRAINT "history_accounts_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."history_items" ADD CONSTRAINT "history_items_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."inbox_accounts" ADD CONSTRAINT "inbox_accounts_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."inbox_contacts" ADD CONSTRAINT "inbox_contacts_fk_0" FOREIGN KEY ("account_id") REFERENCES meldiq."inbox_accounts" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."inbox_contacts" ADD CONSTRAINT "inbox_contacts_fk_1" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."inbox_conversations" ADD CONSTRAINT "inbox_conversations_fk_0" FOREIGN KEY ("contact_id") REFERENCES meldiq."inbox_contacts" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."inbox_conversations" ADD CONSTRAINT "inbox_conversations_fk_1" FOREIGN KEY ("account_id") REFERENCES meldiq."inbox_accounts" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."inbox_conversations" ADD CONSTRAINT "inbox_conversations_fk_2" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."inbox_messages" ADD CONSTRAINT "inbox_messages_fk_0" FOREIGN KEY ("conversation_id") REFERENCES meldiq."inbox_conversations" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."inbox_queues" ADD CONSTRAINT "inbox_queues_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."inbox_settings" ADD CONSTRAINT "inbox_settings_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."invitations" ADD CONSTRAINT "invitations_fk_0" FOREIGN KEY ("grant_role_id") REFERENCES meldiq."org_roles" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."invitations" ADD CONSTRAINT "invitations_fk_1" FOREIGN KEY ("created_by") REFERENCES meldiq."users" ("id") ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."invitations" ADD CONSTRAINT "invitations_fk_2" FOREIGN KEY ("team_id") REFERENCES meldiq."teams" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."invitations" ADD CONSTRAINT "invitations_fk_3" FOREIGN KEY ("branch_id") REFERENCES meldiq."branches" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."invitations" ADD CONSTRAINT "invitations_fk_4" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."join_applications" ADD CONSTRAINT "join_applications_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."legacy_tickets" ADD CONSTRAINT "legacy_tickets_fk_0" FOREIGN KEY ("account_id") REFERENCES meldiq."accounts" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."legacy_tickets" ADD CONSTRAINT "legacy_tickets_fk_1" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."meeting_participants" ADD CONSTRAINT "meeting_participants_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."meeting_participants" ADD CONSTRAINT "meeting_participants_fk_1" FOREIGN KEY ("meeting_id") REFERENCES meldiq."meetings" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."meetings" ADD CONSTRAINT "meetings_fk_0" FOREIGN KEY ("room_id") REFERENCES meldiq."conversations" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."meetings" ADD CONSTRAINT "meetings_fk_1" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."nav_preferences" ADD CONSTRAINT "nav_preferences_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."official_bots" ADD CONSTRAINT "official_bots_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."official_bots_plus" ADD CONSTRAINT "official_bots_plus_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."onboarding_answers" ADD CONSTRAINT "onboarding_answers_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."onboarding_completions" ADD CONSTRAINT "onboarding_completions_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."org_bans" ADD CONSTRAINT "org_bans_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."org_bans" ADD CONSTRAINT "org_bans_fk_1" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."org_entitlements" ADD CONSTRAINT "org_entitlements_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."org_members" ADD CONSTRAINT "org_members_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."org_members" ADD CONSTRAINT "org_members_fk_1" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."org_nicknames" ADD CONSTRAINT "org_nicknames_fk_0" FOREIGN KEY ("org_id", "user_id") REFERENCES meldiq."org_members" ("org_id", "user_id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."org_role_extras" ADD CONSTRAINT "org_role_extras_fk_0" FOREIGN KEY ("role_id") REFERENCES meldiq."org_roles" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."org_role_members" ADD CONSTRAINT "org_role_members_fk_0" FOREIGN KEY ("org_id", "user_id") REFERENCES meldiq."org_members" ("org_id", "user_id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."org_role_members" ADD CONSTRAINT "org_role_members_fk_1" FOREIGN KEY ("role_id") REFERENCES meldiq."org_roles" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."org_roles" ADD CONSTRAINT "org_roles_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."orgs" ADD CONSTRAINT "orgs_fk_0" FOREIGN KEY ("created_by") REFERENCES meldiq."users" ("id") ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."platform_incident_events" ADD CONSTRAINT "platform_incident_events_fk_0" FOREIGN KEY ("incident_id") REFERENCES meldiq."platform_incidents" ("id") ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."profile_collectible_inventory" ADD CONSTRAINT "profile_collectible_inventory_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."profile_collectible_transactions" ADD CONSTRAINT "profile_collectible_transactions_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."promoted_bookings" ADD CONSTRAINT "promoted_bookings_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."push_endpoints" ADD CONSTRAINT "push_endpoints_fk_0" FOREIGN KEY ("device_id") REFERENCES meldiq."devices" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."quota_plan_members" ADD CONSTRAINT "quota_plan_members_fk_0" FOREIGN KEY ("plan_id") REFERENCES meldiq."quota_plans" ("id") ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."reaction_roles" ADD CONSTRAINT "reaction_roles_fk_0" FOREIGN KEY ("role_id") REFERENCES meldiq."org_roles" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."reaction_roles" ADD CONSTRAINT "reaction_roles_fk_1" FOREIGN KEY ("channel_id") REFERENCES meldiq."conversations" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."reaction_roles" ADD CONSTRAINT "reaction_roles_fk_2" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."reminder_occurrences" ADD CONSTRAINT "reminder_occurrences_fk_0" FOREIGN KEY ("reminder_id") REFERENCES meldiq."reminders" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."reminders" ADD CONSTRAINT "reminders_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."sessions" ADD CONSTRAINT "sessions_fk_0" FOREIGN KEY ("device_id") REFERENCES meldiq."devices" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."sessions" ADD CONSTRAINT "sessions_fk_1" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."spark_purchases" ADD CONSTRAINT "spark_purchases_fk_0" FOREIGN KEY ("buyer_user_id") REFERENCES meldiq."users" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."stage_speakers" ADD CONSTRAINT "stage_speakers_fk_0" FOREIGN KEY ("conversation_id", "user_id") REFERENCES meldiq."conversation_members" ("conversation_id", "user_id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."team_members" ADD CONSTRAINT "team_members_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."team_members" ADD CONSTRAINT "team_members_fk_1" FOREIGN KEY ("team_id") REFERENCES meldiq."teams" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."teams" ADD CONSTRAINT "teams_fk_0" FOREIGN KEY ("department_id") REFERENCES meldiq."departments" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."teams" ADD CONSTRAINT "teams_fk_1" FOREIGN KEY ("branch_id") REFERENCES meldiq."branches" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."teams" ADD CONSTRAINT "teams_fk_2" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."ticket_panels" ADD CONSTRAINT "ticket_panels_fk_0" FOREIGN KEY ("log_channel_id") REFERENCES meldiq."conversations" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."ticket_panels" ADD CONSTRAINT "ticket_panels_fk_1" FOREIGN KEY ("category_id") REFERENCES meldiq."channel_categories" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."ticket_panels" ADD CONSTRAINT "ticket_panels_fk_2" FOREIGN KEY ("post_channel_id") REFERENCES meldiq."conversations" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."ticket_panels" ADD CONSTRAINT "ticket_panels_fk_3" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."tickets" ADD CONSTRAINT "tickets_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."tickets" ADD CONSTRAINT "tickets_fk_1" FOREIGN KEY ("channel_id") REFERENCES meldiq."conversations" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."usage_daily" ADD CONSTRAINT "usage_daily_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."user_blocks" ADD CONSTRAINT "user_blocks_fk_0" FOREIGN KEY ("blocked_user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."user_blocks" ADD CONSTRAINT "user_blocks_fk_1" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."user_group_members" ADD CONSTRAINT "user_group_members_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."user_group_members" ADD CONSTRAINT "user_group_members_fk_1" FOREIGN KEY ("group_id") REFERENCES meldiq."user_groups" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."user_groups" ADD CONSTRAINT "user_groups_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_fk_0" FOREIGN KEY ("webhook_id") REFERENCES meldiq."webhooks" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."webhooks" ADD CONSTRAINT "webhooks_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."workflow_runs" ADD CONSTRAINT "workflow_runs_fk_0" FOREIGN KEY ("workflow_id") REFERENCES meldiq."workflows" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."workflows" ADD CONSTRAINT "workflows_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
