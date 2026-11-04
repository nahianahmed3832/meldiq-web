ALTER TABLE meldiq.reports ADD COLUMN IF NOT EXISTS target_org_id text;
CREATE INDEX IF NOT EXISTS reports_target_community ON meldiq.reports(target_org_id);
COMMENT ON COLUMN meldiq.reports.target_org_id IS 'Whole-community report, always operator-only (org_id NULL). For these rows legacy target_user_id anchors the reporter FK and is never presented as an accused person.';
