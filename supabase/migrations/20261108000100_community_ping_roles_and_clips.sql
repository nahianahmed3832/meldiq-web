ALTER TABLE meldiq.community_settings
  ADD COLUMN voice_clips bigint NOT NULL DEFAULT 0 CHECK (voice_clips IN (0, 1));

CREATE TABLE meldiq.community_ping_roles (
  org_id text PRIMARY KEY REFERENCES meldiq.orgs(id) ON DELETE CASCADE,
  rev bigint NOT NULL CHECK (rev >= 0),
  roles text NOT NULL
);
CREATE TABLE meldiq.community_ping_subscriptions (
  org_id text NOT NULL REFERENCES meldiq.community_ping_roles(org_id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES meldiq.users(id) ON DELETE CASCADE,
  role_id text NOT NULL,
  PRIMARY KEY (org_id, user_id, role_id)
);
CREATE INDEX idx_ping_subscriptions_role ON meldiq.community_ping_subscriptions(org_id, role_id);

ALTER TABLE meldiq.community_ping_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq.community_ping_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq.community_ping_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE meldiq.community_ping_subscriptions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq.community_ping_roles, meldiq.community_ping_subscriptions FROM PUBLIC, anon, authenticated;
DO $roles$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON meldiq.community_ping_roles, meldiq.community_ping_subscriptions FROM service_role;
  END IF;
END $roles$;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq.community_ping_roles, meldiq.community_ping_subscriptions TO meldiq_api;
CREATE POLICY meldiq_api_rw ON meldiq.community_ping_roles FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
CREATE POLICY meldiq_api_rw ON meldiq.community_ping_subscriptions FOR ALL TO meldiq_api USING (true) WITH CHECK (true);
