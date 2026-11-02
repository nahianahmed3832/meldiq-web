# Member identities — production release

Published on 2 November 2026 (Asia/Shanghai), under MD.NAHIAN AHMED.

The member list now uses compact 58px rows, readable offline profiles, restrained section headings and aligned names, community tags and owner badges. Automatic nameplate backgrounds were removed. Membership marks use a blue rosette or gold star; artist and bug-hunter marks use consistent vector icons. The six built-in frames have original scalable ornament, with clear photo centres. Presence stays above frames for both photos and animated avatars, including idle and do-not-disturb marks. Existing uploaded decorations and equipped choices are preserved.

Source: `f37240b63a3e0376d6da4600412ecfeaa0de34c4` (visual implementation `598c6016bdab9b422ecc7b1dc02152709d879b17`). Production build: `UpPvbbALV8iUCquO-NtNA`.

The release command explicitly uses Webpack: this Next.js version emits a Turbopack inline bootstrap that is blocked by the deployed Content Security Policy. The previous live release also used Webpack. No CSP relaxation was made. The initial Turbopack export was rejected during browser QA and was never activated.

Validation: type checking; 874 passing unit tests and one intentional skip; two feature browser workflows covering members, responsive panels and decoration selection; eight production-export and eight live Chromium/WebKit smoke cases at desktop, tablet and phone widths; matching origin/public HTML, worker and stylesheet hashes. Feature workflows used disposable local accounts; live smoke checks were signed out and read only.

`publish.py` acquired the shared kernel release lock, verified the expected predecessor and archive hashes, retained runtime configuration and previous hashed assets, and switched the static release atomically with rollback on verification failure. The API container, nginx configuration and backend state were not changed. Public source maps were excluded.

See the adjacent production receipt and browser/HTTP verification JSON for the exact release, previous release, archive checksum and check results. The private source archive remains in the server release-evidence directory.
