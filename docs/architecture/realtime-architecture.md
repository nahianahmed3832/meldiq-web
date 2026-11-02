# Realtime architecture

Status: SQL authorization, durable PostgreSQL outbox/repository and web subscription adapter implemented; hosted synthetic Auth/private Broadcast/Presence/reconnect/revocation checks passed. Complete application and fan-out/load acceptance remain pending.

## Event routing

| Category | Durable source | Transport/topic | Client authority |
|---|---|---|---|
| Message/create/edit/delete/reaction/read/pin | message_events | private Broadcast, conversation:<id> | invalidation only; fetch authorized API history |
| Self-only control | message_events | private user:<id> | only verified owner |
| Notification/wakeup | separate outbox destination | push adapter, then FCM/APNs/ntfy | no financial/auth authority |
| Community/channel/member changes | existing normalized records + future same-transaction producer | scoped private invalidations | refetch through Fastify |
| Typing | none | ephemeral:<conversation>, distinct allowed client broadcast | short-lived hint only |
| Presence | none | scoped private Presence | ephemeral, no business authority |
| Calling | existing call records | LiveKit | separate from Supabase Realtime |

## Reliable write and delivery

Existing Fastify validates identity/device, membership, current role, bans/timeouts, history visibility, slowmode, character limit, attachment ownership and message-author rules. PostgreSQL add inserts the immutable event and outbox work in one transaction. Duplicate message IDs insert neither duplicate message nor new jobs. Imported historical messages create no push/realtime storms.

Outbox claims use SKIP LOCKED, a random 30-second lease, retry counters/backoff and per-conversation/destination ordering. A stale worker cannot acknowledge or fail a newer lease. After eight attempts the event is dead-lettered; later events do not overtake it. Operator replay clears failure state without changing event identity. The worker inserts into managed realtime.messages and acknowledges in one transaction. Migration012 permits only the required backend INSERT columns under an RLS policy matching a pending live leased outbox event. It does not use realtime.send: the managed helper catches SQL errors as warnings, which previously allowed an undelivered event to be acknowledged. The publisher uses the persisted row and rejects push-destination claims. Push effects remain at least once and require event-ID deduplication in the delivery adapter. That adapter is not yet connected to the current notification worker.

Broadcast is not a durable client replay log. The web adapter serializes invalidations, checks strict payloads, remembers a bounded event-ID set, and re-fetches durable history after each successful subscribe/reconnect. The sender never treats broadcast payload text or entitlements as trusted data. Use cursor pagination `(server_ts,id)` for recovery.

## Authorization and revocation

Clients use `private: true`. Staging's Allow public access setting is disabled. A public-channel negative test initially still joined successfully after saving; suspending and re-enabling staging Realtime made the restriction effective. The subsequent live probe returned CHANNEL_ERROR, while permitted private joins still passed. Keep this behavioral probe in acceptance; the dashboard switch alone is insufficient evidence. Policies are on managed realtime.messages, without attempting to ALTER its RLS/ownership. auth_links checks account/user ownership and account/device standing through the server. User topics are owner-only and read-only. Fastify grants conversation/ephemeral topics only after its complete Authz checks; grants expire within two minutes. Client writes are limited to permitted ephemeral/presence channels. Clients cannot publish persistent message or notification events.

Supabase caches topic permissions during connections. Removing a grant alone does not instantly evict an already connected client. The combined live probe confirms that a socket keeping its original JWT receives a later invalidation after provider logout, while the API denies access. Short token lifetimes/cooperative rejoin reduce the window but do not prove immediate revocation. Production activation is blocked until delivery-time authorization or reliable eviction is implemented and tested, including membership removal, bans and device revocation. Current broadcasts contain identifiers only and every content fetch rechecks API authorization, but identifiers/timing also require protection. No high-volume table-change publication is enabled.

## Observed hosted smoke

`docs/testing/supabase-hosted-smoke-results.json` records ten successful synthetic checks: signed owner login, raw Data API denial, rejected foreign private topic, rejected public topic, committed private Broadcast receipt, Presence track/sync, reconnect plus durable PostgreSQL recovery, refresh, provider logout and local API revocation. The receipt measured about 1.49 seconds from the operator MacBook; this is not an API or VPS p95 and not a fan-out benchmark. Synthetic users are signed out and banned after tests; their evidence rows remain. No customer accounts are used.

## Measurements still required

Measure events/second, recipients/event, active private channels, reconnect history fetches, p50/p95 delivery and monthly message count. One conversation event should not become one database job for every member. Model fan-out independently of sender request volume. Do not enable broad all-table subscriptions or increase plans before these measurements.

Official sources: [Authorization](https://supabase.com/docs/guides/realtime/authorization), [Broadcast](https://supabase.com/docs/guides/realtime/broadcast), [pricing](https://supabase.com/docs/guides/realtime/pricing).
