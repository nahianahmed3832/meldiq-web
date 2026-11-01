# Meldiq profile customization deliverables

Implementation and authorized release preparation: 1–2 November 2026. Live rollout evidence is recorded in DEPLOYMENT.md.

| Deliverable | Location |
|---|---|
| Public Yapin feature investigation, with verification limits | [RESEARCH.md](RESEARCH.md) |
| Architecture, categories, MongoDB migration and synchronization | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Original 24-design inventory | [ASSET-INVENTORY.csv](ASSET-INVENTORY.csv) |
| API and administrator operations | [API.md](API.md) |
| Security and performance review | [SECURITY.md](SECURITY.md) |
| Test evidence and outstanding checks | [TEST-RESULTS.md](TEST-RESULTS.md) |
| Deployment sequence and remaining dependencies | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Desktop and phone implementation screenshots | [Desktop](screenshots/desktop.png), [Phone](screenshots/phone.png) |

Web additions live in `src/ui/settings/CollectionStudio.tsx`, `src/ui/people/CollectibleLayers.tsx`, `src/sync/collectibles.ts` and the existing profile/avatar components. The studio is gated by the backend's `profile-collectibles` feature.

Backend implementation is in `/Volumes/code_files/meldiq_android/.claude/worktrees/profile-customization-system/server`, branch `codex/profile-customization-system` at `70eb0272`, integrating deployed authentication and the verified Atlas/Redis cutover through `207c3958`. The web repository includes the reviewable `server-patches/0010-profile-collectibles.patch`. Keep the existing server's newer releases and concurrent work when integrating it.

Android additions live in the existing `/Volumes/code_files/meldiq_android/android` application: `Collectibles.kt`, `CollectibleViews.kt`, `CollectibleSection.kt`, profile repository/model extensions and the existing public profile card/avatar/banner components. The admin console additions are in `/Volumes/code_files/meldiq_central_admin/src/console/pages/CollectibleManager.tsx`, wired into its existing Decorations page.

The launch includes 24 original designs, free claims, private inventory, favorites, revisioned equip, audited administrative grants, safe SVG and bounded shape-only Lottie uploads, and generated raster fallbacks. Cash/Embers checkout and automatic subscription-linked unlock/revocation remain unavailable until a verified collectible payment lifecycle exists. Native Windows/macOS applications and physical Android performance measurements are outside the available repositories and verification environment.
