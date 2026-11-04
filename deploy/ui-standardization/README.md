# UI standardization production release

This release applies the UI cleanup to the actual live predecessor, source `9ffbab971b7403b70bd66f02a96b14a7cced6257`, in the isolated worktree `/private/tmp/meldiq-ui-standardization-production` on `codex/ui-standardization-production`.

The original working copy contained older versions of some production payment/account files. Tracked changes were merged using the captured pre-refactor baseline. Newer production Gifts navigation, order history, card capability gates, checkout recovery, pending-renewal/free-period behavior, staged sign-in controls, rules-channel safeguards, and the removal of automatic service popups are retained. The deployment does not publish the original working copy directly.

The release export is built from an identical frozen source snapshot at `/private/tmp/meldiq-ui-standardization-artifact`, with test device linking disabled. Its 1,151 build inputs are fingerprinted. The API, database, nginx, provider configuration, and server-owned OAuth callback remain unchanged.

`publish.py` acquires both production release locks, refuses a changed predecessor/API/configuration, verifies archive and file hashes, retains old immutable chunks and locale assets, and atomically switches the web symlink. Verification failure restores the previous release. `rollback.py` provides a guarded manual rollback while retaining chunks needed by already-open tabs.

The release manifest and receipt are added after packaging/publication. Browser payment checks use explicit test doubles; no live charge is executed. Public production browser smoke tests do not sign into a customer account.
