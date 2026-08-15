-- 19_security_definer_view_fix.sql
-- Fixes the Supabase linter finding: "Security Definer View" on public.active_paid_owners
--
-- A view created without security_invoker runs with the OWNER's privileges, so it
-- bypasses the row level security policies of the user issuing the query.
-- Setting security_invoker = on makes the view respect the caller's RLS.
--
-- NOTE: public.active_paid_owners is not part of the Rentora schema files; it lives in
-- the Supabase project shown in the linter. Run this against that project.
-- Requires Postgres 15+ (all current Supabase projects qualify).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'active_paid_owners'
  ) THEN
    EXECUTE 'ALTER VIEW public.active_paid_owners SET (security_invoker = on)';

    -- Views have no RLS of their own: don't leave anon read access unless it must be public.
    EXECUTE 'REVOKE ALL ON public.active_paid_owners FROM anon';
    EXECUTE 'GRANT SELECT ON public.active_paid_owners TO authenticated';
    EXECUTE 'GRANT ALL    ON public.active_paid_owners TO service_role';
  ELSE
    RAISE NOTICE 'public.active_paid_owners does not exist in this database - nothing to do.';
  END IF;
END $$;

-- Generic sweep: apply security_invoker to every other SECURITY DEFINER view in public.
DO $$
DECLARE v record;
BEGIN
  FOR v IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'v'
      AND COALESCE((
        SELECT option_value = 'true'
        FROM pg_options_to_table(c.reloptions)
        WHERE option_name = 'security_invoker'
      ), false) = false
  LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v.relname);
    RAISE NOTICE 'security_invoker enabled on public.%', v.relname;
  END LOOP;
END $$;
