# Meldiq Plus implementation and release status

Prepared on 2 November 2026, Asia/Shanghai. **Code is pushed and production artifacts are staged; Plus code/schema activation is awaiting the Atlas schema-permission step. New paid offers and marketing campaigns remain disabled.** The user authorized production and GitHub publication. Real PayPal buyer approval, capture and signed webhook delivery remain separate gates before enabling paid offers.

## 1. Files and integration location

[FILES.md](FILES.md) lists the files with task contributions; [files.json](files.json) provides absolute paths and content hashes. The API/Android source is `708353fe` on `codex/plus-monetization-20261102`, integrated with production media `b34d3ee8` and read receipts `0f77a9d8`. The isolated web release includes current main's call photos, RTT, seen receipts and compact sidebar; its production application build is `ef16f73`, checked in [GitHub CI run 41464626470](https://github.com/nahianahmed3832/meldiq-web/actions/runs/41464626470). The Node 22 build artifact, not the dirty shared checkout, is packaged for deployment. The administration console is `361ea0f` in the user's private `meldiq-central-admin` repository. All new commits use MD.NAHIAN AHMED's verified GitHub noreply identity.

## 2. Branding and compatibility names

Updated application plan names, checkout headings, settings, badges, benefit copy and administrative labels use Meldiq Plus. Human-facing Free branding uses Meldiq Free. Android English, Bengali and Chinese subscription resources were updated. Existing lowercase `mojo` routes, product IDs, schema/type identifiers, historical documents and legacy provider references remain compatibility identifiers. A newer concurrent social error fixture is preserved separately under `test/forward-contract-fixtures`, so it remains tested without claiming that the pinned server emits an unused error code. They were not renamed or erased. Historical receipts keep their actual transaction amounts. Existing remote PayPal resources were not renamed or mutated; review their historical branding separately as part of the operator transition.

## 3. Go and other products

Go is unavailable for new checkout, gift and native-store purchases. Existing Go entitlement and store-management mappings remain so old subscriptions can still be reconciled and managed. Following the user's scope correction, Bots+, Sparks, organization plans and other unrelated products retain their existing runtime behavior and prices. Automated browser tests exercise separate Spark and Bots+ checkout at their existing prices.

## 4. Final pricing and checkout

The authoritative server catalog is `server/src/modules/billing/pricing.ts`, version `2026-11-02.plus-terms-v3`.

| Plus choice | Full charge | Automatic renewal | Savings against repeated $4.99 months | Approximate monthly equivalent |
|---|---:|---|---:|---:|
| Monthly | $4.99 USD | Every month | — | $4.99 |
| 3 months | $12.99 USD | Every 3 months | $1.98 / 13.23% | $4.33 |
| 12 months | $49.99 USD | Every year | $9.89 / 16.52% | $4.17 |

Meldiq Free remains $0. The main page presents Free and Meldiq Plus; the interval choice is in checkout. Equivalent monthly figures explain the discount and are not installment amounts. The full charge and renewal cadence are shown before consent. Support copy explains that payment helps cover servers, storage, bandwidth and development, without inventing a budget allocation or funding guarantee. Gifts use the approved term totals as one-time payments and never start a recurring subscription.

PayPal plan IDs are selected from the approved server-owned term. Remote amount, currency, cadence, quantity, tax/setup fee and configured product ID are verified before new subscription creation. Frontend amount injection is rejected. Restored owned quotes retain their original price and require renewed review when that differs from the displayed current offer. The browser's approval callback never grants benefits.

The native app offers the same terms at checkout through Google Play's actual localized prices, validates the expected billing period and USD total, and uses native Play billing. It does not redirect store users to PayPal. Store products/base plans still require operator configuration and physical-device/store verification.

## 5. PayPal resources

Only Sandbox resources were prepared:

| Resource | ID | Verified state |
|---|---|---|
| Product | `PROD-2S4746620H719100X` | Meldiq Plus |
| Monthly plan | `P-3TE66117X4961564JNLUGRCQ` | $4.99, MONTH × 1 |
| 3-month plan | `P-5UD87361W9855621PNLUH6NQ` | $12.99, MONTH × 3 |
| Yearly plan | `P-5CJ91328EC246033YNLUH6SA` | $49.99, YEAR × 1 |

These resources are not published to an application catalog. No live PayPal resource or customer charge was changed. See the sanitized `sandbox-*.json` evidence and [DEPLOYMENT.md](DEPLOYMENT.md). The new preparation tool defaults to a dry run, creates distinct resources, and does not call the plan-price-update API. Live preparation requires a separately reviewed compatibility approval reference. Private credentials remain backend-only.

## 6. New and existing subscribers

New purchases require a published immutable version matching one of the three approved terms. Publishing a cadence retires only the previous offer for that cadence, so monthly, quarterly and yearly can coexist. Existing subscribers retain their original version, amount, provider references, dates and history. Historical PayPal plan IDs are verified against their stored agreement amounts, including 399-cent legacy Plus agreements. No old agreement is silently moved to 499 cents. Existing card mandates keep their original values; new mandate periods use the selected term. Google Play reconciliation retains the version for an unchanged existing product.

`GET /admin/v1/billing/pricing-migration` provides a read-only aggregate inventory. It was not run against production customer records. The public pre-change snapshot showed the old 399-cent offer; it is not an account-level migration inventory.

## 7. Promotion algorithm and renewal reminders

Campaigns and popups default off until an operator deliberately enables them. Eligibility requires verified, onboarded Free accounts, at least three days of account age and three meaningful sessions across at least two days. A meaningful session requires at least sixty active seconds. Administrators/test accounts, active Plus subscribers and pending purchases are excluded. The algorithm ranks eligible campaign triggers; optional experiments use deterministic account hashing. It does not show a popup on every visit.

Across devices and campaigns, limits are one popup and three total impressions per rolling thirty days, at most one per session, at least seven days apart, fourteen days after dismissal and thirty days after snooze. User opt-out is persisted across devices. The Notifications control reads that shared preference; a legacy local opt-out is migrated once and does not repeatedly overwrite a later choice from another device. Reservations count before rendering, preventing competing devices from consuming the same allowance. A real MongoDB test verifies stale-mirror concurrency and persistence after restart. Claims and preferences use the existing billing Rows transaction architecture.

Web and Android restrict presentation to a settled Home screen. Calls, screen sharing, composition/recording, transfers, dialogs, errors, checkout and onboarding suppress it. An unavailable eligibility service suppresses presentation. Active notices refresh every five seconds and expire after ten seconds without refresh; a kill switch takes effect on the next check or expiry. Header padding reserves space for the close button, including its focus outline; desktop and phone geometry assertions verify that the copy cannot run underneath it. The reference's warm gradient header, dark body, clear close/Not now controls and orange CTA are used with Meldiq's own catalog benefits. The reference app's 100 MB or other unrelated entitlements were not copied. Browser previews: [desktop](popup-browser-desktop.png), [phone](popup-browser-phone.png).

A separate transactional reminder is reserved once per agreement/end date during the final 72 hours of Plus access. Auto-renewing agreements show the existing charge/cadence and Manage billing, with explicit wording that another purchase is unnecessary. Canceled agreements and ending grants show expiry wording. Exact Google Play charges are deferred to the store. This billing information is separate from marketing opt-out. Existing renewal email uses its durable outbox and period deduplication.

## 8. Admin changes

Billing administrators can configure campaigns, content, presentation, schedule, targeting, usage requirements, cooldowns and experiments; preview the design; inspect guardrail metrics; and disable campaigns/popups globally. Changes reuse existing billing permissions, fresh passkey verification, revision checks, rate limits and hash-chained audit records. Campaign configuration cannot alter subscription prices. The plan editor understands billing frequency and retains separate draft/published history.

Metrics cover reservations, confirmed impressions, dismissals, snoozes, opt-outs, complaints, clicks, checkout starts, attributed conversions/cancellations/refunds and experiment variants. Pricing visits are coarse reports associated with a promotion CTA navigation, rather than a complete page-view analytics system. Abandonment is a coarse checkout-start-minus-conversion count, not a complete individual funnel or causal study. Trusted geography is not currently supplied, so region-restricted campaigns fail closed.

## 9. Database and preserved features

Existing production migration 092 retains attachment publication. Migration 093 adds promotion settings/state/events and indexes. Migration 094 adds billing frequency (historical default one) and freezes it after publication. MongoDB schema version is ten; missing historical frequency metadata is backfilled before validator tightening. Existing financial amounts and provider references are untouched. Production application of schema 10 is pending the narrowly scoped migration-permission step.

Profile customization remains free. The newer production media release's 1,000,000,000-byte upload ceiling, encrypted publication, thumbnails, retries and S3 behavior are retained. Downloads use the existing communication-busy hold solely to suppress promotions. No new media storage or conversion service was added.

The sidebar overlap reported in the second screenshot is fixed by isolating avatar-decoration layers below unread badges and preventing rail tiles from shrinking. Browser verification confirms badge visibility over an actual flame decoration; see [the fixed rail](rail-badges-fixed.png). The phone layout intentionally hides this desktop DM rail and uses its own message list.

## 10. Validation

Validation results are recorded in [validation.json](validation.json). The integrated web suite passes 906 tests with one skip. Full web lint, formatting, typecheck and the production build pass on GitHub Actions Node 22. The release checkout passes 67 desktop/phone regressions with one intentional phone-rail skip, plus ten focused pricing/interval/consent checks. These cover existing PayPal and card flows, eligibility and recovery, saved-card recurring consent, gifts and gift credit, pending purchase restoration, and unchanged Spark/Bots+ flows. All 33 administration tests and its production build pass. Earlier Android verification passed all 767 JVM tests and lint; no Play Store release or physical-device purchase is claimed.

The first integrated backend run recorded 2,003 passes, nine failures and 21 skips. Eight failures came from invalid legacy attachment fixtures (including subsequent shared-state assertions); the fixtures now use real completed encrypted uploads, and all 29 permission checks pass. One architecture test identified a new cross-module import; message publication now uses the files module's public API. The second frozen full run includes those fixes and the production read-marker changes: 2,011 passed, one failed and 21 skipped. The remaining assertion incorrectly treated the answer “solve” as leaked because it appears inside the fixed label “solved”. Its no-disclosure assertion now checks whole words; the complete 23-test games suite passes. Application code was unchanged by that correction. The raw full-run result and corrective rerun are both retained in the validation record.

Fresh encrypted production backup `20261102T144951Z` was verified and actually restored off-host: 272 collections and 689,825 records. Candidate and fallback schema-10 migrations preserve all restored collection counts and account hashes, with all 16 database authorities and required indexes/validators verified. Linux Node 22 candidate/fallback images pass runtime schema checks. No restored customer data, keys, environment values or private account/financial comparison maps are committed.

## 11. Security verification

Automated checks cover authentication and resource ownership, rejection of frontend price injection, approved remote cadence, invalid provider verification responses, idempotent checkout and event handling, historical 399-cent agreement verification, no entitlement from browser callbacks, campaign permission/revision checks, pricing-injection rejection, cross-device caps and MongoDB reservation races. Existing gift/order capture/refund ownership and audit paths are reused. Card details and PayPal secrets are not collected by the browser or shipped to Android. Real PayPal signed webhook delivery remains unverified; REST test doubles do not establish real provider delivery correctness.

## 12. Actual Sandbox coverage

The three remote plans were created and read back. An unpaid approval-pending monthly subscription and an uncaptured 499-cent one-month gift order were created. The pending subscription could not be canceled before approval. No buyer approval, capture, paid activation, real renewal, refund, gift redemption or real signed webhook delivery was performed. The available private Sandbox configuration has no webhook ID. Completion of that matrix requires the corresponding dashboard configuration and a test buyer flow.

## 13. Deployment and rollback

Follow [DEPLOYMENT.md](DEPLOYMENT.md) and the guarded scripts in `deploy/monetization`. Production predecessor is the verified call-fix release on top of media 0.76.1. Artifacts are checksum-locked; cutover preserves environment values, ports, mounts, memory limits, all database authorities, ingress, current media behavior and call fixes. Account and financial digests are compared privately under the maintenance gate. New Plus offers must remain absent from the purchasable catalog and campaigns must remain off.

The runtime database account currently has `readWrite` and cannot run `collMod`; the billing-frequency validator update requires a schema migration credential or a temporary, explicitly approved migration grant. Restore the runtime's original permissions immediately after migration and verify a fresh connection has no `collMod`.

The staged schema-10 fallback is valid only before new 499/1299/4999-cent paid terms are published. It never downgrades the database, restores a stale customer snapshot, or drops financial history. After enabling new paid terms, use a rollback that understands all accepted historical and new cadences.

## 14. Outstanding external work

Code/schema publication is waiting for the database migration permission step and final guarded cutover verification. Before paid Plus offers can be enabled: complete real Sandbox buyer/capture/signed-webhook and lifecycle tests, prepare distinct verified live term IDs, and publish new immutable terms through the operator process. Existing subscribers keep their actual agreements and charges. Marketing campaigns stay off until billing readiness is verified. Play Console base plans, physical-device verification and store publication are separate external work.
