# Rollback plan

**Approved design: controlled pre-public-launch write-frozen rollback window. No reverse change-capture system has been implemented. No post-write no-loss rollback claim is made.**

| Failure | Detection/trigger | Recovery |
|---|---|---|
| Schema/import mismatch | nonzero discrepancies, FK/check failures, native source unmapped | retain maintenance; stop import; keep source; repair/rehearse staging |
| Account ownership/linking failure | duplicate mapping, provider-subject conflict, failed reset/device enrollment | keep old Auth/accounts intact; restore old client/API config while writes frozen |
| RLS/permission leak | unauthorized access test succeeds | do not activate; freeze access, retain evidence and correct policy |
| API/payment regression | contract failures, unverified entitlements or duplicate webhook effects | block release; use the exact latest compatible previous image/config |
| Realtime/push outage | oldest outbox age/retry/dead-letter thresholds | keep committed messages; repair publisher, replay jobs, client history catch-up |
| Database outage | readiness/query errors, sustained pool waiting | maintenance; use tested compatible restore/repair-forward runbook |

## Before any production switch

Record current API/web/admin/Android versions, complete private env/config and ingress plan, authority markers, database schemas, account/provider mappings, migration manifest, timestamps, bucket/key policies and signed-object access checks. Preserve legacy Atlas/SQLite and independently restore verified encrypted backups. A historical Atlas-only restore receipt does not certify PostgreSQL recovery.

## Zero-loss rollback window

Keep both legacy and new application writes frozen through final sync, reconciliation, configuration switch and smoke checks. If any mandatory gate fails, return API/client/Auth configuration to the captured previous release and verify users, memberships, message counts, payments, S3 and LiveKit before reopening legacy writes. RPO for application writes is zero only because neither system accepted new writes during this window. New Supabase sessions/provider actions must also remain test-only; do not strand real users with a new provider identity that the old stack cannot resolve.

## After PostgreSQL accepts writes

A connection-string reversal would discard new writes and is prohibited. First enter maintenance, capture current PostgreSQL/Auth/audit/outbox backups, and inventory all post-cutover changes (including edits/deletes, billing webhooks, grants, device changes and identities). Prefer repair forward on PostgreSQL. Any return to legacy requires a separately tested reverse transform, preserved ordering/idempotency, provider/account reconciliation and zero unresolved discrepancies. If that cannot be proved, remain on maintenance/repair forward and report the RPO/RTO risk explicitly. Never discard or overwrite newer data to make counts match.

## Restore and verification

Restore to a new unpublished environment, using matching schema/runtime, encrypted key escrow and provider configuration. Compare all rows and references, money/provider event evidence, messages/attachments, ownership mappings and outbox state. Do not replay customer push or payment side effects from restored historical jobs. Run synthetic Auth/Realtime/API and client acceptance before traffic changes. Change only reviewed environment fields; preserve S3 buckets/object keys and LiveKit configuration.

RTO and production rollback timing remain unmeasured. Local synthetic restore timing will be recorded separately; it is not a production SLA.
