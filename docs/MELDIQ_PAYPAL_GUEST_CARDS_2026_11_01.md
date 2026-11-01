# Hosted debit and credit card checkout — 2026-11-01

Checkout now offers separate **Debit or credit card** and **PayPal** payment methods for Plus, Bots+ and one-time Spark purchases. The card method is shown only when PayPal's standalone card button is eligible for that buyer. Native radio inputs support keyboard and screen-reader selection.

The card option uses PayPal's official v5 hosted funding button, with `intent=subscription&vault=true` for recurring products and `intent=capture&vault=false` for one-time purchases. Its SDK namespaces are separate from each other and from the existing v6 wallet checkout. v6 currently documents a guest session factory for one-time orders only; no undocumented recurring session options are used. The existing `config.cards=false` flag continues to disable direct card fields; hosted button eligibility is checked independently through PayPal.

Every checkout still comes from the authenticated server endpoint. Prices, account/community ownership, request-key reuse, free Plus time, captures, subscription verification and entitlements remain server-owned. Provider approval callbacks never supply the Meldiq purchase ID. Meldiq never receives card numbers or security codes. Failed card initialization leaves the wallet method available.

## Live capability evidence

- The live merchant SDK reported its standalone card button eligible for subscriptions.
- Using an unapproved, explicitly identified capability subscription with a future billing start, the public web origin opened PayPal's **Pay with card** form.
- Switching off **Save info & create your PayPal account** removed the password/account fields and exposed **Agree & Subscribe**, including consent for automatic payments to Meldiq.
- No payer/card data was entered, no subscription was approved and no charge was made.
- Guest checkout remains subject to PayPal's buyer/transaction eligibility and security checks. A later local-origin browser check rendered the real card control alongside the v6 wallet integration and reached PayPal's card onboarding URL, where PayPal displayed a security check. That check was not bypassed, and it is not evidence of a captured payment.
- A short checkout hint explains the optional account-creation switch to customers.

## Browser validation

The payment suite covers 48 scenarios across Chromium desktop, WebKit and phone-width Chromium, including the existing billing-cancellation test. New scenarios cover consent, eligible/ineligible cards, switching methods, server-owned references, deferred Plus approval, separate Spark/Bots+ transaction flows, cancellation and server-only fulfillment. An initial assertion raced its asynchronous mock request; it now waits for the reference, and the affected scenario passed in all three engines on rerun.

The application build, unit suite and deployment evidence are recorded below after release verification.

## Provider references

- [PayPal v5 buttons, subscriptions and standalone funding eligibility](https://developer.paypal.com/sdk/js/v5/reference/)
- [PayPal v6 subscriptions](https://developer.paypal.com/subscriptions/integrate/v6)
- [PayPal merchant subscription FAQ: guest cards and market availability](https://www.paypal.com/us/cshelp/article/merchant-subscription-faqs-help289)

## Release verification

- TypeScript and ESLint passed. Unit suite: **818 passed, 1 skipped** across 110 files.
- Production export built with browser-test linking disabled.
- Release: `meldiq-web-0.5.0-beta-8d387bc.tar.gz`.
- SHA-256: `c90c33bdbd143b345be81060f1b2c21c82019c1de611859ae03c1bb99d491319`.
- Installed atomically at `/opt/meldiq-web/releases/0.5.0-beta-8d387bc`; previous `0.5.0-beta-1559456` retained for rollback. Existing runtime configuration was copied byte-for-byte. API and nginx configuration were unchanged.
- API remained healthy at **0.71.1**, including MongoDB and LiveKit.
- A separate unapproved $0.99 live order using the existing Orders API request shape opened **Pay with bank or card**, with **No, I don’t want an account now** and **Pay Now**. No card or payer details were entered and the order was not approved/captured.
- The deliberately unowned subscription capability probe's signature-verified CREATED webhook was ignored with an operator audit entry, preventing retries. No customer checkout or entitlement was altered.
- Public smoke check: served checkout chunk matched the local release by SHA-256, including card choices and the guest hint; signed-out checkout stayed protected and the private PayPal config endpoint returned 401. Both the live v6 wallet and namespaced v5 subscription-card eligibility checks succeeded, with no PayPal CSP violations. Public product prices remained unchanged.
