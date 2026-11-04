ALTER TABLE meldiq.meetings ADD COLUMN IF NOT EXISTS external_location text;
ALTER TABLE meldiq.meetings ADD COLUMN IF NOT EXISTS occurrence_base text;
ALTER TABLE meldiq.meetings ADD COLUMN IF NOT EXISTS occurrence_cancelled bigint NOT NULL DEFAULT 0 CHECK(occurrence_cancelled IN (0,1));
