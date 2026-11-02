# Frankfurt customer-data rehearsal — November 3, 2026

The user approved a first real-data rehearsal in the existing Frankfurt staging project`bkvlxbsnzqkhbifawcww`, while Atlas continues serving live clients. This does not authorize a production database traffic switch or a paid plan upgrade.

The source is a read-only MongoDB snapshot session covering275 collections/692,113 records. The immutable snapshot was encrypted directly through age; no plaintext dump was written on the VPS. Its ciphertext is verified by decryption and SHA-256. Canonical BSON record checksums verify every source collection during normalization. MongoDB's [snapshot read semantics](https://www.mongodb.com/docs/manual/reference/read-concern-snapshot/) permit the point-in-time rehearsal while live writes continue. It is **not** the final write-frozen cutover snapshot.

The normalized application copy contains282 typed tables/677,617 records, including27 accounts,66 identities,126 devices,3,414 message events and516 attachment metadata records. IDs, complete normalized record hashes, timestamp ranges, integer financial totals and13 source counter floors reconcile locally. The previous migration archive contains14,269 records; one earlier audit original and226 legacy metadata records remain in the complete encrypted source backup. Two historical pre-PayPal archive collections are empty. These archives are retained as recovery/evidence material rather than activated as business tables. No source records or archives were deleted.

Migration013 aligns the PostgreSQL schema with production source708353fe's attachment-publication fields, billing frequency and three promotion tables. It preserves published-price immutability, RLS/FORCE RLS and denial of direct authenticated/anonymous CRUD on all289 application/operational tables. The backend runtime candidate still requires integration with the newer production feature code before activation; schema alignment alone is not production API parity.

Local verification includes the complete real-data import/resume and reconciliation, a separate atomic CSV COPY/reconciliation/resume,102 PostgreSQL/Auth/security tests, five schema tests, 56 affected API checks and a complete TypeScript build. Initial validation caught unmapped recent source fields, legacy counter shape differences and JSONB arrays being encoded as PostgreSQL arrays. Those were fixed before hosted import. A slower composite-key reconciliation query was stopped only in an owned local test and replaced with a bounded VALUES join; the full actual-data comparison subsequently passed.

Before hosted replacement, staging's synthetic application/Auth/migration data was encrypted and independently restored:317 tables/1,396 rows, including24 synthetic Auth users. Exact row checks pass. The known Node25 TLS shutdown warning remains in the receipt; certificate verification stayed enabled. This backup establishes stored-row recovery, not full Supabase/Auth/Realtime/provider recovery.

The hosted COPY operation runs in one transaction with a repository writer advisory lock and table locks. It checks the exact application/operational fingerprints against the verified backup inside the transaction and requires synthetic email domains before replacing fixtures. Only three explicitly named synthetic-fixture delete triggers are temporarily disabled and restored in the same transaction; FK/check/RLS enforcement remains enabled. No worker, push sender, mailer, payment dispatcher or Realtime publisher is started against the customer rehearsal. A failed transaction restores the previous staging fixture state. COPY completion is followed by full record/timestamp/financial/counter reconciliation and a verified repeat-run check.

Synthetic import and hosted smoke entry points now refuse a customer-data rehearsal. A schema-purpose marker also fences customer data even if account rows are later removed. Raw customer records, credentials, plaintext source files and diagnostics stay outside Git in the private support directory. Public receipts contain counts, fingerprints and timings only.

Execution receipts:

- `docs/testing/supabase-real-data-snapshot.json`
- `docs/testing/supabase-real-data-local-results.json`
- `docs/testing/supabase-real-data-local-copy-results.json`
- `docs/testing/supabase-real-data-hosted-results.json` (success only after full hosted reconciliation)
- `docs/testing/staging-migration-test-native-results.json`

The web preparation deployment retains legacy production login. Android0.5.5/code34 is prepared in the isolated `meldiq_android_migration_release` checkout, with1,010 tests passed/12 skipped and production Supabase activation disabled. Its APK uses the local debug certificate; its release AAB is unsigned. No mobile store publication or device installation occurred. Physical-device acceptance remains pending.

Atlas, S3 object contents/keys, the Hostinger application server, useful Redis, LiveKit and push infrastructure remain authoritative/operational as before. Attachment metadata reconciliation does not replace fresh object/fallback availability checks. The earlier S3 probe covered482 references; this newer snapshot contains516.

Do not cut over traffic yet. Open gates include stale Realtime authorization after logout, full unified Auth/account/billing/admin principal coverage, integration with the latest production API, physical-device/media/push/payment acceptance, deployment/load testing and off-host full-stack recovery. A final write freeze and new complete data sync/reconciliation are still required because Atlas remains live after this rehearsal snapshot.

Hosted completion: `2026-11-02T17:18:00.946Z` (November3 in Asia/Shanghai). The hosted receipt reports success for all282 tables/677,617 rows, complete hashes/timestamps/financial/counter comparisons and exact-run resume. The pooler float precision issue was fixed by explicitly initializing every lease to full precision; no imported record was rewritten to obtain a match. The production API remains on Atlas.

Post-import recovery verification also passes: the8,800,326-byte age-encrypted PostgreSQL archive authenticates completely and independently restores/reconciles317 tables/678,057 rows. The first large-archive TOC listing producedEPIPE because `pg_restore --list` exits without consuming the data section; the verifier now authenticates the whole stream separately and resumes verification of the same saved archive. Original failure receipts remain preserved. This covers stored Auth/application/migration rows, not full Auth/Realtime/provider/off-host service recovery.
