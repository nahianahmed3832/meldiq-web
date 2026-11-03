-- A provider session authenticates a person; its certified device remains a separate application authorization gate.
-- A provider ban does not necessarily delete existing sessions or invalidate an unexpired JWT.
CREATE OR REPLACE FUNCTION meldiq_private.session_active(subject uuid, session uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM auth.sessions s JOIN auth.users u ON u.id=s.user_id
    WHERE s.id=session AND s.user_id=subject AND (s.not_after IS NULL OR s.not_after>now())
      AND (u.banned_until IS NULL OR u.banned_until<=now()) AND u.deleted_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM meldiq_private.revoked_auth_sessions r WHERE r.session_id=session)
$$;
-- Explicit account deletion may remove its private mapping after access is revoked; it must not be held by RESTRICT.
ALTER TABLE meldiq_private.auth_links DROP CONSTRAINT auth_links_account_id_fkey;
ALTER TABLE meldiq_private.auth_links ADD CONSTRAINT auth_links_account_id_fkey FOREIGN KEY(account_id) REFERENCES meldiq.accounts(id) ON DELETE CASCADE;
ALTER TABLE meldiq_private.auth_links DROP CONSTRAINT auth_links_user_id_fkey;
ALTER TABLE meldiq_private.auth_links ADD CONSTRAINT auth_links_user_id_fkey FOREIGN KEY(user_id) REFERENCES meldiq.users(id) ON DELETE CASCADE;
CREATE TABLE meldiq."auth_device_sessions" (
  id text PRIMARY KEY CHECK (id ~ '^[0-9a-fA-F-]{36}$'),
  auth_user_id text NOT NULL CHECK (auth_user_id ~ '^[0-9a-fA-F-]{36}$'),
  account_id text NOT NULL REFERENCES meldiq.accounts(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  user_id text NOT NULL REFERENCES meldiq.users(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  device_id text NOT NULL REFERENCES meldiq.devices(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  link_method text NOT NULL CHECK (link_method IN ('legacy_reauthentication','existing_mapping')),
  password_changed_at bigint NOT NULL,
  bound_at bigint NOT NULL,
  revoked_at bigint
);
CREATE INDEX auth_device_sessions_account ON meldiq.auth_device_sessions(account_id);
CREATE INDEX auth_device_sessions_device ON meldiq.auth_device_sessions(device_id);
ALTER TABLE meldiq."auth_device_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq."auth_device_sessions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq.auth_device_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON meldiq.auth_device_sessions TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq.auth_device_sessions FOR ALL TO meldiq_api USING(true) WITH CHECK(true);

CREATE FUNCTION meldiq_private.validate_device_session() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP='UPDATE' AND (NEW.id,NEW.auth_user_id,NEW.account_id,NEW.user_id,NEW.device_id,NEW.link_method,NEW.password_changed_at,NEW.bound_at)
    IS DISTINCT FROM (OLD.id,OLD.auth_user_id,OLD.account_id,OLD.user_id,OLD.device_id,OLD.link_method,OLD.password_changed_at,OLD.bound_at) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Auth device binding is immutable';
  END IF;
  IF TG_OP='UPDATE' AND OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Revoked Auth session cannot be rebound';
  END IF;
  IF NEW.revoked_at IS NULL THEN
    IF NOT meldiq_private.session_active(NEW.auth_user_id::uuid,NEW.id::uuid) OR NOT EXISTS (
      SELECT 1 FROM meldiq.accounts a JOIN meldiq.users u ON u.id=a.user_id JOIN meldiq.devices d ON d.user_id=u.id
      WHERE a.id=NEW.account_id AND u.id=NEW.user_id AND d.id=NEW.device_id AND d.revoked_at IS NULL
        AND a.disabled_at IS NULL AND u.disabled_at IS NULL AND u.deleted_at IS NULL AND a.password_changed_at=NEW.password_changed_at
    ) THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Invalid Auth device owner or session'; END IF;
    IF NEW.link_method='legacy_reauthentication' THEN
      -- Only the trusted backend can reach this operation, after its fresh legacy factor and device proof checks.
      -- Mapping and binding commit in the same writer transaction. Email/metadata never selects the owner.
      INSERT INTO meldiq_private.auth_links(auth_user_id,account_id,user_id,verified_at,method)
      VALUES(NEW.auth_user_id::uuid,NEW.account_id,NEW.user_id,now(),'legacy_reauthentication') ON CONFLICT(auth_user_id) DO NOTHING;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM meldiq_private.auth_links l WHERE l.auth_user_id=NEW.auth_user_id::uuid AND l.account_id=NEW.account_id AND l.user_id=NEW.user_id) THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Auth mapping belongs to another owner';
    END IF;
  ELSE
    INSERT INTO meldiq_private.revoked_auth_sessions(session_id,auth_user_id)
    VALUES(NEW.id::uuid,NEW.auth_user_id::uuid) ON CONFLICT(session_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION meldiq_private.validate_device_session() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER auth_device_session_owner BEFORE INSERT OR UPDATE ON meldiq.auth_device_sessions
FOR EACH ROW EXECUTE FUNCTION meldiq_private.validate_device_session();

CREATE OR REPLACE FUNCTION meldiq_private.active_user_id() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT l.user_id FROM meldiq_private.auth_links l
  JOIN meldiq.accounts a ON a.id=l.account_id AND a.user_id=l.user_id
  JOIN meldiq.users u ON u.id=l.user_id
  JOIN meldiq.auth_device_sessions b ON b.auth_user_id=l.auth_user_id::text AND b.account_id=a.id AND b.user_id=u.id
  JOIN meldiq.devices d ON d.id=b.device_id AND d.user_id=u.id
  WHERE l.auth_user_id=(SELECT auth.uid()) AND b.id=(SELECT auth.jwt()->>'session_id')
    AND b.revoked_at IS NULL AND d.revoked_at IS NULL AND b.password_changed_at=a.password_changed_at
    AND a.disabled_at IS NULL AND u.disabled_at IS NULL AND u.deleted_at IS NULL
    AND meldiq_private.session_active(l.auth_user_id,b.id::uuid)
$$;
