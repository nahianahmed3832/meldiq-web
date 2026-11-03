-- Source audit found this lazy-created Mongo collection even though it had no live documents yet.
-- Preserving privacy behavior requires modeling the store, not only collections already created in Atlas.
CREATE TABLE meldiq."privacy_settings" (
  id text PRIMARY KEY,
  group_add_policy text NOT NULL CHECK (group_add_policy IN ('everyone','friends','nobody')),
  suggestable boolean NOT NULL,
  updated_at bigint NOT NULL,
  FOREIGN KEY (id) REFERENCES meldiq.users(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX native_privacy_settings_updated_at ON meldiq.privacy_settings(updated_at);
ALTER TABLE meldiq."privacy_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."privacy_settings" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq."privacy_settings" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq."privacy_settings" TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq."privacy_settings" FOR ALL TO meldiq_api USING(true) WITH CHECK(true);

-- Favorites include built-in catalog IDs and persist after a community decoration is taken down.
-- A FK to only uploaded decorations rejected built-ins and incorrectly cascaded favorites away.
-- Ownership remains enforced by the existing user FK; client CRUD remains denied.
ALTER TABLE meldiq.decoration_favorites DROP CONSTRAINT native_decoration_favorites_fk_1;
