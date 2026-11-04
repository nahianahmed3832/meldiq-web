-- API-private, commit-ordered bot replay metadata. No message bodies, media keys or report evidence.
CREATE TABLE meldiq_private.bot_event_clock (
  singleton integer PRIMARY KEY CHECK(singleton=1),
  last_seq bigint NOT NULL CHECK(last_seq>=0)
);
INSERT INTO meldiq_private.bot_event_clock VALUES(1,0);
CREATE TABLE meldiq_private.bot_event_journal (
  seq bigint PRIMARY KEY,
  id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  org_id text,
  conversation_id text,
  actor_id text,
  target_id text,
  source_id text,
  target_bot_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL,
  CHECK(jsonb_typeof(metadata)='object' AND pg_column_size(metadata)<=8192)
);
CREATE INDEX bot_journal_org_cursor ON meldiq_private.bot_event_journal(org_id,seq);
CREATE INDEX bot_journal_target_cursor ON meldiq_private.bot_event_journal(target_bot_id,seq);
CREATE INDEX bot_journal_expiry ON meldiq_private.bot_event_journal(expires_at);
ALTER TABLE meldiq_private.bot_event_clock ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq_private.bot_event_clock FORCE ROW LEVEL SECURITY;
ALTER TABLE meldiq_private.bot_event_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq_private.bot_event_journal FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq_private.bot_event_clock, meldiq_private.bot_event_journal FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA meldiq_private TO meldiq_api;
GRANT SELECT, UPDATE ON meldiq_private.bot_event_clock TO meldiq_api;
GRANT SELECT, INSERT, DELETE ON meldiq_private.bot_event_journal TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq_private.bot_event_clock FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE POLICY trusted_backend ON meldiq_private.bot_event_journal FOR ALL TO meldiq_api USING(true) WITH CHECK(true);

CREATE FUNCTION meldiq_private.emit_bot_event(
  event_kind text, community text, conversation text, actor text, target text, source text,
  recipient_bot text DEFAULT NULL, detail jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE position bigint; stamp bigint;
BEGIN
  -- Valid API manifests contain an array of known strings. Quoted matching also fails closed on malformed data.
  IF recipient_bot IS NULL AND NOT EXISTS (
    SELECT 1 FROM meldiq.bot_installation_permissions approved
    JOIN meldiq.bot_requested_permissions requested ON requested.bot_id=approved.bot_id
    JOIN meldiq.org_members member ON member.org_id=approved.org_id AND member.user_id=approved.bot_id
    WHERE approved.org_id=community AND approved.permissions LIKE '%"events.read"%'
      AND requested.permissions LIKE '%"events.read"%'
  ) THEN RETURN; END IF;
  -- The transactional row lock is held through commit. BIGSERIAL alone could skip a late-committing transaction.
  UPDATE meldiq_private.bot_event_clock SET last_seq=last_seq+1 WHERE singleton=1 RETURNING last_seq INTO position;
  IF position IS NULL THEN RAISE EXCEPTION 'Bot event clock is unavailable'; END IF;
  stamp := floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
  INSERT INTO meldiq_private.bot_event_journal
    (seq,kind,org_id,conversation_id,actor_id,target_id,source_id,target_bot_id,metadata,created_at,expires_at)
    VALUES(position,event_kind,community,conversation,actor,target,source,recipient_bot,detail,stamp,stamp+604800000);
END $$;
REVOKE ALL ON FUNCTION meldiq_private.emit_bot_event(text,text,text,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION meldiq_private.emit_bot_event(text,text,text,text,text,text,text,jsonb) TO meldiq_api;

CREATE FUNCTION meldiq_private.bot_message_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE community text; detail jsonb; event_kind text;
BEGIN
  IF NEW.audience<>'all' OR NEW.imported_by IS NOT NULL THEN RETURN NEW; END IF;
  SELECT org_id INTO community FROM meldiq.conversations WHERE id=NEW.conversation_id AND type='CHANNEL';
  IF community IS NULL THEN RETURN NEW; END IF;
  IF NEW.cls='message' THEN
    event_kind := 'message'; detail := jsonb_build_object('messageId',NEW.id);
  ELSIF NEW.type='reaction' THEN
    detail := NEW.payload::jsonb;
    event_kind := CASE WHEN detail->>'add'='false' THEN 'reaction_remove' ELSE 'reaction_add' END;
    detail := jsonb_strip_nulls(jsonb_build_object('messageId',NEW.target,'emoji',detail->>'emoji','reaction',detail->>'reaction'));
  ELSE RETURN NEW; END IF;
  PERFORM meldiq_private.emit_bot_event(event_kind,community,NEW.conversation_id,NEW.sender_user_id,NEW.target,NEW.id,NULL,detail);
  RETURN NEW;
END $$;
CREATE TRIGGER bot_message_journal AFTER INSERT ON meldiq.message_events FOR EACH ROW EXECUTE FUNCTION meldiq_private.bot_message_event();

CREATE FUNCTION meldiq_private.bot_member_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM meldiq_private.emit_bot_event('member_join',NEW.org_id,NULL,NEW.user_id,NEW.user_id,NEW.user_id);
    RETURN NEW;
  END IF;
  PERFORM meldiq_private.emit_bot_event('member_leave',OLD.org_id,NULL,OLD.user_id,OLD.user_id,OLD.user_id);
  RETURN OLD;
END $$;
CREATE TRIGGER bot_member_journal AFTER INSERT OR DELETE ON meldiq.org_members FOR EACH ROW EXECUTE FUNCTION meldiq_private.bot_member_event();

CREATE FUNCTION meldiq_private.bot_invite_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item jsonb;
BEGIN
  IF TG_OP='UPDATE' AND (OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL) THEN RETURN NEW; END IF;
  item := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  -- Invitation secrets/codes, destinations and private application evidence are deliberately excluded.
  PERFORM meldiq_private.emit_bot_event(CASE WHEN TG_OP='INSERT' THEN 'invite_create' ELSE 'invite_delete' END,
    item->>'org_id',NULL,item->>'created_by',NULL,item->>'id');
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bot_invite_journal AFTER INSERT OR UPDATE OR DELETE ON meldiq.invitations FOR EACH ROW EXECUTE FUNCTION meldiq_private.bot_invite_event();

CREATE FUNCTION meldiq_private.bot_voice_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE conversation text; community text;
BEGIN
  SELECT call.conversation_id,channel.org_id INTO conversation,community FROM meldiq.calls call
    JOIN meldiq.conversations channel ON channel.id=call.conversation_id
    WHERE call.id=NEW.call_id AND channel.type='CHANNEL';
  IF community IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' OR NEW.joined_at IS DISTINCT FROM OLD.joined_at OR (OLD.left_at IS NOT NULL AND NEW.left_at IS NULL) THEN
    PERFORM meldiq_private.emit_bot_event('voice_join',community,conversation,NEW.user_id,NEW.user_id,NEW.call_id,NULL,jsonb_build_object('callId',NEW.call_id));
  END IF;
  IF TG_OP='UPDATE' AND OLD.left_at IS NULL AND NEW.left_at IS NOT NULL THEN
    PERFORM meldiq_private.emit_bot_event('voice_leave',community,conversation,NEW.user_id,NEW.user_id,NEW.call_id,NULL,jsonb_build_object('callId',NEW.call_id));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bot_voice_journal AFTER INSERT OR UPDATE ON meldiq.call_participants FOR EACH ROW EXECUTE FUNCTION meldiq_private.bot_voice_event();

CREATE FUNCTION meldiq_private.bot_command_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- The payload is looked up from the currently authorized interaction at delivery; no private arguments are copied.
  PERFORM meldiq_private.emit_bot_event('command',NEW.org_id,NEW.conversation_id,NEW.user_id,NEW.bot_id,NEW.id,NEW.bot_id,jsonb_build_object('interactionId',NEW.id));
  RETURN NEW;
END $$;
CREATE TRIGGER bot_command_journal AFTER INSERT ON meldiq.bot_interactions FOR EACH ROW EXECUTE FUNCTION meldiq_private.bot_command_event();

REVOKE ALL ON FUNCTION meldiq_private.bot_message_event(), meldiq_private.bot_member_event(), meldiq_private.bot_invite_event(), meldiq_private.bot_voice_event(), meldiq_private.bot_command_event() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION meldiq_private.bot_message_event(), meldiq_private.bot_member_event(), meldiq_private.bot_invite_event(), meldiq_private.bot_voice_event(), meldiq_private.bot_command_event() TO meldiq_api;
