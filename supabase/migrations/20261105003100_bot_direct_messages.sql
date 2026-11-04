-- Personal consent is independent of community approval. No existing person-to-person conversation changes.
CREATE TABLE meldiq.bot_dm_consents (
  bot_id text NOT NULL REFERENCES meldiq.users(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES meldiq.users(id) ON DELETE CASCADE,
  conversation_id text UNIQUE REFERENCES meldiq.conversations(id) ON DELETE CASCADE,
  enabled bigint NOT NULL CHECK(enabled IN (0,1)),
  manifest_rev bigint NOT NULL,
  notice_version text NOT NULL,
  rev bigint NOT NULL,
  approved_at bigint NOT NULL,
  PRIMARY KEY(bot_id,user_id)
);
ALTER TABLE meldiq.bot_dm_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq.bot_dm_consents FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq.bot_dm_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON meldiq.bot_dm_consents TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq.bot_dm_consents FOR ALL TO meldiq_api USING(true) WITH CHECK(true);

-- The commit-time guard closes revocation races during asynchronous attachment/message preparation.
CREATE FUNCTION meldiq_private.guard_bot_dm_message() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE consent meldiq.bot_dm_consents; requested meldiq.bot_requested_permissions;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM meldiq.conversations WHERE id=NEW.conversation_id AND type='DM' AND dm_key LIKE 'botdm|%') THEN RETURN NEW; END IF;
  SELECT * INTO consent FROM meldiq.bot_dm_consents WHERE conversation_id=NEW.conversation_id FOR SHARE;
  IF NOT FOUND OR consent.enabled<>1 THEN RAISE EXCEPTION 'Bot messaging consent is required' USING ERRCODE='PBDM1'; END IF;
  SELECT * INTO requested FROM meldiq.bot_requested_permissions WHERE bot_id=consent.bot_id FOR SHARE;
  IF NOT FOUND OR requested.rev<>consent.manifest_rev OR requested.permissions NOT LIKE '%"direct_messages"%'
    OR NEW.sender_user_id NOT IN (consent.bot_id,consent.user_id)
    OR EXISTS (SELECT 1 FROM meldiq.user_blocks WHERE (user_id=consent.bot_id AND blocked_user_id=consent.user_id) OR (user_id=consent.user_id AND blocked_user_id=consent.bot_id))
    OR NOT EXISTS (SELECT 1 FROM meldiq.users WHERE id=consent.user_id AND kind='person' AND disabled_at IS NULL)
    OR NOT EXISTS (SELECT 1 FROM meldiq.bot_credential_revisions WHERE bot_id=consent.bot_id AND active=1)
    OR NOT EXISTS (SELECT 1 FROM meldiq.conversation_members WHERE conversation_id=NEW.conversation_id AND user_id=consent.bot_id)
    OR NOT EXISTS (SELECT 1 FROM meldiq.conversation_members WHERE conversation_id=NEW.conversation_id AND user_id=consent.user_id)
  THEN RAISE EXCEPTION 'Bot messaging consent is required' USING ERRCODE='PBDM1'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_bot_dm_message BEFORE INSERT ON meldiq.message_events FOR EACH ROW EXECUTE FUNCTION meldiq_private.guard_bot_dm_message();

CREATE FUNCTION meldiq_private.bot_direct_message_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE recipient text;
BEGIN
  IF NEW.cls<>'message' OR NEW.audience<>'all' OR NEW.imported_by IS NOT NULL THEN RETURN NEW; END IF;
  SELECT bot_id INTO recipient FROM meldiq.bot_dm_consents WHERE conversation_id=NEW.conversation_id AND enabled=1;
  IF recipient IS NULL OR NEW.sender_user_id=recipient THEN RETURN NEW; END IF;
  PERFORM meldiq_private.emit_bot_event('dm_message',NULL,NEW.conversation_id,NEW.sender_user_id,recipient,NEW.id,recipient,jsonb_build_object('messageId',NEW.id));
  RETURN NEW;
END $$;
CREATE TRIGGER bot_direct_message_journal AFTER INSERT ON meldiq.message_events FOR EACH ROW EXECUTE FUNCTION meldiq_private.bot_direct_message_event();
REVOKE ALL ON FUNCTION meldiq_private.guard_bot_dm_message(), meldiq_private.bot_direct_message_event() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION meldiq_private.guard_bot_dm_message(), meldiq_private.bot_direct_message_event() TO meldiq_api;
