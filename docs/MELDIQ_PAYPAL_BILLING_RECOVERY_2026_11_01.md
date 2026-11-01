# Checkout, free-trial and cancellation recovery — 2026-11-01

The owner reported a missing card option, an apparent trial/subscription without payment information, and a failed cancellation dialog. The owner explicitly confirmed that the free signup Plus trial should remain available without a card.

## Corrections

- Always display separate card and PayPal choices. Show loading, ineligibility or a blocked SDK failure explicitly, with a retry action. Selecting cards never silently switches back to the wallet flow when the card SDK is unavailable.
- Show the free signup trial or granted Plus period separately from payment approval. An unapproved checkout has no paid subscription/renewal and does not get a cancellation button. An approved renewal waiting for its first payment still has cancellation, with no invented paid-through date.
- Refresh the provider's authoritative status through the existing billing sync endpoint. API 0.71.2 distinguishes approval-pending checkout attempts, repairs previously incorrect completion markers during reconciliation, and exposes free-period metadata. It does not alter free grants.
- Cancellation of an unapproved attempt returns an explicit approval-pending result instead of making the invalid PayPal cancellation call. Confirmed cancellation with no paid period keeps free Plus time and uses accurate confirmation text.
- Billing and checkout navigation loads the current app release online, retaining an offline shell fallback. New-release checks also start immediately, rather than waiting for the first five-minute timer.

## Verification

Initial web unit results: 819 passed, 1 skipped, plus one fixture-source mismatch caused by running without the intended backend reference. After syncing the API 0.71.2 fixtures, all 24 contract/cache/update tests passed. Production-layout browser checks and release verification follow below after completion.

The backend's PayPal/standalone-commerce/contract checks passed 33 tests. Other billing regressions passed 81 tests; a stale expectation for monthly Spark sales also failed on unchanged API 0.71.1, was corrected to match the existing one-time Spark behavior, and its 14-test trial suite then passed. Full unrelated server-suite setup timeouts under concurrent build load are not claimed as passing.

An expired saved Plus purchase now closes its payment control and offers a fresh checkout with a new retry key. The API only expires definitively missing, never-paid attempts and isolates provider read failures; it never treats a timeout, authorization error or missing paid mandate as confirmed cancellation.

Browser validation completed: **21 Chromium production-build checks**, **18 focused WebKit/phone production-build checks**, and **3 updated expired-checkout restart checks** in the development app. These cover card eligibility/loading/failure/retry, consent, buyer approval, free periods, cancellation, price/ownership verification, one-time Spark and separate Bots+ flows, cached-release recovery and checkout restart. No real buyer payment was submitted.

## Integrated production release

The final web source preserves the active production release 00bec97477b3 (saved accounts, mobile/settings layout and Embers), then restores the card, checkout and billing fixes above. API 0.72.1 at 3c4d53a2 preserves active message-collections and Embers features. The combined web source passed typechecking, linting, formatting, 845 unit tests (one skipped), and the API passed all 38 targeted PayPal/commerce/contract checks. Live read-only verification found all 18 original free-grant windows unchanged, two unapproved attempts with no billing trial date, and one expired never-paid attempt.

Integration checks also found the newer settings grid overriding checkout’s full-width layout in Safari. The checkout rule now takes precedence over the settings rail, with a browser regression requiring a usable payment-column width. No real buyer payment was submitted during validation.

Final integrated production-build browser suite: **60 passed** across Chromium, WebKit (Safari) and a phone-sized Chromium viewport. This includes the full payment-column width regression, card selection and SDK failure/retry, pending approval versus free signup trial, approved-but-unpaid renewal cancellation, separate Bots+ cancellation, one-time Spark orders, changed amount/interval rejection and expired checkout restart. API 0.72.1 is healthy in production with MongoDB and LiveKit available; the runtime environment checksum and all 18 original free-grant windows were preserved. The public artifact is built again with test-only linking disabled and all source maps excluded.
