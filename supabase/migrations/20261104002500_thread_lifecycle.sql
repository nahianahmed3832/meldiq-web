CREATE TABLE meldiq.message_threads (
  root_id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES meldiq.conversations(id) ON DELETE CASCADE,
  author_id text NOT NULL, root_ts bigint NOT NULL,
  closed bigint NOT NULL DEFAULT 0 CHECK(closed IN (0,1)),
  locked bigint NOT NULL DEFAULT 0 CHECK(locked IN (0,1)),
  delete_requested bigint NOT NULL DEFAULT 0 CHECK(delete_requested IN (0,1)),
  delete_parent bigint NOT NULL DEFAULT 0 CHECK(delete_parent IN (0,1)),
  delete_cursor_ts bigint, delete_cursor_id text,
  deleted_at bigint, deletion_actor text, deletion_device text, deletion_error text, pending_target text,
  deleted_replies bigint NOT NULL DEFAULT 0,
  rev bigint NOT NULL DEFAULT 0, updated_at bigint NOT NULL
);
CREATE INDEX thread_delete_pending ON meldiq.message_threads(delete_requested,deleted_at,deletion_error);
CREATE TABLE meldiq.thread_preferences (
  root_id text NOT NULL REFERENCES meldiq.message_threads(root_id) ON DELETE CASCADE,
  user_id text NOT NULL,
  conversation_id text NOT NULL REFERENCES meldiq.conversations(id) ON DELETE CASCADE,
  following bigint NOT NULL CHECK(following IN (0,1)),updated_at bigint NOT NULL,
  PRIMARY KEY(root_id,user_id)
);
CREATE INDEX thread_preferences_account ON meldiq.thread_preferences(user_id);
ALTER TABLE meldiq.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq.thread_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq.message_threads,meldiq.thread_preferences FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON meldiq.message_threads,meldiq.thread_preferences TO meldiq_api;
CREATE POLICY api_message_threads ON meldiq.message_threads FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE POLICY api_thread_preferences ON meldiq.thread_preferences FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
