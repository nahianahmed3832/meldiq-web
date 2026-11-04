ALTER TABLE meldiq.connections ADD COLUMN IF NOT EXISTS request_note text
  CHECK (request_note IS NULL OR char_length(request_note) <= 300);
COMMENT ON COLUMN meldiq.connections.request_note IS 'Pending request note. Recipient only, at most 300 Unicode code points. Clear on acceptance; deleting the request removes it.';
CREATE OR REPLACE FUNCTION meldiq_private.pending_connection_note() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.state<>'pending' THEN NEW.request_note:=NULL; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER connections_note_pending BEFORE INSERT OR UPDATE ON meldiq.connections
FOR EACH ROW EXECUTE FUNCTION meldiq_private.pending_connection_note();
