# Payment rollout and operational gates

## Preserved production behavior

Free signup Plus trials remain independent of billing. PayPal wallet subscriptions, one-time Sparks, Bots+ and existing refunds retain their provider verification. New gifts use the existing server-priced catalog and grants. Go cannot be newly purchased; historical records remain readable.

The API candidate preserves the active social-authentication API 0.74.0 source. The independently attempted Atlas cutover was rolled back by its deployment workflow; this payment release does not re-enable it. Before any production switch, inspect the running image and web symlink again, acquire `/run/lock/meldiq-production-release.lock`, and preserve subsequent changes and all existing Compose overlays, environment files, resource limits and data mounts. Never deploy while another migration/release holds that lock.

## New features

- Gift delivery to a friend, a verified email, or the first claimant of a private link. Raw link secrets exist only in delivery memory and customer URL fragments; the database stores SHA-256 token hashes. Emails are encrypted with SecretBox and looked up by a purpose-separated keyed fingerprint.
- Only verified payment creates a redeemable gift. Recipient binding, redemption and grant/credit creation are atomic in the billing Rows unit. This deployment continues to require exactly one API writer; the existing Mongo projection is not a multi-process locking system.
- Gifts follow existing free/paid periods. An ongoing approved renewal keeps gifts as credit until it ends; this does not modify a payment mandate. Unfinished approval checkouts must resolve before redemption.
- Branded receipts, cancellation notices, gift delivery/redemption, payment-attention notices and upcoming-renewal reminders use a durable database outbox. SMTP delivery is at least once; an ambiguous SMTP acknowledgement can produce a duplicate email. Email gift retries rotate the link because recoverable raw secrets are not persisted.
- Owner-only saved cards use PayPal-hosted SDK v6 fields and setup tokens. Only masked brand/last-four/expiry reaches the customer API; durable provider references are encrypted and bound to account and method IDs.
- Card mandates freeze published plan version and record explicit recurring consent. Each billing period has one charge job and one deterministic provider request identity. Unknown outcomes are reconciled; no new order is created after the conservative idempotency retry window. Paid time is written through the existing subscription/invoice core. Cancellation stops future claims, preserving verified paid periods; an already-started payment may still complete.
- Unified orders/owner-only receipts project the existing payment records. Original gross amounts and currencies are retained. No tax rules or coupons have been invented or silently applied; the current deployment does not collect tax or offer configured coupon campaigns.
- Existing billing RBAC, console CSRF, recent passkey confirmation, written reasons and audit records protect gift resend/revocation. Administrators never receive redeemable gift links or vault tokens.

## Configuration

Existing live PayPal credentials remain server-only. Gift sales require `PAYPAL_GIFTS_ENABLED=true`; subscriptions, Sparks and Bots+ keep their existing independent settings. Email delivery additionally requires the configured mail transport and `PLATFORM_SECRETS_KEY`; friend/link gifts do not require email.

New card gates default false:

- `PAYPAL_ADVANCED_CHECKOUT_ENABLED`
- `PAYPAL_VAULT_ENABLED` (requires Advanced Checkout and encryption key)
- `PAYPAL_CARD_RECURRING_ENABLED` (requires vaulting)

Live activation also requires confirmed `PAYPAL_MERCHANT_COUNTRY=CN`, applicable `PAYPAL_ADVANCED_CHECKOUT_APPROVED`, `PAYPAL_VAULT_APPROVED`, `PAYPAL_CARD_RECURRING_APPROVED`, and `PAYPAL_CARD_COMPLIANCE_CONFIRMED`. These are deployment attestations, not claims derived from an app checkbox. Do not set them to bypass missing merchant approval, applicable compliance review or real Sandbox lifecycle verification.

PayPal dashboard checked: Advanced Credit and Debit Card Payments, Save payment methods, Subscriptions and SDK v6 are enabled on the live app. This does not establish every merchant/compliance prerequisite. The owner confirmed China and does not know their assessment status. No assessment has been falsely attested.

## Verification recorded so far

- 38 focused SQLite/provider-boundary tests passed after the final safety changes; the MongoDB billing integration run passed 27 cases.
- API build/typecheck and admin build/typecheck passed.
- Real Sandbox hosted-card capture, card saving, off-session vaulted-card capture, idempotent order/refund retries, full refunds and signed capture/refund webhook verification passed. A real Sandbox gift was captured through the Meldiq backend, redeemed into one grant, replayed safely, and refunded during cleanup. No real-money test has been performed.
- A full real 3DS challenge/failure matrix and confirmation of applicable live merchant/compliance requirements remain outstanding. The tested frictionless test number did not return an authentication_result, so it is not counted as a verified 3DS challenge. Production embedded cards, vaulting and card renewals remain off.
- The full web unit suite passed 845 tests (one intentional skip), and lint passed. Browser regression run: 68/69 passed initially, with one test reaching the global time budget after rendering the expected link. All 12 targeted gift/card cases then passed across Chromium, WebKit and phone width. Production deployment checks remain pending; do not describe the full rollout as deployed until actual release IDs and public verification are recorded.

## Rollback

Store the previous API image, all effective Compose files and web/admin symlink targets in a private release receipt before changing them. If readiness fails, restore only those service/image/symlink settings under the release lock. Keep additive payment collections/tables, gift records, outbox, new orders and all existing data; never drop them as a rollback. Disable new card flags independently to stop future charge claims while retaining cancellation and read-only reconciliation paths.

## Production attempt outcome

The guarded API/web/admin activation waited 600 seconds for the active Atlas migration release lock and exited without production changes. Gift sales remain disabled on the active release; new embedded card/vault/renewal capabilities were not enabled. All candidates and checksummed manifests remain staged at `/opt/griip-internal-messaging/releases/payments-46f23646`. No activation process remains running. Inspect `DEPLOYMENT_STATUS.json`, recheck the active baseline, and rerun the guarded activation after the migration owner releases its lock. If production has advanced, integrate and validate that source first; never bypass the guard or lock.
