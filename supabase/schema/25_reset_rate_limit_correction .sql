-- =========================================================
-- Rentora — reset_rate_limit correction
-- =========================================================
-- Fixes a regression in the previous reset_rate_limit security fix:
-- it only allowed clearing the 'otp_verify' counter after login, but
-- verifyOtpCode() in frontend/src/lib/auth.js also clears 'otp_request'
-- (so someone who requested a code 2-3 times before one landed doesn't
-- keep accumulating attempts across successful logins). That second
-- call was silently no-op'd. This widens the allow-list to both —
-- still locked to the caller's own authenticated email, still requires
-- being logged in, still can't touch anyone else's identifier.

CREATE OR REPLACE FUNCTION public.reset_rate_limit(p_identifier text, p_action text) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_own_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF p_action NOT IN ('otp_verify', 'otp_request') THEN
    RETURN;
  END IF;

  SELECT email INTO v_own_email FROM auth.users WHERE id = auth.uid();

  DELETE FROM public.auth_rate_limits
  WHERE identifier = lower(trim(p_identifier))
    AND action = p_action
    AND lower(trim(p_identifier)) = lower(trim(v_own_email));
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_rate_limit(text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_rate_limit(text, text) FROM anon;