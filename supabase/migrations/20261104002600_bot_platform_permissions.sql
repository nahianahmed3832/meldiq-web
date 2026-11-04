-- Additive opt-in bot installation grants. Never turns a bot token into a person/device session.
CREATE TABLE meldiq.bot_requested_permissions (
  bot_id text PRIMARY KEY REFERENCES meldiq.users(id) ON DELETE CASCADE,
  permissions text NOT NULL DEFAULT '[]',
  rev bigint NOT NULL DEFAULT 1,
  updated_at bigint NOT NULL
);
CREATE TABLE meldiq.bot_installation_permissions (
  org_id text NOT NULL,
  bot_id text NOT NULL,
  permissions text NOT NULL DEFAULT '[]',
  manifest_rev bigint NOT NULL,
  rev bigint NOT NULL,
  approved_by text NOT NULL,
  approved_at bigint NOT NULL,
  PRIMARY KEY (org_id,bot_id),
  FOREIGN KEY (org_id,bot_id) REFERENCES meldiq.org_members(org_id,user_id) ON DELETE CASCADE
);
ALTER TABLE meldiq.bot_requested_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq.bot_requested_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE meldiq.bot_installation_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq.bot_installation_permissions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq.bot_requested_permissions, meldiq.bot_installation_permissions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq.bot_requested_permissions, meldiq.bot_installation_permissions TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq.bot_requested_permissions FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE POLICY trusted_backend ON meldiq.bot_installation_permissions FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
