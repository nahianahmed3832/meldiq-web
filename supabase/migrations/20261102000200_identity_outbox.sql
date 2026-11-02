-- Private operational records, never a second copy of application entities.
CREATE TABLE meldiq_private.auth_links (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  account_id text NOT NULL UNIQUE REFERENCES meldiq.accounts(id) ON DELETE RESTRICT,
  user_id text NOT NULL UNIQUE REFERENCES meldiq.users(id) ON DELETE RESTRICT,
  verified_at timestamptz NOT NULL,
  method text NOT NULL CHECK (method IN ('legacy_reauthentication','verified_provider','verified_recovery')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION meldiq_private.check_identity_owner() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM meldiq.accounts a WHERE a.id = NEW.account_id AND a.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Identity ownership mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER identity_owner BEFORE INSERT OR UPDATE ON meldiq_private.auth_links
FOR EACH ROW EXECUTE FUNCTION meldiq_private.check_identity_owner();

CREATE TABLE meldiq_private.revoked_auth_sessions (
  session_id uuid PRIMARY KEY,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  revoked_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE meldiq_private.row_counters (
  table_name text PRIMARY KEY,
  value bigint NOT NULL CHECK (value >= 0)
);
CREATE TABLE meldiq_private.migration_runs (
  id uuid PRIMARY KEY,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  catalog_sha256 text NOT NULL CHECK (catalog_sha256 ~ '^[0-9a-f]{64}$'),
  environment text NOT NULL CHECK (environment IN ('development','staging')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE meldiq_private.migration_batches (
  run_id uuid NOT NULL REFERENCES meldiq_private.migration_runs(id),
  table_name text NOT NULL,
  batch_number bigint NOT NULL CHECK (batch_number >= 0),
  record_count bigint NOT NULL CHECK (record_count >= 0),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, table_name, batch_number)
);
CREATE TABLE meldiq_private.outbox (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id uuid NOT NULL,
  aggregate_id text NOT NULL,
  destination text NOT NULL CHECK (destination IN ('realtime','push')),
  topic text NOT NULL,
  event_type text NOT NULL,
  -- Invalidation IDs only. Message content is fetched through the authorized API.
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 8192),
  created_at timestamptz NOT NULL DEFAULT now(),
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  lease_id uuid,
  lease_until timestamptz,
  delivered_at timestamptz,
  dead_at timestamptz,
  last_error_code text,
  UNIQUE (event_id, destination, topic)
);
CREATE INDEX outbox_pending ON meldiq_private.outbox (available_at, sequence) WHERE delivered_at IS NULL AND dead_at IS NULL;
CREATE INDEX outbox_ordering ON meldiq_private.outbox (aggregate_id, destination, sequence) WHERE delivered_at IS NULL;

-- Short-lived authorization leases issued by Fastify after its full existing Authz checks.
-- This is an authorization cache, not an authoritative membership copy.
CREATE TABLE meldiq_private.realtime_grants (
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic text NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at <= now() + interval '5 minutes'),
  presence boolean NOT NULL DEFAULT false,
  ephemeral_broadcast boolean NOT NULL DEFAULT false,
  PRIMARY KEY(auth_user_id, topic)
);
CREATE INDEX realtime_grants_expiry ON meldiq_private.realtime_grants(expires_at);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['auth_links','revoked_auth_sessions','row_counters','migration_runs','migration_batches','outbox','realtime_grants'] LOOP
    EXECUTE format('ALTER TABLE meldiq_private.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE meldiq_private.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON meldiq_private.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq_private.%I TO meldiq_api', t);
    EXECUTE format('CREATE POLICY trusted_backend ON meldiq_private.%I FOR ALL TO meldiq_api USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA meldiq_private TO meldiq_api;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA meldiq_private FROM PUBLIC, anon, authenticated;

-- Only fixed-return authorization helpers are callable by authenticated clients.
-- A metadata role, email match, community role or client supplied account ID cannot create this mapping.
CREATE FUNCTION meldiq_private.active_user_id() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT l.user_id FROM meldiq_private.auth_links l
  JOIN meldiq.accounts a ON a.id = l.account_id AND a.user_id = l.user_id
  JOIN meldiq.users u ON u.id = l.user_id
  WHERE l.auth_user_id = (SELECT auth.uid())
    AND a.disabled_at IS NULL AND u.disabled_at IS NULL AND u.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM meldiq_private.revoked_auth_sessions s
      WHERE s.session_id::text = (SELECT auth.jwt()->>'session_id'))
$$;
CREATE FUNCTION meldiq_private.can_join_topic(topic text, extension text, sending boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (SELECT meldiq_private.active_user_id()) IS NOT NULL AND (
    (NOT sending AND extension = 'broadcast' AND topic = 'user:' || (SELECT meldiq_private.active_user_id()))
    OR EXISTS (SELECT 1 FROM meldiq_private.realtime_grants g
      WHERE g.auth_user_id = (SELECT auth.uid()) AND g.topic = can_join_topic.topic AND g.expires_at > now()
      AND (NOT sending OR (extension = 'presence' AND g.presence)
        OR (extension = 'broadcast' AND g.ephemeral_broadcast AND g.topic LIKE 'ephemeral:%')))
  )
$$;
REVOKE ALL ON FUNCTION meldiq_private.active_user_id(), meldiq_private.can_join_topic(text,text,boolean) FROM PUBLIC;
GRANT USAGE ON SCHEMA meldiq_private TO authenticated;
GRANT EXECUTE ON FUNCTION meldiq_private.active_user_id(), meldiq_private.can_join_topic(text,text,boolean) TO authenticated;

GRANT USAGE ON SCHEMA realtime TO meldiq_api;
GRANT EXECUTE ON FUNCTION realtime.send(jsonb,text,text,boolean) TO meldiq_api;

-- Supabase owns realtime.messages and already enables RLS. Never ALTER that managed table.
CREATE POLICY meldiq_private_receive ON realtime.messages FOR SELECT TO authenticated
USING (meldiq_private.can_join_topic((SELECT realtime.topic()), extension, false));
CREATE POLICY meldiq_ephemeral_send ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (meldiq_private.can_join_topic((SELECT realtime.topic()), extension, true));
