-- Additive; preserve the closed/open state and access of all existing tickets.
ALTER TABLE meldiq.tickets ADD COLUMN claimed_by text;
ALTER TABLE meldiq.tickets ADD COLUMN revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0);
