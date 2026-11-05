-- Existing accounts remain nullable and are not backfilled with consent they did not give.
ALTER TABLE meldiq.accounts ADD COLUMN signup_policy_acceptance text;
