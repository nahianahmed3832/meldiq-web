# Security audit

Status: local repository/security checks and hosted synthetic Auth/private Realtime checks passed; full production security acceptance remains blocked.

## Controls implemented

- Every generated application/operational table enables and forces RLS; anon/authenticated have no raw table CRUD. All business reads/writes remain behind server authorization in this release.
- Runtime role is NOBYPASSRLS/NOLOGIN; the separate staging login inherits this role and was verified without privileged attributes, schema creation or Auth-user writes. Production needs its own secret login; never use postgres/service-role for normal requests. Sensitive account, financial and admin tables have no client mutation policies.
- Supabase JWT verifier pins project issuer/JWKS, checks ES256/RS256 signature, audience/role, expiry/recent issuance fields, UUID subject/session, current verified ownership, suspension/deletion, live unexpired provider auth.sessions membership and local revocation. Mutable metadata is ignored for authorization. Platform-admin privilege does not follow a Supabase or community role.
- Mapping trigger and uniqueness reject mismatched or duplicate ownership. Existing IDs, keys and provider subjects are not inferred from email.
- TLS verification remains on for remote PostgreSQL. Pool sizes and timeouts are bounded. Unsafe integers fail instead of silently rounding money/time.
- Message and delivery work commit together. Lease-token checks fence old workers; dead letters are recoverable. Realtime carries invalidation IDs only. Clients cannot inject message text/entitlements through event payloads.
- Web SDK adapter rejects privileged keys, seals sessions with nonextractable AES-GCM keys in device IndexedDB, binds ciphertext to its storage key and serializes wrapping-key creation. PKCE is enabled; callback auto-detection is off until the dedicated callback flow is integrated.
- Import files and credentials stay outside Git with restricted permissions; logs contain counts/digests and safe error codes. Synthetic importer refuses current production Auth project and production mode.

## Open mandatory findings

1. An explicit staging Fastify composition now selects PostgreSQL across domains and throws on any legacy SQL fallback. Its writer lease failure blocks cached authorization and native SQL until restart. Eight initial real hosted API smoke checks and 692 local API tests pass; the remaining API matrix, full Supabase Auth integration and client activation remain acceptance work.
2. Existing scrypt hashes are not copied into a bcrypt field. Implement tested verified recovery/reauthentication and preserve key-backup unlock before turning off old login. Current passkeys/TOTP/device sessions need their own migration and revocation acceptance.
3. Existing social project/provider subjects must be securely mapped to the new Auth project; Google/Discord secrets and Apple credentials must be configured privately. An email match is never sufficient to merge identities.
4. Topic authorization is cached by Realtime during connections. Short JWTs/rejoin/eviction and API authorization must cover revocation. Staging public access is now disabled and rejected by a live probe after a staging Realtime restart. The earlier saved-setting/probe mismatch is retained in test history. No unrelated permissive policy was found by hosted pgTAP. Verify the same independently on production.
5. Native FCM/APNs/push processing is not yet connected to new outbox jobs. Push delivery is at least once and needs event-ID deduplication.
6. Legacy server-readable message payloads can contain malformed historical JSON; source anomalies must be reported/recovered, not discarded. Search/read SQL needs parity against this actual source.
7. PostgreSQL metadata now passes a Fastify/SigV4 S3 test-server flow including unauthorized downloads, signed member download, exact 1 GB multipart announcement, cancellation and failed-upload cleanup. Local cascade/rollback/restart/race tests pass. Real AWS object/metadata reconciliation and a complete 1 GB byte transfer remain pending. No bucket, lifecycle or key policy was modified.
8. PostgreSQL/Auth restore and post-cutover write handling must pass before production. Current Free project backups are not equivalent to managed PITR.
9. EU primary location alone does not guarantee whole-service EU residency; inventory Hostinger/S3/logs/backups/access and document lawful transfer safeguards and DPA.

## Dependency findings

The isolated backend's initial audit found a high follow-redirects advisory; its compatible transitive patch was applied with npm audit fix. Re-run results are in the test report. Web audit identified existing ESLint/minimatch toolchain advisories; do not apply the suggested unrelated major downgrades automatically. No Supabase runtime advisory was reported in that scan. Full dependency remediation remains separate from migration acceptance.

## Resumed security checks

Account/identity writes share one PostgreSQL transaction and request-local overlay; unrelated requests cannot read staged account changes. Actual CHECK failure rolls both SQL and cached state back. Social identity matching uses exact provider/issuer/subject, never email. Meldiq OAuth code exchange and refresh hold row locks across issuance; replay rejection commits its family revocation, while unexpected database errors roll issuance back. Empty conditional DocumentStore updates now honor their predicate. Point credits, balance/day totals and level debits commit with their immutable ledger; unsafe aggregate reads reject the whole write. Ordinary clients remain denied all raw mutations, including every new table.

## Staged provider/device boundary

The opt-in bridge requires fresh legacy authentication with the existing MFA plus a signed one-use device challenge, bound to the exact new provider subject/session. PostgreSQL commits mapping and device policy state together. A binding cannot move to another device or be revived after local revocation; each new provider session requires proof. Existing global/device revocation participates in that same shared writer. Password-epoch changes and provider logout/ban/soft deletion deny API access; new Realtime policy probes also require an active binding. Public JWT metadata is ignored. Native user purging/provider configuration, complete account/billing/admin principal support and client rollout remain gates.

The session check deliberately references current Supabase auth.sessions plus auth.users banned_until/deleted_at behind a narrow SECURITY DEFINER function. These managed details need compatibility checks on provider upgrades; the API login cannot write the Auth schema. Temporary provider bans do not by themselves invalidate signed JWTs, so signature validation alone is insufficient. Existing Realtime connection permission caching still limits immediate eviction; full existing-socket revocation/fan-out acceptance remains open.

## Combined hosted findings

The restricted runtime's first actual API-to-Broadcast test exposed silent delivery loss: managed realtime.send swallowed its denied INSERT and the worker acknowledged the job. Migration012 plus direct transactional insertion fixes this. The backend's new managed-table policy requires exact pending leased outbox evidence; no client role gains persistent message publishing. Restricted-role positive, forged-event negative and enqueue-failure rollback tests pass, followed by two real private socket receipts.

Already joined channel revocation remains a confirmed release blocker. An independent socket retained its JWT after provider-only logout and received a later invalidation, while API access correctly returned401. Complete reliable eviction or delivery-time authorization and repeat this probe for provider/application logout, device/account revocation, bans and membership removal. Do not equate fresh-join policy checks with already-connected safety.
