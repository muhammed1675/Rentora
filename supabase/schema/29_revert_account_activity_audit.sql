-- Rentora — Revert migration 28 (account_activity_audit).
-- Run this in Supabase SQL Editor. Safe to re-run (everything is IF EXISTS).
--
-- This undoes, in dependency-safe order, everything created by
-- 28_account_activity_audit.sql:
--   1. The 6 capture triggers on properties / property_rent_payments /
--      transactions / unlocks / inspections / student_verification_requests
--   2. The capture_user_activity() trigger function
--   3. The log_account_activity() function
--   4. The get_account_activity_statement() function
--   5. The account_activity_log table itself (RLS policies + indexes go
--      with it via CASCADE)
--
-- Nothing else in the schema is touched. No other table, policy, or
-- function created before migration 28 is affected.

-- 1. Triggers (must drop before the function they call)
drop trigger if exists capture_properties_activity on public.properties;
drop trigger if exists capture_payments_activity on public.property_rent_payments;
drop trigger if exists capture_transactions_activity on public.transactions;
drop trigger if exists capture_unlocks_activity on public.unlocks;
drop trigger if exists capture_inspections_activity on public.inspections;
drop trigger if exists capture_student_verification_activity on public.student_verification_requests;

-- 2. Trigger function
drop function if exists public.capture_user_activity();

-- 3 & 4. RPC functions
drop function if exists public.log_account_activity(uuid, text, text, text, numeric, text, text, jsonb, uuid);
drop function if exists public.get_account_activity_statement(uuid);

-- 5. Table (drops its own policies and indexes automatically)
drop table if exists public.account_activity_log cascade;

-- Done. Confirm nothing is left behind:
-- select proname from pg_proc where proname in
--   ('capture_user_activity','log_account_activity','get_account_activity_statement');
-- select tablename from pg_tables where tablename = 'account_activity_log';
-- (both queries above should return 0 rows once this has run)
