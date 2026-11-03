CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
BEGIN;
SET LOCAL search_path = public, extensions;
SELECT plan(10);
SELECT is((SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('meldiq','meldiq_private') AND c.relkind='r'),289::bigint,'all modeled application and operational tables exist');
SELECT ok(NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('meldiq','meldiq_private') AND c.relkind='r' AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)),'every table enables and forces RLS');
SELECT ok(NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('meldiq','meldiq_private') AND c.relkind='r' AND has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')),'authenticated clients cannot access raw business tables');
SELECT ok(NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('meldiq','meldiq_private') AND c.relkind='r' AND has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')),'anonymous clients cannot access raw business tables');
SELECT ok((SELECT NOT rolbypassrls AND NOT rolsuper AND NOT rolcanlogin FROM pg_roles WHERE rolname='meldiq_api'),'runtime role has no bypassrls, superuser or embedded login');
SELECT is((SELECT string_agg(policyname||':'||roles::text||':'||cmd,',' ORDER BY policyname)
  FROM pg_policies WHERE schemaname='realtime' AND tablename='messages'),
  'meldiq_ephemeral_send:{authenticated}:INSERT,meldiq_outbox_publish:{meldiq_api}:INSERT,meldiq_private_receive:{authenticated}:SELECT',
  'only the reviewed client and restricted outbox Realtime policies are present');
SELECT ok(NOT has_function_privilege('anon','meldiq_private.active_user_id()','EXECUTE'),'anonymous callers cannot resolve internal ownership');
SELECT ok(NOT has_function_privilege('authenticated','meldiq_private.event_payload(text)','EXECUTE'),'client cannot call private payload operations');
SELECT ok(NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='meldiq'),'no blanket application-table change publication');
SELECT is(meldiq_private.event_payload('invalid legacy payload'),NULL::jsonb,'malformed historical JSON remains readable without a query crash');
SELECT * FROM finish();
ROLLBACK;
