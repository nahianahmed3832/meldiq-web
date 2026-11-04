ALTER TABLE meldiq.bot_installation_permissions ADD COLUMN install_key text NOT NULL DEFAULT '';
UPDATE meldiq.bot_installation_permissions SET install_key=gen_random_uuid()::text;
ALTER TABLE meldiq.bot_derived_credentials ADD COLUMN install_key text NOT NULL DEFAULT '';
CREATE TABLE meldiq.bot_credential_revisions (
  bot_id text PRIMARY KEY,
  owner_id text NOT NULL,
  token_hash text NOT NULL,
  created_at bigint NOT NULL,
  active integer NOT NULL CHECK(active IN (0,1))
);
CREATE INDEX bot_credential_owner ON meldiq.bot_credential_revisions(owner_id,active,created_at,bot_id);
CREATE TABLE meldiq.bot_invite_credentials (
  invite_id text PRIMARY KEY REFERENCES meldiq.invitations(id) ON DELETE CASCADE,
  bot_id text NOT NULL,
  org_id text NOT NULL,
  bot_token_hash text NOT NULL,
  install_key text NOT NULL,
  created_at bigint NOT NULL
);
ALTER TABLE meldiq.bot_credential_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq.bot_credential_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE meldiq.bot_invite_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq.bot_invite_credentials FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq.bot_credential_revisions, meldiq.bot_invite_credentials FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON meldiq.bot_credential_revisions, meldiq.bot_invite_credentials TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq.bot_credential_revisions FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE POLICY trusted_backend ON meldiq.bot_invite_credentials FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
