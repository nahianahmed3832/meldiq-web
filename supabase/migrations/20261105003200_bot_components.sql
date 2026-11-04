-- Additive metadata on the existing short-lived, bot-owned interaction queue. Command rows remain unchanged.
ALTER TABLE meldiq.bot_interactions ADD COLUMN component jsonb;
ALTER TABLE meldiq.bot_interactions ALTER COLUMN org_id DROP NOT NULL;
ALTER TABLE meldiq.bot_interactions ADD CONSTRAINT bot_command_community CHECK(component IS NOT NULL OR org_id IS NOT NULL);
ALTER TABLE meldiq.bot_interactions ADD CONSTRAINT bot_component_budget
  CHECK(component IS NULL OR (jsonb_typeof(component)='object' AND pg_column_size(component)<=32768));
CREATE OR REPLACE FUNCTION meldiq_private.bot_command_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM meldiq_private.emit_bot_event(CASE WHEN NEW.component IS NULL THEN 'command' ELSE 'interaction' END,
    NULLIF(NEW.org_id,''),NEW.conversation_id,NEW.user_id,NEW.bot_id,NEW.id,NEW.bot_id,jsonb_build_object('interactionId',NEW.id));
  RETURN NEW;
END $$;
