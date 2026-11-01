# Profile collection API

All normal routes use existing bearer/device authentication and existing error envelopes. All inventory/customization responses are private/no-store. All mutations are rate limited; new equip is limited to 20 requests/minute. IDs, categories, recipes and colors are allowlisted and schema-validated. HTTP/OpenAPI declarations are under backend `src/shared/contracts/http/areas/collectibles.ts`.

| Method/path | Behavior |
|---|---|
| GET /v2/profile-collectibles/categories | Eight supported slots |
| GET /v2/profile-collectibles?category=&q=&after=&limit= | Active, seasonally available items; stable ID cursor; limit 1–48, default 24 |
| GET /v2/profile-collectibles/:id | Metadata and acquisition requirements |
| GET /v2/users/me/profile-collectibles | Only caller's owned items, favorites, source and acquisition timestamps |
| POST /v2/users/me/profile-collectibles/:id/claim | Idempotent free acquisition; refuses every non-free acquisition method |
| PUT /v2/users/me/profile-collectibles/:id/favorite | Favorite an owned item |
| DELETE /v2/users/me/profile-collectibles/:id/favorite | Remove favorite |
| GET /v2/users/me/profile-customization | Canonical profileStyle and styleRevision |
| PATCH /v2/users/me/profile-customization | Atomic owned slot changes with required baseStyleRevision |
| GET /v2/profile-collectibles/assets/:id/:variant | Public active-approved asset: full, poster, thumbnail, avif, original; nosniff, ETag, one-day cache and 304 support |

Equip request:

```json
{"baseStyleRevision":"<64 lowercase hex>","slots":{"avatar-frame":"ion-halo","banner":null}}
```

Null removes a slot. Omitted slots are preserved. A wrong category returns 400, unowned selection 403, stale revision or unavailable item 409. No client recipe, user ID, asset URL, price or payment reference is accepted by this strict equip body. Public profiles use the existing GET /v1/users/:id response with optional profileStyle.collectibles; no inventory/transactions are returned there.

Administrator routes below are inside the existing console host/network/Origin/header/session gate and additionally require the `super_admin` role. Existing support-level submission moderation remains unchanged.

| Method/path | Behavior |
|---|---|
| GET /admin/v1/profile-collectibles | Complete catalog, including inactive items |
| PUT /admin/v1/profile-collectibles/:id | Create/update validated metadata; version increments server-side; categories immutable for existing IDs |
| DELETE /admin/v1/profile-collectibles/:id | Soft deactivate, clear equipped slot, retain ownership/history |
| POST /admin/v1/profile-collectibles/:id/grant | Promotional entitlement grant: userId and written reason; not a paid purchase |
| POST /admin/v1/profile-collectibles/assets | Raw application/octet-stream image upload and variant processing |
| GET /admin/v1/profile-collectibles/assets/:id/:variant | Private uncached asset preview |
| POST /admin/v1/profile-collectibles/uploads | Exact size/hash S3 signed staging request |
| POST /admin/v1/profile-collectibles/uploads/:id/complete | Validate actor, expiry, actual size/hash, decode and register variants |

The signed upload flow returns a five-minute PUT request from the existing S3 adapter. Send its signed headers exactly. Completion never accepts an arbitrary bucket/key/URL. Expired tracked staging objects are cleaned in bounded batches when another upload is created. Operators should schedule a sweep if the upload service becomes idle.

No cosmetic charge or automatic paid ownership endpoint exists: the current payment integration provides subscriptions/other products, not a verified collectible SKU lifecycle. Purchase entries can display server pricing and remain locked; verified payment integration and refund/revocation policy are release dependencies before selling cosmetics. Favorite/recent/owned filters are applied to the currently fetched page in this launch UI and are labeled accordingly.

Release additions: catalog filter=all|owned|unowned|favorites|recent operates across the full catalog before pagination; recent uses acquisition order with an ID tie-breaker. Public full.webp, poster.webp and thumbnail.webp aliases retain the original endpoints and make image responses eligible for the existing Cloudflare image cache. All variants remain content-addressed. Admin access additionally requires collectibles.manage, granted only to super_admin.
