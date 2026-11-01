# Meldiq profile collection architecture

Implementation and authorized release preparation: 1–2 November 2026. Live deployment evidence is recorded in DEPLOYMENT.md.

## Source locations and baseline

- Web: `/Volumes/code_files/meldiq_web`, existing Next.js static-export React app. No Next API server or separate site was introduced. The installed Next.js static-export guide was read before implementation.
- Backend: `/Volumes/code_files/meldiq_android/.claude/worktrees/profile-customization-system/server`, branch `codex/profile-customization-system`, integrated with production API 0.74.0 authentication source `8078f2bede40` and the verified Atlas/Redis cutover branch through `207c3958`. This is intentionally isolated from the Android repository's older, dirty server folder and concurrent work.
- Android: `/Volumes/code_files/meldiq_android/android`, additions to the existing profile repository, profile style screen, shared avatar/banner views and public profile card.
- Admin: `/Volumes/code_files/meldiq_central_admin`, expandable collectible management in the existing Decorations page. This directory was already an application rather than a clean Git checkout.

## Data flow and consistency

`Catalog → try-on draft → private inventory claim/grant → revisioned equip → users.profile_style → user.updated → existing client profile refresh`

The existing `users.profile_style` field remains the only equipped state. Its new optional `collectibles` array contains at most eight server-generated render descriptors: stable ID, name, category, version and a validated primitive recipe. It never contains inventory, purchase references or arbitrary remote URLs. Existing decoration, effect, theme and name fields are populated as fallbacks for older clients. Existing style edits clear overlapping collectible descriptors and preserve other slots; both old and new writes read the latest profile inside the atomic Rows write. No device-local ownership store or second equipped database was added.

The existing `styleRevision` SHA-256 revision includes collectible recipes. New clients must send it to equip. A stale device gets HTTP 409; mixed invalid slot changes commit nothing. Inventory grants, their unique acquisition transaction, and ownership checks use the existing atomic Rows abstraction. In MongoDB mode it stages and commits a MongoDB transaction and follows change streams into the existing synchronous read model. There is no new Redis cache to invalidate; the existing profile event refresh path is reused. Metadata is read from the current Rows mirror for each catalog request. Admin edits refresh equipped public recipes and emit existing profile events. Inactive or seasonally unavailable items are cleared by a startup/one-minute availability sweep; ownership history stays intact.

## Eight category registry

| Slot | Function | Older client fallback |
|---|---|---|
| avatar-frame | Classic rings or approved transparent raster artwork | Existing decoration field |
| avatar-effect | Static ambient two-color avatar aura | Undecorated avatar |
| background | Card background artwork/gradient | Existing card surface |
| banner | Procedural or raster banner layer, original custom-upload flow remains available | Existing uploaded banner/gradient |
| profile-theme | Card accent/border/glow and two-color theme | Existing themeColors/accent |
| name-effect | Gradient name and glow/shimmer | Existing nameColors/nameEffect |
| badge | Labeled collectible emblem | Existing achievements/identity badges |
| particles | Existing bounded banner sparkles/stars/bubbles | Existing effect field |

These slots are independent of earned Bug Hunter, Artist, Creator, plan badges, profile pins and community tags. Collectible badges do not confer verified identity or permissions. New category behavior is added through the typed category registry, recipe renderer and slot application function; it does not require another inventory or payment implementation.

## Additive migration 086

The five new tables are assigned to the existing identity domain and become MongoDB collections when identity is configured in `MONGODB_DOMAINS`. The generated schema creates MongoDB validators and indexes through the existing catalog. Development/test SQLite remains supported.

- `profile_collectible_catalog`: stable primary ID, validated metadata JSON, updated timestamp. Builtin recipes are merged with persisted administrator overrides; unchanged builtins require no seed writes.
- `profile_collectible_inventory`: composite unique `(user_id, decoration_id)`, acquired timestamp, acquisition source, favorite flag; index `(user_id, acquired_at)`.
- `profile_collectible_transactions`: unique transaction ID and unique `(user_id, decoration_id)`, claim/grant type, actual charged amount (zero for a free claim/promotional grant), currency, nullable verified payment reference, timestamp; index `(user_id, created_at)`. This is acquisition history, not an invented payment processor.
- `profile_collectible_assets`: content hash ID, metadata/variant blob references and creation timestamp. No file bytes enter MongoDB.
- `profile_collectible_uploads`: staged signed upload ID, administrator account ID, exact byte count, SHA-256, expiry; expiry index.

User foreign keys cascade through existing Rows deletion semantics. Migration 086 creates tables/indexes only and never rewrites existing profile records. Do not run an older application over the new schema without checking the existing backup/version rules.

## Assets, performance and accessibility

24 original procedural designs are bundled as typed recipe data, three per category. No Yapin artwork, font, animation or source was reused. Catalog tiles use static CSS/Canvas shapes or thumbnail variants; profile images load on demand. Android uses static thumbnail variants for avatar frames in lists and poster variants for larger artwork, including unsupported animations. Web backgrounds and banners may animate when motion is enabled; reduced motion uses their static poster. Existing bounded frame/effect/name implementations provide motion where supported. Catalog grids do not start animated assets. Web profile layers respect the existing reduced-motion preference and OS setting. Aura artwork is static. Existing name/particle motion controls continue to apply.

The asset processor accepts byte-identified PNG, JPEG, WebP and GIF; decodes with Sharp, checks size/dimensions/frame count/decoded pixel budget, strips metadata in generated variants, preserves approved originals and emits WebP full/poster/thumbnail plus a static AVIF. Processing concurrency is capped at one with an 8-million decoded pixel budget. Runtime Sharp is an explicit production dependency. Generated raster variants normalize static-image orientation before stripping metadata. The existing orphan collector recognizes registered asset variants and live signed stages, so maintenance does not delete approved originals or fallbacks. SVG is parsed and rebuilt from a closed XML vocabulary; active content, external references and unsafe attributes are rejected. A bounded 2D shape-only Lottie subset is rasterized server-side to animated WebP and a static poster. Images, text, expressions, masks, effects, parenting, 3D and spatial path tangents are rejected. Neither source format executes on clients. Original Blue Horizon SVG artwork is bundled under server/assets/collectibles and can be seeded once without replacing operator overrides or existing ownership.

At present catalog filtering/pagination operates against the existing in-memory Rows read model (bounded page size, filter-specific ID cursor; ownership/favorites/recent filtering occurs before pagination). Very large catalogs or mass admin changes should use a dedicated paged read store/background update job before expansion. No additional service was introduced for a 24-item launch catalog.

## Verification

See TEST-RESULTS.md for release checks and DEPLOYMENT.md for the live source, image and database receipt. The client contract is pinned in test/contract-source.txt so an unrelated neighboring backend branch cannot silently change the expected fixture snapshot.
