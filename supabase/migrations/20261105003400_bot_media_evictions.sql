-- Durable removal work after restart. No tokens, ciphertext or media keys.
-- No identity/call FK: deletion must not erase outstanding SFU removal work.
CREATE TABLE meldiq_private.bot_media_evictions (
  lease_id text PRIMARY KEY CHECK(length(lease_id)<=64),
  bot_id text NOT NULL CHECK(length(bot_id)<=64),
  call_id text NOT NULL CHECK(length(call_id)<=64),
  room_name text NOT NULL CHECK(length(room_name)<=128),
  created_at bigint NOT NULL
);
CREATE INDEX bot_media_eviction_age ON meldiq_private.bot_media_evictions(created_at,lease_id);
ALTER TABLE meldiq_private.bot_media_evictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq_private.bot_media_evictions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq_private.bot_media_evictions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON meldiq_private.bot_media_evictions TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq_private.bot_media_evictions FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
