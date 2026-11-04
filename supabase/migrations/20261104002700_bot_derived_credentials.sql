-- API-private denial binding survives bot deletion. A human manager may explicitly rotate/reclaim the webhook.
CREATE TABLE meldiq.bot_derived_credentials (
  credential_id text PRIMARY KEY REFERENCES meldiq.channel_webhooks(id) ON DELETE CASCADE,
  bot_id text NOT NULL,
  org_id text NOT NULL,
  bot_token_hash text NOT NULL,
  created_at bigint NOT NULL
);
ALTER TABLE meldiq.bot_derived_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq.bot_derived_credentials FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq.bot_derived_credentials FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq.bot_derived_credentials TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq.bot_derived_credentials FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
