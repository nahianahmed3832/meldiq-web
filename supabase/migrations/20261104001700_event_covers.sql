ALTER TABLE meldiq.meetings ADD COLUMN IF NOT EXISTS cover_id text;
COMMENT ON COLUMN meldiq.meetings.cover_id IS 'Optional event image in the existing image blob store; only readable with current event/channel access.';
