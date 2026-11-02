-- Preserve all three triggers in the inspected release's SQLite schema.
CREATE FUNCTION meldiq_private.reject_audit_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='platform_audit is append-only';
END $$;
REVOKE ALL ON FUNCTION meldiq_private.reject_audit_mutation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER platform_audit_no_update BEFORE UPDATE ON meldiq.platform_audit
FOR EACH ROW EXECUTE FUNCTION meldiq_private.reject_audit_mutation();
CREATE TRIGGER platform_audit_no_delete BEFORE DELETE ON meldiq.platform_audit
FOR EACH ROW EXECUTE FUNCTION meldiq_private.reject_audit_mutation();

CREATE FUNCTION meldiq_private.freeze_published_price() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.published_at IS NOT NULL AND (
    NEW.interval IS DISTINCT FROM OLD.interval OR NEW.currency IS DISTINCT FROM OLD.currency OR
    NEW.amount_minor IS DISTINCT FROM OLD.amount_minor OR NEW.provider IS DISTINCT FROM OLD.provider OR
    NEW.provider_price_ref IS DISTINCT FROM OLD.provider_price_ref OR NEW.trial_days IS DISTINCT FROM OLD.trial_days OR
    NEW.grace_days IS DISTINCT FROM OLD.grace_days OR NEW.limits IS DISTINCT FROM OLD.limits OR
    NEW.plan_id IS DISTINCT FROM OLD.plan_id OR NEW.version IS DISTINCT FROM OLD.version OR
    NEW.quota_plan_id IS DISTINCT FROM OLD.quota_plan_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='a published plan version is immutable';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION meldiq_private.freeze_published_price() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER billing_plan_versions_frozen BEFORE UPDATE ON meldiq.billing_plan_versions
FOR EACH ROW EXECUTE FUNCTION meldiq_private.freeze_published_price();
