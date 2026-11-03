# Migration reconciliation report

**No production/customer records have been migrated to Supabase.** Source inventory counts are observations of a running database, not source/destination matches. Existing historical Atlas reconciliation reports remain historical.

The SQL migration has been exercised against isolated PostgreSQL with synthetic fixtures. The typed importer checks all columns and record hashes, resumes a completed batch only when its source checksum matches, and refuses conflicting destination content even when counts match. Failed batches leave neither inserted rows nor checkpoints. Dependency order and active-writer exclusion are tested.

Local frozen rehearsal passed for 277 application tables and 1,009 synthetic records, including row hashes/counts, timestamp ranges and an exact `1250` minor-unit financial fixture. A custom-format pg_dump was independently restored and reconciled successfully. See `docs/testing/supabase-rehearsal-results.json`.

Hosted staging import/resume/reconciliation also passed for 1,009 records using the earlier 269-table catalog, before migration006 added eight empty administration tables. See `staging-rehearsal-results.json` and `staging-reconciliation.json`. Subsequent hosted smoke fixtures add synthetic users/conversations/events: do not claim that the earlier whole-table count result describes the later mixed fixture state. Repeat full acceptance using an isolated clean target or a reviewed fixture namespace strategy.

All 24 source native business mappings have normalized models and PostgreSQL repositories. The additional Auth device-policy relation is new application authorization state. Full production-record validation remains incomplete. Outstanding: complete account/provider mapping; payment/provider financial evidence; all ownership/membership/channel relationships; S3 object/metadata checks; device-only acknowledged imports; final frozen production reconciliation.

For every accepted migration run, retain immutable source/canonical-catalog SHA-256, per-file/batch counts/checksums, destination count/hash results, timestamp extrema/distributions, exact integer financial totals and referential checks. Public discrepancy samples contain table and key/content digests only. Never include credentials, password hashes, tokens or customer message text.
