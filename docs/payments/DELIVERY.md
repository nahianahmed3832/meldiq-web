# Payment release delivery record

## Release status

The release is built, tested and staged as API `46f236462af164ee6442763ab3d4c6a6f8d7429a`, web `0.5.0-beta-payments-42f4e7ae`, and admin `1.5.0-payments-f87c5396e041`. Production activation was attempted, waited 600 seconds for the existing Atlas migration release lock, and exited with `blocked_by_existing_deployment` before any production mutation. No activation process remains running. A fresh guarded attempt is required once that migration releases the lock. This record does not claim deployment. The guarded activation aborts if any active API image or web/admin release has advanced.

## Feature checklist

| Feature | Implementation and validation | Production status |
|---|---|---|
| Existing PayPal Plus, Sparks and Bots+ | Existing wallet/hosted flow preserved; free signup trial remains independent | Existing live service remains active |
| Gift friend, email or private link | Server-priced one-time purchase, recipient binding, expiry, delivery/resend, redemption and stacked/queued entitlement; automated tests and real Sandbox gift capture/redemption passed | Ready to enable after guarded release |
| Embedded one-time cards | PayPal SDK v6 hosted fields; provider eligibility, issuer checks and server verification; real Sandbox capture/refund passed | Off pending confirmed merchant/compliance eligibility and complete 3DS matrix |
| Saved cards | Owned setup completion, encrypted tokens, masked display, explicit save consent/removal; real Sandbox save/delete passed | Off pending merchant/compliance approval |
| Card Plus and Bots+ renewals | Explicit consent, frozen prices, deterministic periods, leases, idempotency, cancellation, failed-payment recovery and core grants; automated lifecycle tests and real Sandbox off-session capture passed | Off; full scheduled provider lifecycle and 3DS matrix remain outstanding |
| Billing history and receipts | Unified owner-only order projection and receipts; authenticated boundaries and sanitized contracts tested | Ready for guarded release |
| Admin gift/order management | Existing RBAC, passkey, CSRF and reason/audit controls; admin typecheck/build passed | Ready for guarded release |
| Branded notifications | Durable database outbox, retry/deduplication, encrypted recipient data; automated delivery/error tests passed | Existing SMTP configured; real recipient mail delivery not exercised in production |
| Refund/reversal handling | Existing PayPal refund/dispute core preserved; card adjustments reconcile core entitlement; real Sandbox refund and signed event verification passed | Existing live refund path preserved; new card refund UI is not implemented |
| Coupons and tax | Additive order fields and coupon schema only; no configured campaigns or tax collection | Not implemented end to end; not advertised or applied |
| Multiple simultaneous API writers | Current Rows projection requires one writer | Unsupported; retain existing single API service |

China is owner-confirmed. Live app checkboxes were inspected, but app settings do not establish completed merchant approval or applicable PCI assessment. No unknown approval or compliance has been attested. No live charge was made during testing.

## Architecture and security

The new modules extend the existing Fastify billing core, versioned catalog, verified PayPal provider and entitlement grants. SQLite migration 090 and Mongo domain mappings are additive. No new database/queue service is introduced. The Next static client and Vite admin use existing authentication, router, themes and controls.

PayPal-hosted components collect card information directly. Meldiq APIs accept only owned internal references. Provider tokens and email addresses are encrypted; redeemable gift tokens are 256-bit random values stored as hashes, with URL fragments kept out of persisted navigation and fixtures. Signature-verified, deduplicated provider events and authoritative capture checks precede entitlement activation. Cancellation preserves paid time. Unknown payment results reconcile before retry and cannot manufacture a new charge after the retry window. New gift/payment records survive a service rollback.

## Added customer APIs

- `GET /v2/billing/payment-methods`
- `POST /v2/billing/payment-methods/setups`
- `POST /v2/billing/payment-methods/setups/:id/complete`
- `DELETE /v2/billing/payment-methods/:id`
- `GET /v2/billing/orders`
- `GET /v2/billing/orders/:id/receipt`
- `GET /v2/billing/card-subscriptions`
- `GET /v2/billing/card-subscriptions/quote`
- `POST /v2/billing/card-subscriptions`
- `POST /v2/billing/card-subscriptions/:id/cancel`
- `PUT /v2/billing/card-subscriptions/:id/payment-method`
- `GET /v2/billing/gifts`
- `POST /v2/billing/gifts/preview`
- `POST /v2/billing/gifts/redeem`
- `POST /v2/billing/gifts/:id/redeem`
- `POST /v2/billing/gifts/:id/link`
- `POST /v2/billing/gifts/:id/resend`

Existing PayPal checkout APIs now accept the new gift recipient union; legacy recipient IDs remain supported. The existing signature-verifying webhook endpoint remains in use. New admin APIs are `GET /admin/v1/billing/orders`, `GET /admin/v1/billing/gift-deliveries`, and `POST /admin/v1/billing/gifts/:id/resend|revoke`. The legacy admin gifts endpoint remains intact.

## Added persistent records

`billing_card_setups`, `billing_payment_methods`, `billing_card_mandates`, `billing_card_charges`, `billing_card_charge_attempts`, `billing_commerce_orders`, `billing_coupons`, `billing_coupon_uses`, `mojo_gift_deliveries`, `billing_notification_jobs`, and `mojo_gift_credits`. Existing subscriptions, invoices, provider events, gifts and grants are reused.

## Validation

- Final focused API run: 38 tests passed; backend typecheck/build passed.
- Actual Mongo replica-set billing integration: 27 tests passed.
- Web: 845 passed, one intentional skip; lint and production build passed.
- Browser regression: 68/69 passed initially; remaining gift test reached setup time budget after expected content rendered. All 12 targeted new gift/card cases subsequently passed on Chromium, WebKit and phone width.
- Admin: typecheck and production build passed; full admin unit suite was not run.
- Real Sandbox: hosted card capture, vault setup/token, off-session capture, repeated request IDs, refunds, signed capture/refund events and Meldiq backend gift redemption. Test charges refunded, test vault and temporary webhook deleted.
- Complete real 3DS challenge/failure matrix, real scheduled monthly provider renewal, production card eligibility and production user purchase/cancellation are not claimed as verified. No Android source changed; Android suite was not run.

See `SANDBOX_RESULTS.json` for public-safe provider evidence, `IMPLEMENTATION.md` for audit and architecture, and `ROLLOUT.md` for deployment and rollback requirements. Credentials remain in private local/server environments and are excluded from artifacts. Client builds passed a scan for configured PayPal client secrets.

## Deployment and rollback

Staged release: `/opt/griip-internal-messaging/releases/payments-46f23646`. `activation.json` freezes the expected active image and symlinks. `meldiq-activate-payments.py` acquires the shared release lock, rechecks the baseline, stores private Compose/environment receipts and an online SQLite backup, verifies artifact hashes, enables gift sales, keeps all three new card gates false, switches healthy API/web/admin releases and verifies effective flags. Existing web configuration, nginx configuration, volumes and independent service settings are retained.

If readiness fails, restore the previous Compose/environment and static symlinks under the lock. Never restore an old database over newer purchases, drop additive collections, or remove billing records. The activation receipt is private under `.rollback/receipt.json`. Do not bypass the migration owner's release lock.

## Modified files

Backend paths are relative to the isolated API worktree; web paths are relative to the isolated web worktree. Generated contract documents are included.

### Backend

- `docs/api/COVERAGE.md`
- `docs/api/openapi.json`
- `server/migrations/090_payment_ecosystem.sql`
- `server/src/app/server.ts`
- `server/src/infrastructure/crypto/secretBox.ts`
- `server/src/infrastructure/database/mongo/catalog.ts`
- `server/src/infrastructure/database/schema.generated.ts`
- `server/src/infrastructure/mail/commerceMail.ts`
- `server/src/modules/billing/cardSubscriptions.ts`
- `server/src/modules/billing/cardVault.ts`
- `server/src/modules/billing/commerce.ts`
- `server/src/modules/billing/config.ts`
- `server/src/modules/billing/giftDelivery.ts`
- `server/src/modules/billing/gifts.ts`
- `server/src/modules/billing/index.ts`
- `server/src/modules/billing/notifications.ts`
- `server/src/modules/billing/paypalCheckout.ts`
- `server/src/modules/billing/providers/paypal.ts`
- `server/src/modules/billing/providers/paypalApi.ts`
- `server/src/modules/billing/providers/paypalCapabilities.ts`
- `server/src/modules/billing/providers/types.ts`
- `server/src/modules/billing/routes.ts`
- `server/src/modules/billing/service.ts`
- `server/src/modules/billing/sparkPurchases.ts`
- `server/src/modules/billing/subscriptions.ts`
- `server/src/modules/platformAdmin/billing.ts`
- `server/src/modules/platformAdmin/opsRoutes.ts`
- `server/src/shared/contracts/http/cardSubscriptions.ts`
- `server/src/shared/contracts/http/commerce.ts`
- `server/src/shared/contracts/http/gifts.ts`
- `server/src/shared/contracts/http/index.ts`
- `server/src/shared/contracts/http/paymentMethods.ts`
- `server/src/shared/contracts/http/paypal.ts`
- `server/test/billing_notifications.test.ts`
- `server/test/billing_paypal.test.ts`
- `server/test/card_subscriptions.test.ts`
- `server/test/card_vault.test.ts`
- `server/test/paypal_capabilities.test.ts`
- `server/test/paypal_sandbox_gift_lifecycle.test.ts`
- `server/test/support/contracts.ts`
- `shared/contracts/fixtures/http/GET_v2_billing_gifts.json`
- `shared/contracts/fixtures/http/GET_v2_billing_orders.json`
- `shared/contracts/fixtures/http/GET_v2_billing_orders_id_receipt.json`
- `shared/contracts/fixtures/http/POST_v2_billing_gifts_id_link.json`
- `shared/contracts/fixtures/http/POST_v2_billing_gifts_id_redeem.json`
- `shared/contracts/fixtures/http/POST_v2_billing_gifts_redeem.json`

### Web

- `.gitignore`
- `docs/payments/IMPLEMENTATION.md`
- `docs/payments/ROLLOUT.md`
- `docs/payments/SANDBOX_RESULTS.json`
- `e2e/paypal-checkout.spec.ts`
- `src/api/cardSchemas.ts`
- `src/api/commerceSchemas.ts`
- `src/api/giftSchemas.ts`
- `src/api/paypalSchemas.ts`
- `src/application/lastPlace.ts`
- `src/application/router.ts`
- `src/i18n/strings.ts`
- `src/styles/billing.css`
- `src/ui/App.tsx`
- `src/ui/auth/AuthScreen.tsx`
- `src/ui/billing/AddonCheckoutPage.tsx`
- `src/ui/billing/BillingPage.tsx`
- `src/ui/billing/CardBillingAddress.tsx`
- `src/ui/billing/CardSubscriptions.tsx`
- `src/ui/billing/CheckoutPage.tsx`
- `src/ui/billing/CheckoutPaymentButton.tsx`
- `src/ui/billing/EmbeddedCardFields.tsx`
- `src/ui/billing/GiftSignInNotice.tsx`
- `src/ui/billing/GiftsPage.tsx`
- `src/ui/billing/Orders.tsx`
- `src/ui/billing/PayPalCardButton.tsx`
- `src/ui/billing/SavedCards.tsx`
- `src/ui/billing/cardFieldTheme.ts`
- `src/ui/billing/checkoutDraft.ts`
- `src/ui/mojo/MojoGifts.tsx`
- `src/ui/mojo/MojoPage.tsx`
- `src/ui/settings/SettingsView.tsx`
- `src/ui/settings/settingsSearch.ts`
- `test/contract-fixtures/http/GET_v2_billing_gifts.json`
- `test/contract-fixtures/http/GET_v2_billing_orders.json`
- `test/contract-fixtures/http/GET_v2_billing_orders_id_receipt.json`
- `test/contract-fixtures/http/POST_v2_billing_gifts_id_link.json`
- `test/contract-fixtures/http/POST_v2_billing_gifts_id_redeem.json`
- `test/contract-fixtures/http/POST_v2_billing_gifts_redeem.json`
- `test/contract-fixtures/routes.json`

### Admin

- `src/console/pages/billing/Billing.tsx`
- `src/console/pages/billing/Gifts.tsx`
- `src/console/pages/billing/Orders.tsx`
