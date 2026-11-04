# Compact community rail

Restores the compact, edge-aligned community rail requested in the November 4 screenshots. Home and Activity move above the sidebar list; Messages, unread people, communities/folders, Create and Discover remain in the rail. Removes the floating rail shell, selected-avatar outline and excess button margins, preserves unread badge layering, uses charcoal/red/green navigation in the Meldiq palette, and aligns the account dock with the left navigation. Other palettes retain their colors; phone tabs retain primary navigation.

Built from the actual production source `3cc3c032b973ef9f03b7a2c95593cface27e6f32` plus its deployment receipt commit `1f18c4a`, in `/private/tmp/meldiq-compact-rail-release`. The original working copy contains extensive unrelated work and is not the deployment input.

Browser checks use normal email onboarding against the exact production export and a throwaway local API, with development device linking disabled. Public production smoke checks do not use a customer account. Chromium, WebKit, Firefox, phone, light/dark, RTL, badges and short-window rail scrolling are covered.

`publish.py` uses both shared release locks, verifies the exact live predecessor and every artifact hash, retains previous immutable assets, preserves public configuration and the server-owned OAuth callback, and atomically switches only the static web release. Verification failure restores the predecessor. `rollback.py` provides a guarded manual rollback.
