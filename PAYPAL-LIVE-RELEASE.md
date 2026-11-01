# Live Plus checkout

The owner authorized live production testing on 2026-11-01. This release adds the branded PayPal checkout to the current production web source, preserving its chat fixes.

Plus costs USD 3.99/month. The checkout displays live payment language and loads the official production PayPal v6 SDK. Existing free Plus time with more than two days remaining postpones the first charge; the review shows zero due today and the server-provided first payment date. Approval alone never creates paid entitlements. Billing includes cancellation and provider-verified purchase history.

Go is closed. Live gifts and Spark purchases remain unavailable. Advanced cards were ineligible in the real SDK probe and are not advertised. PayPal controls eligible funding choices during buyer approval.

Validation: 811 unit tests passed, one skipped; eight browser tests passed across desktop and phone using explicit provider/SDK doubles under production CSP; TypeScript, lint and production build passed. Real live SDK 6.71.0 loaded with subscription and one-time session APIs, PayPal eligible, advanced cards ineligible, and zero CSP violations. These checks do not constitute a paid capture or refund.

API release: 0.69.0, backend branch codex/paypal-live, commit 0bcd0a6. Existing billing/MongoDB records, grants, price validation, signed webhook verification and refund audit are reused. Backend operator setup and deployment notes: docs/PAYPAL_LIVE_RELEASE.md in the backend checkout.

Production: https://web.meldiq.app/settings/mojo and /settings/checkout. Previous web release 0.5.0-beta-dfd65d0 and API 0.68.0 are retained for rollback; private backups reside at /opt/griip-internal-messaging/backups/paypal-live-20261101. No credentials are included in this release. The user must approve their own PayPal payment to complete a real purchase test.

Deployment completed 1 November 2026: web release 0.5.0-beta-2e90e08; API image 0.69.0-paypal-live (runtime source 0bcd0a6); admin release 1.4.0-20261101T082955Z. API healthy with zero restarts, live catalog public, unauthenticated billing configuration restricted, original runtime web configuration retained. The real live SDK ran on the public checkout origin with zero page/CSP errors. Live subscription creation and genuine signed webhook verification passed; the controlled unapproved probe produced no customer subscription or paid invoice and was marked ignored with an operator audit. Paid capture, renewal and refund still require buyer-approved testing.

Atlas schema cutover: the first API attempt was rolled back after collMod was denied to its readWrite user. With the API stopped and both affected collections verified empty, the originals were preserved under _pre_paypal_20261101 names and release collections created with strict validators/indexes. No records were deleted or permissions expanded. The healthy retry uses the existing versioned billing catalog and original grants. See backend docs/PAYPAL_LIVE_RELEASE.md (operator notes e78af50) for the corresponding older-API rollback prerequisites.
