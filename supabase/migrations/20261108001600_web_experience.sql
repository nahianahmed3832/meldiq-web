-- Match the additive backend migrations for installations using the Postgres rows adapter.
CREATE TABLE meldiq.spark_threads (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES meldiq.users(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  sealed text NOT NULL,
  updated_at bigint NOT NULL,
  request_id text,
  busy_until bigint NOT NULL DEFAULT 0
);
CREATE INDEX spark_threads_idx_owner ON meldiq.spark_threads (user_id, updated_at DESC, id);
ALTER TABLE meldiq.spark_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq.spark_threads FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq.spark_threads FROM PUBLIC, anon, authenticated;
DO $roles$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON meldiq.spark_threads FROM service_role;
  END IF;
END $roles$;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq.spark_threads TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq.spark_threads FOR ALL TO meldiq_api USING (true) WITH CHECK (true);

ALTER TABLE meldiq.bug_reports ADD COLUMN category text NOT NULL DEFAULT 'bug'
  CHECK (category IN ('bug', 'feature', 'general'));

-- The previous API sends an explicit NULL for unknown columns through apply_row_changes.
-- Preserve a category on rollback, and classify new reports from that API as bugs.
CREATE FUNCTION meldiq_private.preserve_bug_report_category() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $function$
BEGIN
  IF NEW.category IS NULL THEN
    SELECT category INTO NEW.category FROM meldiq.bug_reports WHERE id = NEW.id;
    NEW.category := coalesce(NEW.category, 'bug');
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION meldiq_private.preserve_bug_report_category() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION meldiq_private.preserve_bug_report_category() TO meldiq_api;
CREATE TRIGGER preserve_bug_report_category BEFORE INSERT ON meldiq.bug_reports
FOR EACH ROW EXECUTE FUNCTION meldiq_private.preserve_bug_report_category();
