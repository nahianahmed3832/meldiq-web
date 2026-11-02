-- Legacy message payloads remain byte-for-byte intact. A malformed old payload must not crash an entire search.
CREATE FUNCTION meldiq_private.event_payload(value text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = '' AS $$
BEGIN
  RETURN value::jsonb;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END $$;
CREATE FUNCTION meldiq_private.read_position(value text) RETURNS bigint
LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT CASE WHEN (meldiq_private.event_payload(value)->>'upTo') ~ '^[0-9]{1,15}$'
    THEN (meldiq_private.event_payload(value)->>'upTo')::bigint ELSE NULL END
$$;
REVOKE ALL ON FUNCTION meldiq_private.event_payload(text), meldiq_private.read_position(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION meldiq_private.event_payload(text), meldiq_private.read_position(text) TO meldiq_api;

CREATE OR REPLACE FUNCTION meldiq_private.can_join_topic(topic text, extension text, sending boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT extension IN ('broadcast','presence') AND (SELECT meldiq_private.active_user_id()) IS NOT NULL AND (
    (NOT sending AND extension = 'broadcast' AND topic = 'user:' || (SELECT meldiq_private.active_user_id()))
    OR EXISTS (SELECT 1 FROM meldiq_private.realtime_grants g
      WHERE g.auth_user_id = (SELECT auth.uid()) AND g.topic = can_join_topic.topic AND g.expires_at > now()
      AND (NOT sending OR (extension = 'presence' AND g.presence)
        OR (extension = 'broadcast' AND g.ephemeral_broadcast AND g.topic LIKE 'ephemeral:%')))
  )
$$;
