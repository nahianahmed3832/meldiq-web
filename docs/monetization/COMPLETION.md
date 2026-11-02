# Meldiq Plus implementation and release status

Prepared on 2 November 2026, Asia/Shanghai. **The code candidate is implemented; live billing has not been activated.** Real buyer approval, payment capture, signed webhook delivery, production migration/backup and release approval remain external release gates. The notes below distinguish automated test doubles from actual PayPal Sandbox activity.

## 1. Files and integration location

[FILES.md](FILES.md) lists the files with task contributions; [files.json](files.json) provides absolute paths and content hashes. The API and Android changes are committed through `276788e1` on `codex/plus-monetization-20261102` in `/Volumes/code_files/meldiq_android/.claude/worktrees/plus-monetization-20261102`, based on integrated API `dfb01073`. The main Android checkout contains newer concurrent work, so merge this branch into the current release before packaging. Do not ship an older snapshot over the current application. Web and admin changes are in their existing working directories. Their earlier and concurrent edits were retained.

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

Migration 092 adds promotion settings/state/events and indexes. Migration 093 adds billing frequency (historical default one) and freezes it after publication. MongoDB schema version is nine; missing historical frequency metadata is backfilled before validator tightening. Existing financial amounts and provider references are untouched. Production migrations were not executed.

Profile customization remains free. The 1,024,000,000-byte upload ceiling and current media conversion/S3 behavior are retained. Downloads use the existing communication-busy hold solely to suppress promotions. No new media storage or conversion service was added.

The sidebar overlap reported in the second screenshot is fixed by isolating avatar-decoration layers below unread badges and preventing rail tiles from shrinking. Browser verification confirms badge visibility over an actual flame decoration; see [the fixed rail](rail-badges-fixed.png). The phone layout intentionally hides this desktop DM rail and uses its own message list.

## 10. Validation

Validation results are recorded in [validation.json](validation.json). Completed checks include the full web suite (918 passed, one skipped), web/admin production builds, web/admin/API type checks, focused lint, all 33 admin tests and all 767 Android JVM tests. The latest popup/reminder/preferences/rail browser run passed nine checks with one intentional phone-rail skip. The community navigation test now explicitly marks the lobby seen to exercise a returning member rather than expecting returning navigation for a first-time visitor. Twenty-one initial checkout/browser checks passed across desktop and phone; the attempted phone DM-rail assertion was corrected because that rail is intentionally hidden. A follow-up run passed desktop rail layering and paid-subscriber renewal reminders on desktop and phone, with the phone-only rail case explicitly skipped. Native billing tests additionally cover exact term/product selection and rejection of mismatched price/cadence.

The initial full backend run had 1,967 passes, four test failures and 55 skipped tests, plus three suites with timed-out MongoDB setup hooks. It overlapped contract generation, which caused two contract failures. A fresh rerun of all failed suites plus real MongoDB promotion concurrency passed all 85 tests. Heavy full-catalog capacity tests now allow 180 seconds, and setup hooks allow 90 seconds; assertions were retained. The later full sweep recorded 1,998 passes, seven failures and 21 skips. It overlapped preference/contract edits, so its cached modules did not reflect the completed files. It also hit two full-catalog migration deadlines, a Rows deadline and a forward-compatible error-catalog mismatch. After moving the future error example outside the server golden catalog, retaining all assertions and allowing 180 seconds for full-catalog migration tests, a fresh rerun of every failed file passed all 55 tests. This is not a single all-green full-suite run; run the frozen integrated release again in CI, preferably with one worker and 60-second test/90-second hook budgets. These test-budget changes do not alter production behavior.

Android's earlier unknown `interaction.reply` and JSON Schema union-reader failures were resolved using the existing current-client event shape and support for both `oneOf` and `anyOf`, without adding an allowlist or dropping assertions. The existing signal-routing behavior for that private event is retained.

## 11. Security verification

Automated checks cover authentication and resource ownership, rejection of frontend price injection, approved remote cadence, invalid provider verification responses, idempotent checkout and event handling, historical 399-cent agreement verification, no entitlement from browser callbacks, campaign permission/revision checks, pricing-injection rejection, cross-device caps and MongoDB reservation races. Existing gift/order capture/refund ownership and audit paths are reused. Card details and PayPal secrets are not collected by the browser or shipped to Android. Real PayPal signed webhook delivery remains unverified; REST test doubles do not establish real provider delivery correctness.

## 12. Actual Sandbox coverage

The three remote plans were created and read back. An unpaid approval-pending monthly subscription and an uncaptured 499-cent one-month gift order were created. The pending subscription could not be canceled before approval. No buyer approval, capture, paid activation, real renewal, refund, gift redemption or real signed webhook delivery was performed. The available private Sandbox configuration has no webhook ID. Completion of that matrix requires the corresponding dashboard configuration and a test buyer flow.

## 13. Deployment and rollback

Follow [DEPLOYMENT.md](DEPLOYMENT.md): reconcile the isolated branch with the current release, obtain the production migration inventory, acquire the existing release lock, take and verify an encrypted backup/restore, apply the new schema through the existing migration process, configure distinct reviewed provider IDs, complete Sandbox/store checks, then obtain release approval before publishing each term. Keep unrelated-product configuration intact. Validate prices remotely before accepting payments. Enable campaigns only after billing compatibility is verified.

Rollback begins by disabling campaigns and new offers while keeping existing agreements, verified webhooks and management/history operational. The fallback must understand all historical amounts and cadences. Do not drop financial collections, overwrite transaction history with an older backup or use an adapter that recognizes only 399-cent plans.

## 14. Outstanding external work

Required before production: real Sandbox buyer/capture/webhook and lifecycle testing; Play Console product/base-plan setup and physical-device verification; current-release integration; production inventory and verified backup; production schema execution; reviewed live resource preparation; and release/publication approval. No deployment, live repricing, production migration, store publication or automatic campaign enablement has occurred.
