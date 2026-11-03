-- Cleanup survives parent FK cascades as well as explicit FileStore deletions. The old synchronous
-- cascade callbacks are not a durability boundary. Deferred triggers inspect the final transaction
-- state, so completing an upload or deleting/reinserting metadata never schedules a live object.
CREATE FUNCTION meldiq_private.queue_removed_attachment() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM meldiq.attachments WHERE id = OLD.id) THEN
    INSERT INTO meldiq.pending_blob_deletes(kind, blob_id, attempts, next_at)
    VALUES ('attachments', OLD.id, 0, 0)
    ON CONFLICT(kind, blob_id) DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION meldiq_private.queue_removed_attachment() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION meldiq_private.queue_removed_attachment() TO meldiq_api;

CREATE CONSTRAINT TRIGGER attachment_removed_cleanup
AFTER DELETE ON meldiq.attachments DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION meldiq_private.queue_removed_attachment();

CREATE FUNCTION meldiq_private.queue_removed_upload() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM meldiq.attachments WHERE id = OLD.id)
     AND NOT EXISTS (SELECT 1 FROM meldiq.attachment_uploads WHERE id = OLD.id) THEN
    INSERT INTO meldiq.abandoned_uploads(id, multipart_id, attempts, next_at)
    VALUES (OLD.id, OLD.multipart_id, 0, 0)
    ON CONFLICT(id) DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION meldiq_private.queue_removed_upload() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION meldiq_private.queue_removed_upload() TO meldiq_api;

CREATE CONSTRAINT TRIGGER upload_removed_cleanup
AFTER DELETE ON meldiq.attachment_uploads DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION meldiq_private.queue_removed_upload();

CREATE INDEX attachments_conversation_cleanup ON meldiq.attachments(conversation_id);
CREATE INDEX attachment_uploads_conversation_cleanup ON meldiq.attachment_uploads(conversation_id);
CREATE INDEX abandoned_uploads_due_cleanup ON meldiq.abandoned_uploads(next_at, id);
CREATE INDEX pending_blob_deletes_due_cleanup ON meldiq.pending_blob_deletes(next_at, kind, blob_id);
