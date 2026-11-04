CREATE TABLE meldiq.managed_polls (
  message_id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES meldiq.conversations(id) ON DELETE CASCADE,
  sender_id text NOT NULL, definition text NOT NULL, answer_key text,
  fingerprint text NOT NULL, closed_at bigint, rev bigint NOT NULL DEFAULT 1,
  created_at bigint NOT NULL
);
CREATE TABLE meldiq.managed_poll_votes (
  message_id text NOT NULL REFERENCES meldiq.managed_polls(message_id) ON DELETE CASCADE,
  user_id text NOT NULL, choices text NOT NULL, anonymous bigint NOT NULL CHECK(anonymous IN (0,1)),
  PRIMARY KEY(message_id,user_id)
);
CREATE INDEX managed_poll_conversation ON meldiq.managed_polls(conversation_id);
ALTER TABLE meldiq.managed_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq.managed_poll_votes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq.managed_polls,meldiq.managed_poll_votes FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON meldiq.managed_polls,meldiq.managed_poll_votes TO meldiq_api;
CREATE POLICY api_managed_polls ON meldiq.managed_polls FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
CREATE POLICY api_managed_poll_votes ON meldiq.managed_poll_votes FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
