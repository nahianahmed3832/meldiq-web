-- Team grants retain the existing private DM schema. Their negative manifest revision
-- is rejected by older API releases, so a rollback cannot treat them as personal consent.
CREATE OR REPLACE FUNCTION meldiq_private.guard_bot_dm_message() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  consent meldiq.bot_dm_consents;
  requested meldiq.bot_requested_permissions;
  team_org text;
  team_owner text;
  expected_rev bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM meldiq.conversations WHERE id=NEW.conversation_id AND type='DM' AND dm_key LIKE 'botdm|%') THEN RETURN NEW; END IF;
  SELECT * INTO consent FROM meldiq.bot_dm_consents WHERE conversation_id=NEW.conversation_id FOR SHARE;
  IF NOT FOUND OR consent.enabled<>1 THEN RAISE EXCEPTION 'Bot messaging consent is required' USING ERRCODE='PBDM1'; END IF;
  SELECT * INTO requested FROM meldiq.bot_requested_permissions WHERE bot_id=consent.bot_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bot messaging consent is required' USING ERRCODE='PBDM1'; END IF;
  expected_rev := requested.rev;
  IF consent.notice_version ~ '^bot-team-dm-v1:o_[A-Za-z0-9_-]{22}:u_[A-Za-z0-9_-]{22}$' THEN
    expected_rev := -requested.rev-1;
    team_org := split_part(consent.notice_version, ':', 2);
    team_owner := split_part(consent.notice_version, ':', 3);
    IF NOT EXISTS (SELECT 1 FROM meldiq.orgs WHERE id=team_org
        AND (platform_suspended_at IS NULL OR platform_suspended_until <= extract(epoch FROM now())*1000) FOR SHARE)
      OR NOT EXISTS (SELECT 1 FROM meldiq.org_members WHERE org_id=team_org AND user_id=team_owner AND role='OWNER' FOR SHARE)
      OR NOT EXISTS (SELECT 1 FROM meldiq.org_members WHERE org_id=team_org AND user_id=consent.bot_id AND role<>'GUEST' FOR SHARE)
      OR NOT EXISTS (SELECT 1 FROM meldiq.org_members WHERE org_id=team_org AND user_id=consent.user_id AND role<>'GUEST' FOR SHARE)
      OR NOT EXISTS (SELECT 1 FROM meldiq.users WHERE id=team_owner AND kind='person' AND disabled_at IS NULL FOR SHARE)
      OR NOT EXISTS (SELECT 1 FROM meldiq.bot_credential_revisions WHERE bot_id=consent.bot_id AND owner_id=team_owner AND active=1 FOR SHARE)
    THEN RAISE EXCEPTION 'Bot messaging consent is required' USING ERRCODE='PBDM1'; END IF;
  END IF;
  IF consent.manifest_rev<>expected_rev OR requested.permissions NOT LIKE '%"direct_messages"%'
    OR NEW.sender_user_id NOT IN (consent.bot_id,consent.user_id)
    OR EXISTS (SELECT 1 FROM meldiq.user_blocks WHERE (user_id=consent.bot_id AND blocked_user_id=consent.user_id) OR (user_id=consent.user_id AND blocked_user_id=consent.bot_id))
    OR NOT EXISTS (SELECT 1 FROM meldiq.users WHERE id=consent.user_id AND kind='person' AND disabled_at IS NULL)
    OR NOT EXISTS (SELECT 1 FROM meldiq.bot_credential_revisions WHERE bot_id=consent.bot_id AND active=1)
    OR NOT EXISTS (SELECT 1 FROM meldiq.conversation_members WHERE conversation_id=NEW.conversation_id AND user_id=consent.bot_id)
    OR NOT EXISTS (SELECT 1 FROM meldiq.conversation_members WHERE conversation_id=NEW.conversation_id AND user_id=consent.user_id)
  THEN RAISE EXCEPTION 'Bot messaging consent is required' USING ERRCODE='PBDM1'; END IF;
  RETURN NEW;
END $$;
