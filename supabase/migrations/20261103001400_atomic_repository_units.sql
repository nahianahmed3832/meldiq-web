-- One invoker transaction for a cached repository unit; no per-row network round trips.
-- The application role already owns these DML privileges. This function never bypasses RLS.
CREATE OR REPLACE FUNCTION meldiq_private.apply_row_changes(changes jsonb, counters jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  operation jsonb;
  target_name text;
  target_oid oid;
  columns_sql text;
  values_sql text;
  conflict_sql text;
  update_sql text;
  predicate_sql text;
  commands jsonb := '{}'::jsonb;
  prepared jsonb;
  counter record;
BEGIN
  IF jsonb_typeof(changes) IS DISTINCT FROM 'array' OR jsonb_typeof(counters) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid repository unit' USING ERRCODE='22023';
  END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended('meldiq-rows-writer',0)) THEN
    RAISE EXCEPTION 'Another repository writer is active' USING ERRCODE='55000';
  END IF;
  FOR operation IN SELECT value FROM jsonb_array_elements(changes) LOOP
    target_name := operation->>'table';
    IF target_name IS NULL OR target_name !~ '^[a-z_][a-z0-9_]*$' THEN
      RAISE EXCEPTION 'Invalid repository table' USING ERRCODE='22023';
    END IF;
    prepared := commands->target_name;
    IF prepared IS NULL THEN
      SELECT c.oid INTO target_oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='meldiq' AND c.relname=target_name AND c.relkind IN ('r','p');
      IF target_oid IS NULL THEN RAISE EXCEPTION 'Unknown repository table' USING ERRCODE='22023'; END IF;
      SELECT string_agg(format('%I',a.attname),',' ORDER BY a.attnum),
        string_agg(CASE WHEN a.atttypid='jsonb'::regtype THEN format('$1->%L',a.attname) ELSE format('incoming.%I',a.attname) END,',' ORDER BY a.attnum)
      INTO columns_sql,values_sql FROM pg_attribute a
      WHERE a.attrelid=target_oid AND a.attnum>0 AND NOT a.attisdropped AND a.attgenerated='';
      SELECT string_agg(format('%I',a.attname),',' ORDER BY key.ordinality),
        string_agg(format('existing.%I IS NOT DISTINCT FROM incoming.%I',a.attname,a.attname),' AND ' ORDER BY key.ordinality)
      INTO conflict_sql,predicate_sql FROM pg_index i
      CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS key(attnum,ordinality)
      JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=key.attnum
      WHERE i.indrelid=target_oid AND i.indisprimary AND key.ordinality<=i.indnkeyatts;
      IF conflict_sql IS NULL THEN RAISE EXCEPTION 'Repository table has no primary key' USING ERRCODE='22023'; END IF;
      SELECT string_agg(format('%I=EXCLUDED.%I',a.attname,a.attname),',' ORDER BY a.attnum) INTO update_sql
      FROM pg_attribute a WHERE a.attrelid=target_oid AND a.attnum>0 AND NOT a.attisdropped AND a.attgenerated=''
        AND NOT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=target_oid AND i.indisprimary AND a.attnum=ANY(i.indkey));
      prepared := jsonb_build_object(
        'put',format('INSERT INTO meldiq.%I(%s) SELECT %s FROM jsonb_populate_record(NULL::meldiq.%I,$1) incoming ON CONFLICT(%s) DO %s',
          target_name,columns_sql,values_sql,target_name,conflict_sql,CASE WHEN update_sql IS NULL THEN 'NOTHING' ELSE 'UPDATE SET '||update_sql END),
        'remove',format('DELETE FROM meldiq.%I existing USING jsonb_populate_record(NULL::meldiq.%I,$1) incoming WHERE %s',target_name,target_name,predicate_sql));
      commands := commands||jsonb_build_object(target_name,prepared);
    END IF;
    IF operation ? 'row' AND jsonb_typeof(operation->'row')='object' THEN
      EXECUTE prepared->>'put' USING operation->'row';
    ELSIF operation ? 'key' AND jsonb_typeof(operation->'key')='object' THEN
      EXECUTE prepared->>'remove' USING operation->'key';
    ELSE RAISE EXCEPTION 'Invalid repository operation' USING ERRCODE='22023';
    END IF;
  END LOOP;
  FOR counter IN SELECT key,value FROM jsonb_each_text(counters) LOOP
    IF counter.key !~ '^[a-z_][a-z0-9_]*$' OR counter.value !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Invalid repository counter' USING ERRCODE='22023';
    END IF;
    INSERT INTO meldiq_private.row_counters(table_name,value) VALUES(counter.key,counter.value::bigint)
      ON CONFLICT(table_name) DO UPDATE SET value=greatest(meldiq_private.row_counters.value,EXCLUDED.value);
  END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION meldiq_private.apply_row_changes(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION meldiq_private.apply_row_changes(jsonb,jsonb) TO meldiq_api;
