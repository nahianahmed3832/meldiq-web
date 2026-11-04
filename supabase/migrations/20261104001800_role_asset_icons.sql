ALTER TABLE meldiq.org_role_extras ADD COLUMN IF NOT EXISTS icon_expression_id text REFERENCES meldiq.community_expressions(id) ON DELETE SET NULL;
