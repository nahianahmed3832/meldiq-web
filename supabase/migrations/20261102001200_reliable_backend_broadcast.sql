-- Managed realtime.send catches every SQL exception and returns a warning. A successful call does not prove enqueue.
-- The trusted worker instead inserts and acknowledges in the same transaction, so INSERT errors abort both.
-- No client receives message publishing privileges, and the backend remains subject to RLS.
GRANT INSERT(id,payload,event,topic,private,extension) ON realtime.messages TO meldiq_api;
CREATE POLICY meldiq_outbox_publish ON realtime.messages FOR INSERT TO meldiq_api
WITH CHECK (
  private IS TRUE AND extension='broadcast' AND event='message.changed'
  AND topic ~ '^(user|conversation):[A-Za-z0-9_-]{1,64}$'
  AND jsonb_typeof(payload)='object'
  AND payload ?& ARRAY['eventId','messageId','conversationId']
  AND payload-ARRAY['eventId','messageId','conversationId']='{}'::jsonb
  AND payload->>'eventId'=id::text
  AND EXISTS (
    SELECT 1 FROM meldiq_private.outbox o WHERE o.event_id=messages.id AND o.destination='realtime'
      AND o.topic=messages.topic AND o.event_type=messages.event AND o.payload=messages.payload-'eventId'
      AND o.delivered_at IS NULL AND o.dead_at IS NULL AND o.lease_id IS NOT NULL AND o.lease_until>now()
  )
);
