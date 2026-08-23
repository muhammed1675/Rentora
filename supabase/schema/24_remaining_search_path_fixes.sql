-- =========================================================
-- Rentora — remaining search_path fixes (live-apply)
-- =========================================================
-- These 10 functions were already patched with SET search_path = public
-- in the repo's source files (see 07_notifications_and_rate_limiting.sql,
-- 09_refund_and_delete_fixes.sql, 12_agent_tips.sql,
-- 13_admin_broadcasts.sql, 22_ads.sql, 02_functions_reference.sql) —
-- but that only updates your codebase, not your live Supabase database.
-- 23_security_lint_fixes.sql never included them. Run this once to
-- close the remaining function_search_path_mutable warnings.
--
-- ALTER FUNCTION only needs the name + argument types (not the full
-- body), so this is safe to run regardless of what's currently live —
-- it changes a config setting, not behavior.

ALTER FUNCTION public.credit_agent_tip_balance() SET search_path = public;
ALTER FUNCTION public.prevent_reopening_reserved_property() SET search_path = public;
ALTER FUNCTION public.mark_broadcast_read(uuid) SET search_path = public;
ALTER FUNCTION public.increment_ad_click(uuid) SET search_path = public;
ALTER FUNCTION public.get_ad_slot_availability() SET search_path = public;
ALTER FUNCTION public.process_ad_lifecycle() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.reserve_property_on_rent_hold() SET search_path = public;
ALTER FUNCTION public.mark_all_notifications_read() SET search_path = public;
ALTER FUNCTION public.queue_rent_held_notification() SET search_path = public;