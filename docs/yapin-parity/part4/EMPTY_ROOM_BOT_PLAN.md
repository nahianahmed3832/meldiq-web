# Empty-channel bot admission work

Owner: Part 4. Active implementation claim after the broader-platform owner decision. This is not a deferral or acceptance receipt.

Add opt-in `waitForMember: true` to bot voice admission. An empty authorized channel returns a bounded pending lease with `callId: null` and `media: null`. The existing default keeps its current conflict response when no native room exists. A bot has one live/pending lease and the existing global limit and one-minute heartbeat rules remain.

The first person opens the room through the existing native call path and creates its media key as today. Pending authorized requests appear through the existing call-key request field. A real connected human device seals the key with the existing bot/call/channel/lease/manifest HPKE context. Only then does a formerly empty-channel admission receive its media grant. No server-held room key, impersonated human device, automatic human voice join, new media provider or expanded permission is introduced.

Activation must serialize pending reservations, recheck current installation/token/native channel authority after asynchronous work, and remember removal metadata before issuing a media token. Pending leases without a token need no durable SFU-removal record. Expiry, revocation, stop and room end must remove pending/admitted state correctly. Default existing-room behavior and human call contracts stay compatible. An old human client that cannot share bot keys does not grant the bot media access.

Qualify HTTP/schema/SDK behavior, pending-to-connected encrypted media, idempotent retry, expiry/revocation, archived/private/nonvoice channels, capacity/concurrent activation, failed ledger writes and shutdown races. Refresh contracts and coordinated SDK/client snapshots after the API source is committed. Native and physical boundaries remain explicit. The waiting mode permits a bot to request an empty channel; a connected member supplies the first encrypted room key.
