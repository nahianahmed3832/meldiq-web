# Live Plus checkout

The owner authorized live production testing on 2026-11-01. This release adds the branded PayPal checkout to the current production web source, preserving its chat fixes.

Plus costs USD 3.99/month. The checkout displays live payment language and loads the official production PayPal v6 SDK. Existing free Plus time with more than two days remaining postpones the first charge; the review shows zero due today and the server-provided first payment date. Approval alone never creates paid entitlements. Billing includes cancellation and provider-verified purchase history.

Go is closed. Live gifts and Spark purchases remain unavailable. Advanced cards were ineligible in the real SDK probe and are not advertised. PayPal controls eligible funding choices during buyer approval.

Validation: 811 unit tests passed, one skipped; eight browser tests passed across desktop and phone using explicit provider/SDK doubles under production CSP; TypeScript, lint and production build passed. Real live SDK 6.71.0 loaded with subscription and one-time session APIs, PayPal eligible, advanced cards ineligible, and zero CSP violations. These checks do not constitute a paid capture or refund.

API release: 0.69.0, backend branch codex/paypal-live, commit 0bcd0a6. Existing billing/MongoDB records, grants, price validation, signed webhook verification and refund audit are reused. Backend operator setup and deployment notes: docs/PAYPAL_LIVE_RELEASE.md in the backend checkout.

Production: https://web.meldiq.app/settings/mojo and /settings/checkout. Previous web release 0.5.0-beta-dfd65d0 and API 0.68.0 are retained for rollback; private backups reside at /opt/griip-internal-messaging/backups/paypal-live-20261101. No credentials are included in this release. The user must approve their own PayPal payment to complete a real purchase test.
