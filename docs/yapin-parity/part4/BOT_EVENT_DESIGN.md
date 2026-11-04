# Bot event/gateway implementation notes

The owner explicitly chose the broader platform. Do not defer the 89 expansion rows. Six earlier product deferrals and physical-device pending choice remain.

## Planned durable event source

Use an additive, API-private PostgreSQL journal of **IDs and bounded metadata**, produced atomically by triggers on existing authoritative writes. Avoid an additional application/DB network hop on ordinary sends and avoid per-bot fanout writes. Current source is the b9e6f005/cc61eb40 production lineage; held latency ancestors remain excluded.

Capture messages/reactions (message_events), membership insert/delete, invitation create/delete, call_participants join/leave, and bot_interactions creation. Test events are targeted to one bot, idempotent by explicit request ID. General community capture should run only when an installation and its current requested manifest both allow events.read. Command interactions already belong to their bot and do not gain any new authority through the gateway.

**Ordering hazard:** a BIGSERIAL allocated before commit can skip late-committing events. Use an API-private transactional clock row locked/incremented within the same transaction before journaling. The lock lasts through commit, so visible cursor sequence is commit ordered and rolled-back sequences roll back. The existing application is single writer; measure hot-path cost and contention before qualifying release. No new infrastructure or regional topology.

Proposed journal fields: transactional seq (bigint; expose safely as string), unique event ID, kind, optional org_id/conversation_id/actor_id/target_id/source_id/target_bot_id, bounded metadata JSON, created_at and expires_at. Seven-day replay is an operational queue retention proposal, not a change to attachment retention, paid storage or the configured call/audit retention. No credentials, report evidence, deleted message text, media keys or audio/video recordings in journal payloads. RLS, direct-client revocation and explicit API-role grants are mandatory; no SECURITY DEFINER shortcut.

Project each event at delivery using current bot token, requested scopes, installation approval, membership, channel visibility and native role authority. Fetch current message/interaction content only through existing authorized message/domain projections. Private or revoked rows must be filtered **before** page limits/next-cursor selection. Old message bodies are not restored after edits/deletion. A cursor is versioned and bound to the bot; reject malformed/future/expired cursors, stable event IDs permit deduplication. A forged position must never widen scope.

Advanced journal/gateway can initially be advertised only on the authoritative PostgreSQL adapter, preserving legacy bot APIs on SQLite/Mongo rather than claiming durable memory-store replay. Local PG fixtures and the existing staging preparer can verify the actual implementation. Every legacy adapter must give a truthful unsupported capability response if needed.

## Gateway

Dedicated /v2/bot gateway; user /v1/ws remains unchanged. Hello, identify, ready, event, resume, heartbeat/ack and presence are native versioned frames (no vendor URL/frame compatibility promise). Tokens only in the authenticated frame, never URL/logs. Small bounded frames, authentication deadline, bounded output queue/backpressure, capped concurrent sockets/rate limits, serialized processing and prompt close on rotation/removal are required. Recheck authority per event/frame and on heartbeat; no human token/device grant or unapproved plaintext call key.

Use existing shared DB pool and bounded serialized reads, no new PG connections per socket or long-held SQL transaction. Prefer shared transient wake-up signals and bounded polling fallback over one aggressive DB loop per connection. Replay and reconnect must work after process restart. Close sessions during app shutdown.

## Remaining broader slices

- Native history/reactions/pins/bulk moderation, community counts/voice inventory, own bot profile/status and missing API mappings.
- Explicit recipient consent before bot DMs; current blocks/revocation and no unsolicited bot private messages.
- Safe rich buttons/select menus/modal interactions with one-time actor/channel-bound IDs and ephemeral replies; reuse existing validated post/media schemas.
- Optional event webhooks require existing secret encryption, signed timestamped payloads, replay IDs, durable retries and existing SSRF-safe public egress. Hosted code execution remains deferred.
- Shared Developer/community permission review UI and actual first-party JS/Python examples.
- Whole-568-row audit, measurements, staging/restore/rollback, four required final reports; no production authorization request until a concrete passing candidate exists.

## Derived credential closure

A bot with webhooks.manage must not retain a usable posting webhook after its installation/scope or token is revoked. The current controller adapter includes webhook creation/token rotation, so bind these derived credentials before accepting this slice for release. Preserve the native human-created webhook contract. Record an opaque hook ID -> bot ID, approving installation and token revision in a bot-owned private table, and check current bot existence, installation, approved scope and native channel authority on every post/rotation. Do not cascade-delete the binding when a bot is deleted, since that would make a formerly bound webhook appear human-created; keep a denial tombstone until the hook itself is deleted. Avoid echoing webhook tokens in docs/logs. Test uninstall, scope removal, token rotation, bot deletion, concurrent changes and role/channel revocation. Review generic member PATCH adapters so member-removal approval cannot be misrepresented as role-administration approval.


## Current personal-message consent boundary

SQLite108/PG031 and API beddb059 implement recipient-only, revision-checked personal bot approval independently of community installation. No unsolicited DM creation is allowed. A block revokes approval and archives the bot chat; unblocking requires fresh approval. Every renewed consent epoch creates a fresh conversation, so neither old cursors nor history adapters can return earlier revoked conversations. Current manifest, account availability, synthetic-account isolation and native membership apply. A PostgreSQL BEFORE INSERT guard checks consent again at the message commit boundary. Personal events contain IDs only and are filtered before pagination. Person-to-person DMs retain their native route and behavior.

The gateway heartbeat renews its opaque fixed-size cursor without advancing its position. Client checkpoints stay behind completed handlers. Operational journal retention runs even with no connected bots; its seven-day window does not alter call/audit/file retention. JavaScript and Python source clients exercise real local APIs, refuse redirects and keep bot credentials separate from human sessions. They are preview source clients, not published registry packages or hosted execution.
