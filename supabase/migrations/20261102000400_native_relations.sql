-- Explicit normalized fields from native Mongo implementations in release695f80b1.
CREATE TABLE meldiq."points_accounts" (
  "id" text NOT NULL,
  "balance" bigint NOT NULL,
  "earned_total" bigint NOT NULL,
  "level" bigint NOT NULL,
  "streak" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "last_visit_day" text,
  PRIMARY KEY(id)
);
CREATE INDEX "native_points_accounts_updated_at" ON meldiq."points_accounts" ("updated_at");
ALTER TABLE meldiq."points_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."points_accounts" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."points_accounts" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."points_accounts" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."points_accounts" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."points_ledger" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "kind" text NOT NULL,
  "day" text NOT NULL,
  "amount" bigint NOT NULL,
  "at" bigint NOT NULL,
  "detail" text,
  PRIMARY KEY(id)
);
CREATE INDEX "native_points_ledger_user_id" ON meldiq."points_ledger" ("user_id");
ALTER TABLE meldiq."points_ledger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."points_ledger" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."points_ledger" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."points_ledger" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."points_ledger" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."points_days" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "day" text NOT NULL,
  "earned" bigint NOT NULL,
  "chats" text[] NOT NULL,
  "reacted" text[] NOT NULL,
  "replied" text[] NOT NULL,
  "minutes" bigint[] NOT NULL,
  PRIMARY KEY(id)
);
CREATE INDEX "native_points_days_user_id" ON meldiq."points_days" ("user_id");
ALTER TABLE meldiq."points_days" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."points_days" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."points_days" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."points_days" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."points_days" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."points_invites" (
  "id" text NOT NULL,
  "inviter_id" text NOT NULL,
  "joiner_id" text NOT NULL,
  "org_id" text NOT NULL,
  "state" text NOT NULL,
  "joined_at" bigint NOT NULL,
  "settled_at" bigint,
  PRIMARY KEY(id)
);
CREATE INDEX "native_points_invites_inviter_id" ON meldiq."points_invites" ("inviter_id");
CREATE INDEX "native_points_invites_joiner_id" ON meldiq."points_invites" ("joiner_id");
CREATE INDEX "native_points_invites_org_id" ON meldiq."points_invites" ("org_id");
CREATE INDEX "native_points_invites_joined_at" ON meldiq."points_invites" ("joined_at");
CREATE INDEX "native_points_invites_settled_at" ON meldiq."points_invites" ("settled_at");
ALTER TABLE meldiq."points_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."points_invites" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."points_invites" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."points_invites" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."points_invites" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."oauth_apps" (
  "id" text NOT NULL,
  "owner_id" text NOT NULL,
  "name" text NOT NULL,
  "secret_hash" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "secret_rotated_at" bigint NOT NULL,
  "redirect_uris" text[] NOT NULL,
  PRIMARY KEY(id)
);
CREATE INDEX "native_oauth_apps_owner_id" ON meldiq."oauth_apps" ("owner_id");
CREATE INDEX "native_oauth_apps_created_at" ON meldiq."oauth_apps" ("created_at");
CREATE INDEX "native_oauth_apps_updated_at" ON meldiq."oauth_apps" ("updated_at");
CREATE INDEX "native_oauth_apps_secret_rotated_at" ON meldiq."oauth_apps" ("secret_rotated_at");
ALTER TABLE meldiq."oauth_apps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."oauth_apps" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."oauth_apps" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."oauth_apps" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."oauth_apps" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."oauth_codes" (
  "id" text NOT NULL,
  "app_id" text NOT NULL,
  "user_id" text NOT NULL,
  "redirect_uri" text NOT NULL,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "challenge" text,
  "family_id" text,
  "used_at" bigint,
  "scopes" text[] NOT NULL,
  PRIMARY KEY(id)
);
CREATE INDEX "native_oauth_codes_app_id" ON meldiq."oauth_codes" ("app_id");
CREATE INDEX "native_oauth_codes_user_id" ON meldiq."oauth_codes" ("user_id");
CREATE INDEX "native_oauth_codes_created_at" ON meldiq."oauth_codes" ("created_at");
CREATE INDEX "native_oauth_codes_expires_at" ON meldiq."oauth_codes" ("expires_at");
CREATE INDEX "native_oauth_codes_family_id" ON meldiq."oauth_codes" ("family_id");
CREATE INDEX "native_oauth_codes_used_at" ON meldiq."oauth_codes" ("used_at");
ALTER TABLE meldiq."oauth_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."oauth_codes" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."oauth_codes" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."oauth_codes" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."oauth_codes" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."oauth_grants" (
  "id" text NOT NULL,
  "app_id" text NOT NULL,
  "user_id" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "scopes" text[] NOT NULL,
  PRIMARY KEY(id)
);
CREATE INDEX "native_oauth_grants_app_id" ON meldiq."oauth_grants" ("app_id");
CREATE INDEX "native_oauth_grants_user_id" ON meldiq."oauth_grants" ("user_id");
CREATE INDEX "native_oauth_grants_created_at" ON meldiq."oauth_grants" ("created_at");
CREATE INDEX "native_oauth_grants_updated_at" ON meldiq."oauth_grants" ("updated_at");
ALTER TABLE meldiq."oauth_grants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."oauth_grants" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."oauth_grants" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."oauth_grants" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."oauth_grants" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."oauth_tokens" (
  "id" text NOT NULL,
  "app_id" text NOT NULL,
  "user_id" text NOT NULL,
  "access_hash" text NOT NULL,
  "refresh_hash" text NOT NULL,
  "access_expires_at" bigint NOT NULL,
  "refresh_expires_at" bigint NOT NULL,
  "created_at" bigint NOT NULL,
  "rotated_at" bigint NOT NULL,
  "previous_refresh_hash" text,
  "confidential" boolean NOT NULL,
  "scopes" text[] NOT NULL,
  PRIMARY KEY(id)
);
CREATE INDEX "native_oauth_tokens_app_id" ON meldiq."oauth_tokens" ("app_id");
CREATE INDEX "native_oauth_tokens_user_id" ON meldiq."oauth_tokens" ("user_id");
CREATE INDEX "native_oauth_tokens_access_expires_at" ON meldiq."oauth_tokens" ("access_expires_at");
CREATE INDEX "native_oauth_tokens_refresh_expires_at" ON meldiq."oauth_tokens" ("refresh_expires_at");
CREATE INDEX "native_oauth_tokens_created_at" ON meldiq."oauth_tokens" ("created_at");
CREATE INDEX "native_oauth_tokens_rotated_at" ON meldiq."oauth_tokens" ("rotated_at");
ALTER TABLE meldiq."oauth_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."oauth_tokens" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."oauth_tokens" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."oauth_tokens" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."oauth_tokens" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."bots" (
  "id" text NOT NULL,
  "owner_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "created_at" bigint NOT NULL,
  "token_rotated_at" bigint NOT NULL,
  "public" boolean NOT NULL,
  "commands" jsonb NOT NULL,
  PRIMARY KEY(id)
);
CREATE INDEX "native_bots_owner_id" ON meldiq."bots" ("owner_id");
CREATE INDEX "native_bots_created_at" ON meldiq."bots" ("created_at");
CREATE INDEX "native_bots_token_rotated_at" ON meldiq."bots" ("token_rotated_at");
ALTER TABLE meldiq."bots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."bots" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."bots" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."bots" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."bots" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."bot_interactions" (
  "id" text NOT NULL,
  "bot_id" text NOT NULL,
  "user_id" text NOT NULL,
  "org_id" text NOT NULL,
  "conversation_id" text NOT NULL,
  "command" text NOT NULL,
  "state" text NOT NULL,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "delivered_at" bigint,
  "replied_at" bigint,
  "options" jsonb NOT NULL,
  PRIMARY KEY(id)
);
CREATE INDEX "native_bot_interactions_bot_id" ON meldiq."bot_interactions" ("bot_id");
CREATE INDEX "native_bot_interactions_user_id" ON meldiq."bot_interactions" ("user_id");
CREATE INDEX "native_bot_interactions_org_id" ON meldiq."bot_interactions" ("org_id");
CREATE INDEX "native_bot_interactions_conversation_id" ON meldiq."bot_interactions" ("conversation_id");
CREATE INDEX "native_bot_interactions_created_at" ON meldiq."bot_interactions" ("created_at");
CREATE INDEX "native_bot_interactions_expires_at" ON meldiq."bot_interactions" ("expires_at");
CREATE INDEX "native_bot_interactions_delivered_at" ON meldiq."bot_interactions" ("delivered_at");
CREATE INDEX "native_bot_interactions_replied_at" ON meldiq."bot_interactions" ("replied_at");
ALTER TABLE meldiq."bot_interactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."bot_interactions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."bot_interactions" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."bot_interactions" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."bot_interactions" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."profile_decorations" (
  "id" text NOT NULL,
  "creator_id" text NOT NULL,
  "name" text NOT NULL,
  "status" text NOT NULL,
  "format" text NOT NULL,
  "size" bigint NOT NULL,
  "created_at" bigint NOT NULL,
  "wearers" bigint NOT NULL,
  "reviewed_by" text,
  "reason" text,
  "reviewed_at" bigint,
  "animated" boolean NOT NULL,
  PRIMARY KEY(id)
);
CREATE INDEX "native_profile_decorations_creator_id" ON meldiq."profile_decorations" ("creator_id");
CREATE INDEX "native_profile_decorations_created_at" ON meldiq."profile_decorations" ("created_at");
CREATE INDEX "native_profile_decorations_reviewed_at" ON meldiq."profile_decorations" ("reviewed_at");
ALTER TABLE meldiq."profile_decorations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."profile_decorations" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."profile_decorations" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."profile_decorations" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."profile_decorations" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."decoration_favorites" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "decoration_id" text NOT NULL,
  "created_at" bigint NOT NULL,
  PRIMARY KEY(id)
);
CREATE INDEX "native_decoration_favorites_user_id" ON meldiq."decoration_favorites" ("user_id");
CREATE INDEX "native_decoration_favorites_decoration_id" ON meldiq."decoration_favorites" ("decoration_id");
CREATE INDEX "native_decoration_favorites_created_at" ON meldiq."decoration_favorites" ("created_at");
ALTER TABLE meldiq."decoration_favorites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."decoration_favorites" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."decoration_favorites" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."decoration_favorites" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."decoration_favorites" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."community_pins" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "name" text NOT NULL,
  "format" text NOT NULL,
  "created_by" text NOT NULL,
  "created_at" bigint NOT NULL,
  "description" text,
  "animated" boolean NOT NULL,
  PRIMARY KEY(id)
);
CREATE INDEX "native_community_pins_org_id" ON meldiq."community_pins" ("org_id");
CREATE INDEX "native_community_pins_created_at" ON meldiq."community_pins" ("created_at");
ALTER TABLE meldiq."community_pins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_pins" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_pins" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_pins" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_pins" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."community_pin_awards" (
  "id" text NOT NULL,
  "pin_id" text NOT NULL,
  "org_id" text NOT NULL,
  "user_id" text NOT NULL,
  "awarded_by" text NOT NULL,
  "awarded_at" bigint NOT NULL,
  PRIMARY KEY(id)
);
CREATE INDEX "native_community_pin_awards_pin_id" ON meldiq."community_pin_awards" ("pin_id");
CREATE INDEX "native_community_pin_awards_org_id" ON meldiq."community_pin_awards" ("org_id");
CREATE INDEX "native_community_pin_awards_user_id" ON meldiq."community_pin_awards" ("user_id");
CREATE INDEX "native_community_pin_awards_awarded_at" ON meldiq."community_pin_awards" ("awarded_at");
ALTER TABLE meldiq."community_pin_awards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_pin_awards" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_pin_awards" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_pin_awards" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_pin_awards" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."community_rules" (
  "id" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" bigint NOT NULL,
  "channel_id" text,
  "required" boolean NOT NULL,
  "rules" jsonb NOT NULL,
  PRIMARY KEY(id)
);
CREATE INDEX "native_community_rules_updated_at" ON meldiq."community_rules" ("updated_at");
CREATE INDEX "native_community_rules_channel_id" ON meldiq."community_rules" ("channel_id");
ALTER TABLE meldiq."community_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_rules" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_rules" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_rules" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_rules" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."community_rule_agreements" (
  "id" text NOT NULL,
  "org_id" text NOT NULL,
  "user_id" text NOT NULL,
  "agreed_at" bigint NOT NULL,
  PRIMARY KEY(id)
);
CREATE INDEX "native_community_rule_agreements_org_id" ON meldiq."community_rule_agreements" ("org_id");
CREATE INDEX "native_community_rule_agreements_user_id" ON meldiq."community_rule_agreements" ("user_id");
CREATE INDEX "native_community_rule_agreements_agreed_at" ON meldiq."community_rule_agreements" ("agreed_at");
ALTER TABLE meldiq."community_rule_agreements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."community_rule_agreements" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."community_rule_agreements" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."community_rule_agreements" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."community_rule_agreements" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."user_activities" (
  "id" text NOT NULL,
  "updated_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "activity" jsonb NOT NULL,
  PRIMARY KEY(id)
);
CREATE INDEX "native_user_activities_updated_at" ON meldiq."user_activities" ("updated_at");
CREATE INDEX "native_user_activities_expires_at" ON meldiq."user_activities" ("expires_at");
ALTER TABLE meldiq."user_activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."user_activities" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."user_activities" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."user_activities" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."user_activities" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."username_holds" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "created_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY(id)
);
CREATE INDEX "native_username_holds_user_id" ON meldiq."username_holds" ("user_id");
CREATE INDEX "native_username_holds_created_at" ON meldiq."username_holds" ("created_at");
CREATE INDEX "native_username_holds_expires_at" ON meldiq."username_holds" ("expires_at");
ALTER TABLE meldiq."username_holds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."username_holds" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."username_holds" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."username_holds" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."username_holds" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."creator_verifications" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "platform" text NOT NULL,
  "channel_name" text NOT NULL,
  "link" text NOT NULL,
  "status" text NOT NULL,
  "proof_type" text NOT NULL,
  "proof_size" bigint NOT NULL,
  "created_at" bigint NOT NULL,
  "notes" text,
  "reason" text,
  "reviewed_by" text,
  "username_at_approval" text,
  "reviewed_at" bigint,
  PRIMARY KEY(id)
);
CREATE INDEX "native_creator_verifications_user_id" ON meldiq."creator_verifications" ("user_id");
CREATE INDEX "native_creator_verifications_created_at" ON meldiq."creator_verifications" ("created_at");
CREATE INDEX "native_creator_verifications_reviewed_at" ON meldiq."creator_verifications" ("reviewed_at");
ALTER TABLE meldiq."creator_verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."creator_verifications" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."creator_verifications" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."creator_verifications" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."creator_verifications" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."creator_program" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "status" text NOT NULL,
  "created_at" bigint NOT NULL,
  "reason" text,
  "reviewed_by" text,
  "reviewed_at" bigint,
  PRIMARY KEY(id)
);
CREATE INDEX "native_creator_program_user_id" ON meldiq."creator_program" ("user_id");
CREATE INDEX "native_creator_program_created_at" ON meldiq."creator_program" ("created_at");
CREATE INDEX "native_creator_program_reviewed_at" ON meldiq."creator_program" ("reviewed_at");
ALTER TABLE meldiq."creator_program" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."creator_program" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."creator_program" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."creator_program" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."creator_program" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."creator_posts" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "url" text NOT NULL,
  "platform" text NOT NULL,
  "created_at" bigint NOT NULL,
  "reward_note" text,
  "reviewed_by" text,
  "views" bigint,
  "reviewed_at" bigint,
  "counted" boolean NOT NULL,
  PRIMARY KEY(id)
);
CREATE INDEX "native_creator_posts_user_id" ON meldiq."creator_posts" ("user_id");
CREATE INDEX "native_creator_posts_created_at" ON meldiq."creator_posts" ("created_at");
CREATE INDEX "native_creator_posts_reviewed_at" ON meldiq."creator_posts" ("reviewed_at");
ALTER TABLE meldiq."creator_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."creator_posts" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."creator_posts" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."creator_posts" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."creator_posts" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."linked_accounts" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "provider" text NOT NULL,
  "external_id" text NOT NULL,
  "name" text NOT NULL,
  "url" text NOT NULL,
  "items_kind" text NOT NULL,
  "connected_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "checked_at" bigint NOT NULL,
  "tokens" text,
  "visible" boolean NOT NULL,
  "items" jsonb NOT NULL,
  PRIMARY KEY(id)
);
CREATE INDEX "native_linked_accounts_user_id" ON meldiq."linked_accounts" ("user_id");
CREATE INDEX "native_linked_accounts_external_id" ON meldiq."linked_accounts" ("external_id");
CREATE INDEX "native_linked_accounts_connected_at" ON meldiq."linked_accounts" ("connected_at");
CREATE INDEX "native_linked_accounts_updated_at" ON meldiq."linked_accounts" ("updated_at");
CREATE INDEX "native_linked_accounts_checked_at" ON meldiq."linked_accounts" ("checked_at");
ALTER TABLE meldiq."linked_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."linked_accounts" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."linked_accounts" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."linked_accounts" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."linked_accounts" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE TABLE meldiq."linked_account_starts" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "provider" text NOT NULL,
  "verifier" text NOT NULL,
  "expires_at" bigint NOT NULL,
  PRIMARY KEY(id)
);
CREATE INDEX "native_linked_account_starts_user_id" ON meldiq."linked_account_starts" ("user_id");
CREATE INDEX "native_linked_account_starts_expires_at" ON meldiq."linked_account_starts" ("expires_at");
ALTER TABLE meldiq."linked_account_starts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."linked_account_starts" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."linked_account_starts" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."linked_account_starts" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."linked_account_starts" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
ALTER TABLE meldiq."points_accounts" ADD CONSTRAINT "native_points_accounts_fk_0" FOREIGN KEY ("id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."points_ledger" ADD CONSTRAINT "native_points_ledger_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."points_days" ADD CONSTRAINT "native_points_days_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."points_invites" ADD CONSTRAINT "native_points_invites_fk_0" FOREIGN KEY ("inviter_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."points_invites" ADD CONSTRAINT "native_points_invites_fk_1" FOREIGN KEY ("joiner_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."points_invites" ADD CONSTRAINT "native_points_invites_fk_2" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."oauth_apps" ADD CONSTRAINT "native_oauth_apps_fk_0" FOREIGN KEY ("owner_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."oauth_codes" ADD CONSTRAINT "native_oauth_codes_fk_0" FOREIGN KEY ("app_id") REFERENCES meldiq."oauth_apps" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."oauth_codes" ADD CONSTRAINT "native_oauth_codes_fk_1" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."oauth_grants" ADD CONSTRAINT "native_oauth_grants_fk_0" FOREIGN KEY ("app_id") REFERENCES meldiq."oauth_apps" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."oauth_grants" ADD CONSTRAINT "native_oauth_grants_fk_1" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."oauth_tokens" ADD CONSTRAINT "native_oauth_tokens_fk_0" FOREIGN KEY ("app_id") REFERENCES meldiq."oauth_apps" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."oauth_tokens" ADD CONSTRAINT "native_oauth_tokens_fk_1" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."bots" ADD CONSTRAINT "native_bots_fk_0" FOREIGN KEY ("owner_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."bots" ADD CONSTRAINT "native_bots_fk_1" FOREIGN KEY ("id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."bot_interactions" ADD CONSTRAINT "native_bot_interactions_fk_0" FOREIGN KEY ("bot_id") REFERENCES meldiq."bots" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."bot_interactions" ADD CONSTRAINT "native_bot_interactions_fk_1" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."bot_interactions" ADD CONSTRAINT "native_bot_interactions_fk_2" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."bot_interactions" ADD CONSTRAINT "native_bot_interactions_fk_3" FOREIGN KEY ("conversation_id") REFERENCES meldiq."conversations" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."profile_decorations" ADD CONSTRAINT "native_profile_decorations_fk_0" FOREIGN KEY ("creator_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."decoration_favorites" ADD CONSTRAINT "native_decoration_favorites_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."decoration_favorites" ADD CONSTRAINT "native_decoration_favorites_fk_1" FOREIGN KEY ("decoration_id") REFERENCES meldiq."profile_decorations" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_pins" ADD CONSTRAINT "native_community_pins_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_pins" ADD CONSTRAINT "native_community_pins_fk_1" FOREIGN KEY ("created_by") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_pin_awards" ADD CONSTRAINT "native_community_pin_awards_fk_0" FOREIGN KEY ("pin_id") REFERENCES meldiq."community_pins" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_pin_awards" ADD CONSTRAINT "native_community_pin_awards_fk_1" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_pin_awards" ADD CONSTRAINT "native_community_pin_awards_fk_2" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_pin_awards" ADD CONSTRAINT "native_community_pin_awards_fk_3" FOREIGN KEY ("awarded_by") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_rules" ADD CONSTRAINT "native_community_rules_fk_0" FOREIGN KEY ("updated_by") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_rules" ADD CONSTRAINT "native_community_rules_fk_1" FOREIGN KEY ("id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_rule_agreements" ADD CONSTRAINT "native_community_rule_agreements_fk_0" FOREIGN KEY ("org_id") REFERENCES meldiq."orgs" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."community_rule_agreements" ADD CONSTRAINT "native_community_rule_agreements_fk_1" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."user_activities" ADD CONSTRAINT "native_user_activities_fk_0" FOREIGN KEY ("id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."username_holds" ADD CONSTRAINT "native_username_holds_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."creator_verifications" ADD CONSTRAINT "native_creator_verifications_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."creator_program" ADD CONSTRAINT "native_creator_program_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."creator_posts" ADD CONSTRAINT "native_creator_posts_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."linked_accounts" ADD CONSTRAINT "native_linked_accounts_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE meldiq."linked_account_starts" ADD CONSTRAINT "native_linked_account_starts_fk_0" FOREIGN KEY ("user_id") REFERENCES meldiq."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
CREATE UNIQUE INDEX "native_points_days_ownership" ON meldiq."points_days" ("user_id","day");
CREATE UNIQUE INDEX "native_points_invites_ownership" ON meldiq."points_invites" ("org_id","joiner_id");
CREATE UNIQUE INDEX "native_community_pin_awards_ownership" ON meldiq."community_pin_awards" ("pin_id","user_id");
CREATE UNIQUE INDEX "native_community_rule_agreements_ownership" ON meldiq."community_rule_agreements" ("org_id","user_id");
CREATE UNIQUE INDEX "native_decoration_favorites_ownership" ON meldiq."decoration_favorites" ("user_id","decoration_id");
CREATE UNIQUE INDEX "native_linked_accounts_ownership" ON meldiq."linked_accounts" ("user_id","provider");
CREATE UNIQUE INDEX "native_oauth_grants_ownership" ON meldiq."oauth_grants" ("app_id","user_id");
CREATE UNIQUE INDEX "native_bots_token_hash_unique" ON meldiq."bots" ("token_hash");
CREATE UNIQUE INDEX "native_oauth_tokens_access_hash_unique" ON meldiq."oauth_tokens" ("access_hash");
CREATE UNIQUE INDEX "native_oauth_tokens_refresh_hash_unique" ON meldiq."oauth_tokens" ("refresh_hash");
CREATE UNIQUE INDEX "native_oauth_tokens_previous_refresh_hash_unique" ON meldiq."oauth_tokens" ("previous_refresh_hash");
CREATE UNIQUE INDEX "native_creator_verifications_pending_user" ON meldiq."creator_verifications"(user_id) WHERE status='pending';
CREATE UNIQUE INDEX "native_creator_program_pending_user" ON meldiq."creator_program"(user_id) WHERE status='pending';
CREATE UNIQUE INDEX native_creator_post_url ON meldiq.creator_posts(user_id,url);
ALTER TABLE meldiq.points_accounts ADD CHECK(balance >= 0 AND earned_total >= 0 AND level >= 1 AND streak >= 0);
ALTER TABLE meldiq.points_invites ADD CHECK(state IN ('pending','credited','lapsed','capped'));
ALTER TABLE meldiq.profile_decorations ADD CHECK(status IN ('pending','approved','rejected','removed') AND size >= 0 AND wearers >= 0);
ALTER TABLE meldiq."creator_verifications" ADD CHECK(status IN ('pending','approved','rejected'));
ALTER TABLE meldiq."creator_program" ADD CHECK(status IN ('pending','approved','rejected'));
