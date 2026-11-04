CREATE TABLE meldiq.org_partner_applications (
  org_id text PRIMARY KEY REFERENCES meldiq.orgs(id) ON DELETE CASCADE,
  submitted_by text NOT NULL, statement text NOT NULL, checklist text NOT NULL,
  status text NOT NULL CHECK(status IN ('submitted','approved','declined')),
  rev bigint NOT NULL, submitted_at bigint NOT NULL,
  reviewed_at bigint, reviewed_by text, review_note text
);
CREATE INDEX partner_application_queue ON meldiq.org_partner_applications(status,submitted_at,org_id);
ALTER TABLE meldiq.org_partner_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq.org_partner_applications FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON meldiq.org_partner_applications TO meldiq_api;
CREATE POLICY api_partner_applications ON meldiq.org_partner_applications FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
