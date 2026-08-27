-- ============================================================
-- RENTORA SECURITY HARDENING
-- Function execution permissions
-- ============================================================

-- ------------------------------------------------------------
-- 1. reset_rate_limit
-- ------------------------------------------------------------

REVOKE EXECUTE
ON FUNCTION public.reset_rate_limit(text, text)
FROM PUBLIC, anon, authenticated;

-- Only trusted server-side code should be able to call this.
GRANT EXECUTE
ON FUNCTION public.reset_rate_limit(text, text)
TO service_role;


-- ------------------------------------------------------------
-- 2. create_notification
-- ------------------------------------------------------------

REVOKE EXECUTE
ON FUNCTION public.create_notification(uuid, text, text, text, text)
FROM PUBLIC, anon, authenticated;

-- Notifications that target another user should be created
-- by trusted server-side code.
GRANT EXECUTE
ON FUNCTION public.create_notification(uuid, text, text, text, text)
TO service_role;


-- ------------------------------------------------------------
-- 3. auto_release_rent_escrow
-- ------------------------------------------------------------

REVOKE EXECUTE
ON FUNCTION public.auto_release_rent_escrow()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.auto_release_rent_escrow()
TO service_role;


-- ------------------------------------------------------------
-- 4. expire_stale_pending_payments
-- ------------------------------------------------------------

REVOKE EXECUTE
ON FUNCTION public.expire_stale_pending_payments()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.expire_stale_pending_payments()
TO service_role;