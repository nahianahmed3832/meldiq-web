# Meldiq payment ecosystem — audit and execution plan

## Audit, 2026-11-02

The app is a Next 16.3.8 Pages Router static export with a React client, IndexedDB state, an offline service worker and an existing Meldiq design system. Production checkout already supports PayPal wallet subscriptions, hosted guest-card buttons, one-time Sparks and community Bots+. Hosted guest buttons are not embedded Advanced Card Fields. Preserve the recent return-to-checkout and Safari grid fixes.

The backend is Fastify/TypeScript. Its billing module already abstracts PayPal, Stripe, Google Play and a test provider. `Rows` provides transactional SQLite/MongoDB adapters; billing reads currently use a synchronous projection, while MongoDB writes commit atomically. Existing tables cover versioned plans, customers, checkouts, subscriptions, invoices, provider events, grants, gifts, Spark purchases and durable refund actions. Unique provider-event and request indexes, authoritative reconciliation and verified capture already exist. Reuse those systems and retain historical Go/Stripe/Play records. New sales remain Free and Plus; resolve prices from the published catalog.

Production was inspected directly: active sources are social-auth API 0.74.0 and the social-auth web overlay over 426ad2b. Release metadata can lag active compose/symlink targets, so inspect actual targets and preserve their source snapshots before any release. This work uses isolated worktrees and preserves the owner's dirty root checkouts.

Redis is not a dependency of the deployed billing module. Existing scheduled cleanup/reconciliation uses durable database state. Do not introduce a second queue service; add a transactional database outbox with retry/lease semantics where payment delivery or renewal scheduling requires it. Mail already uses a metered branded transport; notifications and account email verification already exist. Super Admin is the separate React/Vite app at meldiq_central_admin with RBAC, passkey confirmation, CSRF and audited written reasons. Extend its billing sections.

Current gifts cover existing users and fixed Plus durations, authoritative one-time payment, transactional redemption and entitlement grants. Gaps: hashed redemption links, verified-email recipients, delivery outbox, expiration/revocation, buyer delivery controls and full gift administration. Current gift grants do not account for an existing paid period: fix stacking without silently changing the customer's active renewal.

## Execution order

1. Preserve current production sources; record SDK/merchant capability evidence and explicit disabled-by-default production gates. Check the signed-in PayPal dashboard without changing financial settings. Sandbox-only financial tests.
2. Add the v6 Advanced Card Fields path for one-time orders using browser-safe SDK tokens, SDK eligibility and required 3DS. Keep wallet and legacy subscriptions as separate explicit choices; never silently fall back from cards to wallet.
3. Add owner-bound encrypted saved-card references, owned setup intents and server-authoritative token exchange. Add recurring mandates, explicit consent, durable period jobs, leases, idempotent charges, cancellation, retry/grace and reconciliation. Production requires independently confirmed merchant capabilities, country/currency and compliance configuration; automated card renewals are not operational until real sandbox lifecycle tests pass.
4. Extend the existing catalog/checkout with unified server-priced order views and a ledger of discounts, tax and entitlement outcomes. Unsupported tax/coupon configuration must fail clearly rather than invent totals.
5. Extend existing gifts with link/email/existing-friend delivery, hash-only redeemable tokens, transactional redemption, delivery receipts, expiry, refunds/revocation and stacking. Gift purchases are one-time and never charge recipients or replace payment methods.
6. Extend native checkout, gift purchase/redemption, billing/payment-method/history screens and Super Admin gifts/orders/capabilities. Preserve themes, navigation and accessibility.
7. Add transactional branded delivery for purchases, gifts, renewal outcomes, cancellation and refunds using existing mail/realtime infrastructure. Add operational counts and audited administration.
8. Run unit, provider, concurrency, MongoDB and browser regressions plus credential-backed PayPal Sandbox tests. Report mocked and real-sandbox results separately. Produce configuration, migration, rollback and capability checklists. Keep new unapproved production capabilities disabled.

## Verification and release gates

Never collect raw card/CVV data in Meldiq inputs, APIs, logs or storage. SDK fields submit directly to PayPal. Never expose saved provider tokens. Bind setup/order/mandate/payment methods to the authenticated account. Preserve existing free signup trials independently of payment approvals. Verify webhook authenticity, merchant/amount/currency/resource identity and completed capture before entitlement activation. Use minor units, deterministic provider request IDs, atomic claim/redeem and replay-safe state transitions. Preserve already-paid periods on cancellation; unknown provider state cannot become fake cancellation.

Sources: official PayPal SDK v6 reference, Advanced Checkout, Payment Method Tokens API, Orders v2 and webhook documentation. The general Tokens API documentation lists SAQ D; hosted-fields documentation differentiates integrations that transmit raw card data. Merchant-specific requirements remain an activation gate until confirmed, not an assumption.

## Merchant capability evidence

In the authenticated PayPal Developer Dashboard, live app Meldiq shows Advanced Credit and Debit Card Payments selected (read-only), Save payment methods selected, Subscriptions selected and SDK v6 selected. No app settings were changed. These checks do not establish country eligibility, completed PCI attestation, successful 3DS or tested card renewals. The owner subsequently explicitly authorized production deployment across payment surfaces and enabling friend gifting after validation. Sandbox remains the environment for financial tests.
