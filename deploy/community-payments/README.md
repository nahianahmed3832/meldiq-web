# Community subscription preparation

The Web catalog in `src/sync/discovery/communityOffers.json` records the reference USD prices. The existing Promote API remains the authority for any displayed purchasable price. Community Supercharge is a separate offer from the existing one-time Spark purchase.

| Offer | Price | Units |
| --- | --- | --- |
| Supercharge | $2.99 per month per unit | 2, 7 and 14 for the three level selections |
| Discovery Boost | $3.99 per week | One community |
| Discovery Super Boost | $7.99 per week | One community |
| Discovery Mega Boost | $12.99 per week | One community |
| Promoted Spot | $29.99 per week | One of four featured spots per week |

Run `node deploy/community-payments/paypal-plans.mjs PROD-...` with the intended Sandbox product ID to generate the five PayPal Create Plan bodies. The command prints JSON locally and requires no credentials. Each plan is configured to be created inactive. Activate a sandbox plan only in the environment being tested. PayPal supports a quantity plan for Supercharge and fixed plans for each weekly offer. See [pricing plans](https://developer.paypal.com/subscriptions/pricing-plan) and [billing cycles](https://developer.paypal.com/platforms/subscriptions/customize/billing-cycles/).

Check an existing Sandbox plan response with `node deploy/community-payments/paypal-plans.mjs PROD-... community-supercharge-monthly plan-receipt.json`. The verifier checks the product, active status, quantity support, regular cadence, price, currency, setup fee and tax. It does not make provider requests.

Before enabling checkout, the API needs an authenticated quote that binds the buyer, community, SKU, unit quantity, currency, interval and quoted amount to a provider agreement. Validate the plan ID and terms against PayPal before creating the agreement. Use a stable request ID per purchase attempt. Grant or extend only the paid entitlement after verification and reconciliation of the provider event. Keep cancellations, failed renewals, and refunds tied to the same agreement. Preserve access through the actual paid-through date on ordinary cancellation.

Promoted spots also require an atomic reservation and an expiry for abandoned checkouts. A weekly renewal needs an available slot for its next service week before charging. Keep the last paid interval independently from any pending renewal. A fixed PayPal plan alone does not implement the reservation or renewal policy.

Exercise concurrent slot claims, duplicate and reordered events, no-capture approvals, late payment, failed renewal, cancellation and refunds in Sandbox before connecting live checkout. The prototype Supercharge button is disabled. Promote uses the existing server availability flag.
