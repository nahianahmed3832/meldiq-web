# Controlled migration plan

Status: synthetic rehearsal tools implemented. Live customer migration is not authorized by a successful synthetic import, and has not run.

## Source selection

The observed source is Atlas schema6/all16. The isolated implementation baseline is API0.76.0 commit `dfb010738b323c37f7489cea8ef8491e88f03909`; the live release has advanced independently and must be inspected again before preparing a release. Freeze/preserve Atlas, inactive SQL, deployment env/configuration, original images and keys under the existing exclusive production release-lock protocol. Reconfirm the exact runtime immediately before preparing a release; other ongoing work may advance it. Do not reuse an old handoff keeper PID or deploy the old root backend.

The generated application catalog covers 279 relations: 254 core, 24 normalized native business models and one new Auth device authorization relation. Seven private operational tables bring the protected application/private total to286. All native-only collections need explicit normalized converters/repositories; archival/conflict collections need a documented retention/export disposition. New or unknown source columns/collections stop the pipeline. No batch may skip or silently discard a malformed record. Device-only pending work remains on devices and imports only after authenticated ownership checks and acknowledgments.

## Implemented rehearsal tools (isolated backend worktree)

1. `scripts/supabase-schema.ts <web-root>` generates schema/catalog/types from actual applied release migrations.
2. `scripts/supabase-export.ts sqlite|mongo <source> <private-output> --synthetic-frozen` exports a synthetic immutable source as private NDJSON files and a SHA-256/count manifest. It refuses an existing output folder and unclassified native collections. SQLite uses one readonly transaction; synthetic Mongo sources must be loopback rehearsal databases.
3. `scripts/supabase-import.ts <snapshot-folder>` checks every file hash and catalog before connecting, imports in FK order, validates all scalar/binary types and uses batches of250 (hard maximum500). Existing conflicting rows fail instead of being overwritten. Rows and checkpoint commit together. Completed batches are rechecked on resume. The live cached writer must be stopped.
4. `scripts/supabase-reconcile.ts <snapshot-folder> <private-report>` compares every record hash, count, timestamp extrema and exact minor-unit totals. Report discrepancies use key/row digests, not customer data.

Credentials come from private environment, never CLI literals in shell history or source. Current importer deliberately accepts only frozen synthetic snapshots in development/staging. Production customer import must be a separately reviewed release with a consistent frozen source, complete native mappings and tested backup/rollback; no hidden force flag bypasses this gate.

## Acceptance order

Finish native stores and auth migration; apply staging migrations with the official CLI; import/reconcile synthetic workloads; run API/Android/web/admin/Realtime/S3/payment/push tests; load and failure-test; export a full backup and restore it independently; rehearse write-frozen rollback. Then prepare the exact production release/region/configuration and obtain explicit production approval.

During cutover: acquire current shared release lock, ensure LiveKit/call continuity, enter maintenance for every API ingress, freeze legacy writers, preserve final backups and off-host hashes, import final changes with no legacy writes, reconcile all records and money/provider evidence, switch configuration, run direct and client smoke tests while writes remain frozen, and only then permit writes. Keep legacy sources/backups intact. Once new writes begin, repair forward or reconcile every post-cutover write before reverting.
