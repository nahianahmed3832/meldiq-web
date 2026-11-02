# Supabase rehearsal operations

This checkout collects the schema, operational scripts, master documentation and aggregate execution receipts independently of the user's dirty web working tree. It builds on the deployed web preparation commit8bda737. The operational branch has not been pushed or deployed.

The Frankfurt project`bkvlxbsnzqkhbifawcww` now contains customer rehearsal data. Atlas remains live. Synthetic hosted imports and API/Realtime smoke entry points are deliberately fenced; use a disposable synthetic environment or owned loopback PostgreSQL database for further mutation tests. Do not remove the customer-data marker to bypass this protection.

Private database/Auth credentials and the age recovery identity remain outside Git under the owner's private support directory. No passwords or secret keys are included here. Scripts validate the exact staging project and verified TLS. The backend helper checkout defaults to the sibling `meldiq_supabase_migration/server`; when supported, `MELDIQ_SERVER_DIR` can select its absolute path.

Read-only database/security checks use:

```sh
node scripts/supabase/check-migrations.mjs
node scripts/supabase/staging.mjs check
node scripts/supabase/staging.mjs test-native
```

`backup-restore-staging.mjs` exports a read-only hosted snapshot and independently restores an encrypted archive into a newly owned loopback database. A failed verification can resume the same saved archive with `--resume=/absolute/private/hosted-backup-<id>`; source fingerprints and the ciphertext checksum must exist. The full encrypted stream authenticates independently of the TOC-only listing. No plaintext dump is written. Full-stack/off-host recovery remains separate acceptance work.

The real-data rehearsal has already completed. Do not rerun snapshot replacement against existing customer data. `copy-real-rehearsal.mjs` requires a verified local run, storage headroom and a verified pre-replacement backup. Its initial COPY/reset is atomic; an existing exact run is checked rather than recopied. Only backed-up synthetic fixtures may be replaced. The final production freeze/sync requires a separately reviewed execution because Atlas has continued receiving writes.

Evidence and remaining gates are documented in `docs/migrations/staging-real-data-rehearsal-20261103.md`, `docs/migrations/execution-status.md` and `docs/testing/supabase-real-data-*.json`.

Backend source is committed at2cf5268f in the isolated migration checkout; patches0012 and0013 are included for review. Android source is committed atfdae429e in `meldiq_android_migration_release`; its artifact folder contains the debug-signed0.5.5 test APK, unsigned release AAB, a preparation patch and verification receipt. Neither Android nor production Supabase traffic was published/activated. Current production API feature integration, unified Auth, Realtime revocation, device/provider acceptance, load testing and off-host full-stack recovery remain required before cutover.
