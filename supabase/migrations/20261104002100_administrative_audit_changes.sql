ALTER TABLE meldiq.audit_log ADD COLUMN IF NOT EXISTS changes_json text;
COMMENT ON COLUMN meldiq.audit_log.changes_json IS 'Allowlisted administrative before/after values only; no message content, credentials or private report evidence.';
