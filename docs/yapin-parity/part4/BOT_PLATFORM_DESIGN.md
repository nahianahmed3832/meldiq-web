# Broader bot platform implementation

Owner explicitly included the broader platform after reviewing 99 documented rows: 10 native equivalents and 89 expansion rows. They are not deferred. Six product deferrals (recording/clips/report buffers, soundboards, activities, hosted execution, new promotion, settlement) remain in force.

## Authority

A bot token stays restricted to the bot namespace and cannot authenticate a human session or the user WebSocket. Advanced community operations require a developer manifest, an explicit community installation approval, current installation membership, and all existing native role/channel/hierarchy checks. New manifest permissions do not enlarge saved approvals. Managers cannot approve powers they lack; no blanket administrator bit is added. Device/account/ownership/billing/platform-admin endpoints are excluded from controller adapters.

Fastify adapters clone only allowlisted controllers in their original encapsulation, preserving their hooks, schemas and handlers. They replace only the marked person-session authentication hook with bot authentication and an internal actor identity scoped to that bot route. No HTTP proxy, human token or extra request is added. Native rules remain authoritative, including distinct create/manage/assign permissions. Test every adapter unauthenticated, both approval and native-role requirements, cross-community/private-channel isolation, removal, revocation and token rotation.

## Next slices

1. Complete and test controller adapters, manifests/approval and shared developer/community review UI. Own-profile updates retain current validated image infrastructure and entitlements.
2. Add native message history/reactions/pins/bulk moderation, versioned bot API documentation and safe rich interactions using existing domain schemas.
3. General durable events: bounded cursor replay, expiry, duplicate handling and current authorization at delivery. Never copy private message content/credentials into an unrestricted log. Prefer an atomic outbox within existing authoritative writes; measure ordinary-send overhead and preserve the current single-writer Frankfurt model.
4. Dedicated bot gateway: identify/resume, heartbeat/ack, stable event sequences, frame bounds, backpressure, fresh token/scope checks and prompt disconnect on rotation/removal. Do not modify the user WebSocket protocol.
5. Bot DMs need explicit recipient consent, current block checks and revocation; bot presence/voice must preserve capture/participant consent and encryption verification. No recording or hosted activity is implied.
6. Add runnable first-party JS/Python examples and real isolated integration tests; preserve old native clients with additive payloads and capability discovery. Refresh Web/Windows contract/source snapshots and all 568 row dispositions.

## Current source

API has additive SQLite migration105 / PostgreSQL026 for requested and installation permissions, the BotPermissions service, controller adapter allowlist/registrar and a PostgreSQL policy/authority test. API typecheck and the old 11-case bot suite pass. The five-case new suite is being corrected to grant the native channels.create permission in its positive fixture; four cases already passed. No production schema or service changed.
