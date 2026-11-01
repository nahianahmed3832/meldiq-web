# Security and performance verification

Local implementation review, 2 November 2026. This is an engineering report, not a claim of a production penetration test.

| Control | Implementation / evidence |
|---|---|
| Authentication | Existing bearer/device middleware on every catalog, inventory, claim, favorite and equip route. Public asset reads are limited to assets referenced by active available catalog entries. |
| Private data | Inventory and acquisitions are owner-only. Public profile stores contain only a render descriptor. Realtime notices contain a user ID, followed by an authorized profile fetch. |
| Ownership | Server checks each selected item inside the same atomic write that commits the profile; mixed invalid requests roll back. Unique inventory/transaction keys enforce one acquisition per item per user. |
| Concurrency | Required styleRevision rejects stale devices; legacy profile writes also read their baseline inside the atomic write. Administrative updates refresh equipped recipes. |
| Payment | Clients cannot supply recipes or prices to equip. The free claim route refuses premium/event/purchase items. Explicit promotional grants are audited. No cosmetic payment success is fabricated. |
| Administration | Existing console host, network, Origin, custom header and session gate plus the new super-admin-only collectibles.manage permission and an explicit super_admin role check. Denied role checks and successful catalog/grant/asset changes are audited. Existing creator review permissions are preserved. |
| Asset injection | No arbitrary asset URLs, HTML, scripts, CSS strings or font URLs in recipes. Fixed colors, enums and hash IDs only. SVG uses a closed XML vocabulary; Lottie uses a bounded shape-only renderer. No external resources or executable expressions are accepted. |
| Raster validation | Byte sniffing, actual Sharp decoding, 6 MiB input ceiling, 32–2048 px sides, 120-frame ceiling, 8-million decoded pixel budget, and one processing job. Re-encoded derivatives omit source metadata. Approved originals remain available under a fixed MIME type and nosniff/CSP headers. |
| Signed uploads | Server-generated staging IDs; signed exact byte count/hash; actor-bound expiry; full completion byte/hash verification before decode. No client-chosen key or external fetch. |
| Caching | Private state is no-store. Public content-hash assets have ETags, 304 support and a bounded one-day cache. Live S3 validation passed; final Cloudflare delivery evidence is recorded in DEPLOYMENT.md. Content IDs never change bytes. |
| Performance | Small original procedural recipes; category pagination (maximum 48); static catalog thumbnail variants; on-demand equipped assets; static Android posters; existing motion preferences and bounded banner effects. No animation engine was added to lists. |
| Asset retention | Existing orphan cleanup retains registered original/variant hashes and live staging references; two dedicated regression cases passed. Static JPEG orientation is normalized and covered by the collection integration suite. |
| Migration | Additive tables/indexes, generated MongoDB schema and unique keys; preserved existing profiles covered by tests. The feature follows the existing database authority configuration; deployment records the final domain state. |

The focused backend regression run passed 51 tests across five suites, including SQLite/MongoDB collection behavior, existing profile media/decorations, realtime profile notices and generated schema agreement. Test logs and remaining checks are summarized in TEST-RESULTS.md.

Operational limits: the catalog uses the existing Rows mirror rather than a new large-scale database query service; bulk recipe refresh scans styled users on administrator changes. Availability is reconciled at startup and within approximately one sweep interval. Asset cache invalidation may take the documented TTL after takedown; client references are cleared immediately. Expired signed stages are cleaned in bounded batches on upload creation and by the one-minute availability sweep. A compromised super-admin session can grant cosmetics, but cannot create verified account badges through the collectible badge slot.

Physical Android device GPU/memory/battery measurements and any eventual collectible payment/refund lifecycle remain separate checks. Live S3 signature, checksum, no-overwrite, private-object, CORS and optimized-variant tests passed using an isolated synthetic prefix. Original procedural shapes are deliberately available without downloading an entire asset library.

Vector implementation reference: [Lottie property and easing specification](https://lottie.github.io/lottie-spec/latest/specs/properties/). Supported animations are limited to five seconds, 20 rendered frames per second, 8 million decoded pixels and self-contained 2D shapes. Unsupported constructs fail closed. Original source files download as attachments; clients receive raster derivatives.
