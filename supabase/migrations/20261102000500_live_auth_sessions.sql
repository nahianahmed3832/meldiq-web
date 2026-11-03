-- Supabase logout can leave a signed JWT unexpired. Check the live session row as well.
CREATE FUNCTION meldiq_private.session_active(subject uuid, session uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id = session AND s.user_id = subject
    AND (s.not_after IS NULL OR s.not_after > now()))
    AND NOT EXISTS(SELECT 1 FROM meldiq_private.revoked_auth_sessions r WHERE r.session_id = session)
$$;
REVOKE ALL ON FUNCTION meldiq_private.session_active(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION meldiq_private.session_active(uuid,uuid) TO meldiq_api;

CREATE OR REPLACE FUNCTION meldiq_private.active_user_id() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT l.user_id FROM meldiq_private.auth_links l
  JOIN meldiq.accounts a ON a.id = l.account_id AND a.user_id = l.user_id
  JOIN meldiq.users u ON u.id = l.user_id
  WHERE l.auth_user_id = (SELECT auth.uid())
    AND a.disabled_at IS NULL AND u.disabled_at IS NULL AND u.deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id::text = (SELECT auth.jwt()->>'session_id')
      AND s.user_id = l.auth_user_id AND (s.not_after IS NULL OR s.not_after > now()))
    AND NOT EXISTS (SELECT 1 FROM meldiq_private.revoked_auth_sessions s
      WHERE s.session_id::text = (SELECT auth.jwt()->>'session_id'))
$$;
