-- Additive schema alignment with live API 708353fe (SQLite migrations092-094).
-- Existing application IDs, values, files and published agreements are retained.
ALTER TABLE meldiq.attachments ADD COLUMN pending_message_until bigint;
ALTER TABLE meldiq.attachments ADD COLUMN message_id text;
ALTER TABLE meldiq.attachments ADD COLUMN sha256 text;
CREATE INDEX attachments_pending_message ON meldiq.attachments(pending_message_until) WHERE pending_message_until IS NOT NULL;
CREATE INDEX attachments_message ON meldiq.attachments(conversation_id,message_id) WHERE message_id IS NOT NULL;

ALTER TABLE meldiq.billing_plan_versions ADD COLUMN billing_frequency bigint NOT NULL DEFAULT 1 CHECK(billing_frequency BETWEEN 1 AND 12);
CREATE OR REPLACE FUNCTION meldiq_private.freeze_published_price() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.published_at IS NOT NULL AND (
    NEW.interval IS DISTINCT FROM OLD.interval OR NEW.currency IS DISTINCT FROM OLD.currency OR
    NEW.amount_minor IS DISTINCT FROM OLD.amount_minor OR NEW.provider IS DISTINCT FROM OLD.provider OR
    NEW.provider_price_ref IS DISTINCT FROM OLD.provider_price_ref OR NEW.trial_days IS DISTINCT FROM OLD.trial_days OR
    NEW.grace_days IS DISTINCT FROM OLD.grace_days OR NEW.limits IS DISTINCT FROM OLD.limits OR
    NEW.plan_id IS DISTINCT FROM OLD.plan_id OR NEW.version IS DISTINCT FROM OLD.version OR
    NEW.quota_plan_id IS DISTINCT FROM OLD.quota_plan_id OR NEW.billing_frequency IS DISTINCT FROM OLD.billing_frequency
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='a published plan version is immutable';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION meldiq_private.freeze_published_price() FROM PUBLIC, anon, authenticated;

CREATE TABLE meldiq."billing_promotion_settings" (
  id bigint PRIMARY KEY CHECK(id=1), revision bigint NOT NULL, settings text NOT NULL,
  updated_by text NOT NULL, updated_at bigint NOT NULL
);
CREATE TABLE meldiq."billing_promotion_state" (
  account_id text PRIMARY KEY, user_id text NOT NULL, revision bigint NOT NULL DEFAULT 1,
  opt_out bigint NOT NULL DEFAULT 0, sessions text NOT NULL DEFAULT '[]', history text NOT NULL DEFAULT '[]',
  snoozed_until bigint NOT NULL DEFAULT 0, dismissed_at bigint, updated_at bigint NOT NULL
);
CREATE TABLE meldiq."billing_promotion_events" (
  id text PRIMARY KEY, account_id text NOT NULL, campaign_id text NOT NULL, impression_id text,
  session_id text NOT NULL, type text NOT NULL, presentation text NOT NULL, at bigint NOT NULL,
  variant text NOT NULL DEFAULT 'control'
);
CREATE INDEX promotion_events_at ON meldiq."billing_promotion_events"(at);
CREATE INDEX promotion_events_account ON meldiq."billing_promotion_events"(account_id,at);

ALTER TABLE meldiq."billing_promotion_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_promotion_settings" FORCE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_promotion_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_promotion_state" FORCE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_promotion_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."billing_promotion_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."billing_promotion_settings", meldiq."billing_promotion_state", meldiq."billing_promotion_events" FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON meldiq."billing_promotion_settings", meldiq."billing_promotion_state", meldiq."billing_promotion_events" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."billing_promotion_settings" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE POLICY trusted_backend ON meldiq."billing_promotion_state" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE POLICY trusted_backend ON meldiq."billing_promotion_events" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
