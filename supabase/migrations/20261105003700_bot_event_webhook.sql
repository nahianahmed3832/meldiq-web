-- Opt-in outbound delivery. Only a cursor and retry state are stored; events remain in the private journal.
CREATE TABLE meldiq_private.bot_event_webhooks (
  bot_id text PRIMARY KEY REFERENCES meldiq.bots(id) ON DELETE CASCADE,
  community_id text NOT NULL REFERENCES meldiq.orgs(id) ON DELETE CASCADE,
  endpoint text NOT NULL CHECK(length(endpoint)<=1024),
  generation uuid NOT NULL,
  binding text NOT NULL CHECK(length(binding)=64),
  position bigint NOT NULL CHECK(position>=0),
  active boolean NOT NULL DEFAULT false,
  next_run bigint NOT NULL,
  claim uuid,
  claim_until bigint NOT NULL DEFAULT 0,
  pending_event uuid,
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
  last_result text CHECK(last_result IN ('delivered','exhausted')),
  last_at bigint,
  updated_at bigint NOT NULL
);
CREATE INDEX bot_event_webhooks_due ON meldiq_private.bot_event_webhooks(next_run,bot_id) WHERE active;
ALTER TABLE meldiq_private.bot_event_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE meldiq_private.bot_event_webhooks FORCE ROW LEVEL SECURITY;
REVOKE ALL ON meldiq_private.bot_event_webhooks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON meldiq_private.bot_event_webhooks TO meldiq_api;
CREATE POLICY trusted_backend ON meldiq_private.bot_event_webhooks FOR ALL TO meldiq_api USING(true) WITH CHECK(true);
