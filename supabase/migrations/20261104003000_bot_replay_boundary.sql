-- Derived replay boundaries remain API-private; cached authorization rows are never changed behind their writer.
CREATE TABLE meldiq_private.bot_installation_boundaries (
  org_id text NOT NULL,
  bot_id text NOT NULL,
  install_key text NOT NULL,
  after_seq bigint NOT NULL,
  PRIMARY KEY(org_id,bot_id),
  FOREIGN KEY(org_id,bot_id) REFERENCES meldiq.bot_installation_permissions(org_id,bot_id) ON DELETE CASCADE
);
ALTER TABLE meldiq_private.bot_installation_boundaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq_private.bot_installation_boundaries FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq_private.bot_installation_boundaries FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON meldiq_private.bot_installation_boundaries TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq_private.bot_installation_boundaries FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
INSERT INTO meldiq_private.bot_installation_boundaries
  SELECT approved.org_id,approved.bot_id,approved.install_key,clock.last_seq FROM meldiq.bot_installation_permissions approved
  CROSS JOIN meldiq_private.bot_event_clock clock WHERE clock.singleton=1;
CREATE FUNCTION meldiq_private.bot_approval_boundary() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE position bigint;
BEGIN
  -- Share the journal clock's commit-order lock. Wall clocks on the API and DB must not decide consent ordering.
  SELECT last_seq INTO position FROM meldiq_private.bot_event_clock WHERE singleton=1 FOR UPDATE;
  IF position IS NULL THEN RAISE EXCEPTION 'Bot event clock is unavailable'; END IF;
  INSERT INTO meldiq_private.bot_installation_boundaries VALUES(NEW.org_id,NEW.bot_id,NEW.install_key,position)
    ON CONFLICT(org_id,bot_id) DO UPDATE SET install_key=EXCLUDED.install_key,after_seq=EXCLUDED.after_seq;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION meldiq_private.bot_approval_boundary() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION meldiq_private.bot_approval_boundary() TO meldiq_api;
CREATE TRIGGER bot_approval_boundary AFTER INSERT OR UPDATE ON meldiq.bot_installation_permissions
  FOR EACH ROW EXECUTE FUNCTION meldiq_private.bot_approval_boundary();
