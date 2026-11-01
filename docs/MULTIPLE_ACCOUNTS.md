# Multiple saved accounts

Meldiq Web keeps each added account in its own IndexedDB database. The original `orbit-web` database is adopted in place, preserving the existing device keys, encrypted token vault and encrypted snapshot. A separate `meldiq-accounts` directory contains account names, user IDs and database pointers; it contains no access tokens, refresh tokens or private keys.

The bottom profile menu lists saved accounts and offers **Add account**. Choosing an account preserves both sessions, stops the previous connection and opens a fresh page for the selected account. The fresh page prevents authenticated media caches, overlays and old callbacks from crossing account boundaries. Account switching waits for any rotating token refresh to finish saving. Calls, pending messages and running uploads must finish before switching.

Adding an account uses the existing sign-in, MFA and encryption setup flows. Canceling an unfinished addition returns to the previous saved account. An expired account can ask for reauthentication independently of the other accounts. Logging out or deleting an account removes only that account's device and local database; another saved account remains available. Notifications carry their originating account's database pointer so opening them can select the appropriate saved account.

## Validation

`test/saved-accounts.test.ts` covers migration, isolated encrypted vaults, canceling an addition, removal, duplicate identities, expired sessions, pending sends and interrupted token rotation. `e2e/multiple-accounts.spec.ts` creates two real email accounts against the local API and checks switching, reloads, private conversations, cancellation and logout of one account. The release browser checks use the production build with test pairing disabled.

## Release provenance

The isolated release checkout captures the current application source and its previously deployed local updates. Production's preceding release was `0.5.0-beta-c8294ce3fd70`, whose metadata identifies source commit `9ded695a192b893fe375e09004b286deed950646` plus its deployed working tree. This release records that application baseline and the account-switching work in Git. The subsequent live Embers release `0.5.0-beta-aa42cc2b2541-embers` (API 0.71.3, backend source `858daff8f7346037abf23b476f2633a2dc1114aa`) was reconciled into this release before deployment, preserving its points UI, profile badges and updated contracts. Environment files and unrelated backend/deployment edits are excluded. Deployment replaces only the static web release, preserves the running configuration and retains the previous release for rollback.
