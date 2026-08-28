-- Rentora: diagnostic-only check for logged-out public browsing.
-- This script does not change anything. Run it in Supabase SQL Editor
-- and share the three result sets if the public site is still empty.

-- 1) Confirm the tables exist and whether RLS is enabled.
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relkind,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('ads', 'properties', 'locations')
ORDER BY c.relname;

-- 2) Confirm the anonymous and authenticated roles can issue SELECT.
SELECT
  table_name,
  has_table_privilege('anon', format('public.%I', table_name), 'SELECT') AS anon_can_select,
  has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT') AS authenticated_can_select
FROM (VALUES ('ads'), ('properties'), ('locations')) AS tables(table_name)
ORDER BY table_name;

-- 3) Show the live policies that control SELECT visibility.
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('ads', 'properties', 'locations')
  AND cmd IN ('SELECT', 'ALL')
ORDER BY tablename, policyname;

-- 4) Check the exact public rows and filter values without exposing PII.
SELECT
  'ads' AS source,
  count(*) FILTER (
    WHERE status IN ('approved', 'active')
      AND payment_status IN ('paid', 'completed')
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at >= now())
  ) AS eligible_rows,
  count(*) AS total_rows
FROM public.ads
UNION ALL
SELECT
  'properties' AS source,
  count(*) FILTER (WHERE status = 'approved') AS eligible_rows,
  count(*) AS total_rows
FROM public.properties
UNION ALL
SELECT
  'locations' AS source,
  count(*) AS eligible_rows,
  count(*) AS total_rows
FROM public.locations;
