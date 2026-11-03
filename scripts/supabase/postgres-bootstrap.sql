-- TEST HARNESS ONLY. Minimal Auth/Realtime contracts for plain PostgreSQL integration tests.
-- This does not run Supabase Auth or a Realtime server and cannot certify their hosted behavior.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='meldiq_api') THEN CREATE ROLE meldiq_api NOLOGIN NOBYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, banned_until timestamptz, deleted_at timestamptz);
CREATE TABLE auth.sessions (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, not_after timestamptz);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.jwt(), auth.uid() TO authenticated;
CREATE SCHEMA realtime;
CREATE TABLE realtime.messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), extension text NOT NULL, payload jsonb, event text, topic text, private boolean DEFAULT false);
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA realtime TO authenticated, meldiq_api;
GRANT SELECT, INSERT ON realtime.messages TO authenticated;
CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('realtime.topic',true) $$;
CREATE TABLE realtime.test_sent (payload jsonb, event text, topic text, private boolean);
CREATE FUNCTION realtime.test_capture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.extension='broadcast' AND NEW.event IS NOT NULL THEN
    INSERT INTO realtime.test_sent VALUES(NEW.payload,NEW.event,NEW.topic,NEW.private);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER test_capture AFTER INSERT ON realtime.messages FOR EACH ROW EXECUTE FUNCTION realtime.test_capture();
CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
LANGUAGE sql AS $$ INSERT INTO realtime.test_sent VALUES (payload, event, topic, private) $$;
GRANT EXECUTE ON FUNCTION realtime.send(jsonb,text,text,boolean) TO meldiq_api;
GRANT INSERT ON realtime.test_sent TO meldiq_api;
