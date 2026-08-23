-- =========================================================
-- Rentora — Supabase security-linter follow-up
-- =========================================================
-- Run this directly in the Supabase SQL editor (it's not part of a
-- fresh-install run, since two of the ALTERs below target functions
-- whose full CREATE statement isn't in this repo — see
-- 02_functions_reference.sql's header for why).

-- ── search_path: the 2 functions this repo can't fully redefine ──
-- sync_location_text and set_withdrawal_fee only exist in this repo as
-- body-only fragments (02_functions_reference.sql), not full CREATE
-- statements, so we can't safely re-run CREATE OR REPLACE for them here.
-- ALTER FUNCTION only needs the name + arg types, not the body, so this
-- closes the search_path warning without touching their logic.
ALTER FUNCTION public.sync_location_text() SET search_path = public;
ALTER FUNCTION public.set_withdrawal_fee() SET search_path = public;

-- ── Move pg_trgm out of the public schema ──
-- pg_trgm (fuzzy text matching, powers find_possible_duplicate_properties
-- and the two trgm GIN indexes on properties) was installed straight into
-- public, the same schema as your app's own tables/functions. That's the
-- same class of risk as an unpinned search_path (see the ALTER FUNCTION
-- statements above) — anything in public is reachable by an unqualified
-- name, which is exactly what a hijack relies on. Moving it to its own
-- schema keeps public to just your own code.
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Existing GIN indexes (idx_properties_title_trgm, idx_properties_location_trgm)
-- keep working with no rebuild needed — Postgres tracks the operator
-- class by internal id, not by schema name.

-- find_possible_duplicate_properties() calls similarity() unqualified, so
-- now that pg_trgm has moved, it needs "extensions" added to its
-- search_path or that call stops resolving. Same body-only-fragment
-- situation as sync_location_text/set_withdrawal_fee above, so this is
-- ALTER FUNCTION rather than CREATE OR REPLACE.
ALTER FUNCTION public.find_possible_duplicate_properties(
  p_title text, p_location text, p_price integer, p_property_type text,
  p_exclude_agent_id uuid, p_exclude_property_id uuid
) SET search_path = public, extensions;

-- ── Rewritten logic (not just search_path): create_notification,
-- check_rate_limit, reset_rate_limit ──
-- These three had real authorization gaps, not just the mutable-
-- search_path warning — see the comments inside each function body
-- below for what was wrong and why. This is CREATE OR REPLACE (full
-- logic swap), not ALTER, since the fix changes behavior, not just a
-- config setting.

-- ── create_notification ──────────────────────────────
-- The one and only way client code creates a notification for ANY user
-- (including one that isn't the caller — e.g. a student's payment
-- notifying their agent). Runs as owner so it bypasses the RLS above,
-- but only ever inserts — it can't read or leak other users' rows.
--
-- SECURITY NOTE: because this is callable by any authenticated user for
-- any target p_user_id (that's the intended design — see notifyUser()
-- call sites in frontend/src/lib/api.js, where the caller and the
-- recipient are routinely different people), anyone logged in could
-- previously call this RPC directly (bypassing the app's UI entirely)
-- to plant a fake notification — with an arbitrary title/body and,
-- worse, an arbitrary p_link — inside another user's trusted in-app
-- notification feed. That's a phishing vector: it would look
-- indistinguishable from a real Rentora notification.
-- Every legitimate call site only ever passes a relative in-app path
-- (e.g. '/agent', '/browse'), never an external URL, so p_link is now
-- restricted to that same shape server-side. This doesn't fully close
-- title/body spoofing between users (that needs moving notification
-- triggers server-side, same pattern as queue_rent_held_notification's
-- trigger), but it removes the most damaging part: redirecting a victim
-- off-site from inside a channel they trust.
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Only allow same-origin, relative links (e.g. '/agent'). Reject
  -- absolute URLs and protocol-relative ones ('//evil.com') that a
  -- browser would still treat as external.
  IF p_link IS NOT NULL AND (p_link !~ '^/[^/]' ) THEN
    p_link := NULL;
  END IF;

  INSERT INTO public.user_notifications (user_id, type, title, body, link)
  VALUES (p_user_id, p_type, p_title, p_body, p_link)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) TO authenticated;

-- ── check_rate_limit ──────────────────────────────
-- Call this BEFORE attempting a login or signup. It both checks and
-- records the attempt in one atomic call. identifier = email (login) or
-- IP address (signup); action = 'login' or 'signup'.
--
-- SECURITY FIX: p_max_attempts/p_window_minutes/p_block_minutes used to
-- be trusted from the caller. Since this function is exposed to anon,
-- anyone could call it directly (bypassing the frontend entirely) with
-- p_max_attempts set absurdly high, effectively disabling rate limiting
-- for their own brute-force attempt. The thresholds are now hardcoded
-- server-side per action; caller-supplied values are ignored. Keep this
-- table in sync with frontend/src/lib/rateLimit.js's LIMITS constant —
-- that file's numbers are now cosmetic/documentation only, not enforced.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier text,
  p_action text,
  p_max_attempts integer DEFAULT NULL,
  p_window_minutes integer DEFAULT NULL,
  p_block_minutes integer DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.auth_rate_limits%ROWTYPE;
  v_identifier text := lower(trim(p_identifier));
  v_max_attempts integer;
  v_window_minutes integer;
  v_block_minutes integer;
BEGIN
  -- Server-side source of truth. Any p_max_attempts/p_window_minutes/
  -- p_block_minutes the caller sent is ignored below on purpose.
  CASE p_action
    WHEN 'otp_request' THEN v_max_attempts := 5; v_window_minutes := 15; v_block_minutes := 15;
    WHEN 'otp_verify'  THEN v_max_attempts := 8; v_window_minutes := 15; v_block_minutes := 15;
    WHEN 'login'        THEN v_max_attempts := 5; v_window_minutes := 15; v_block_minutes := 15;
    WHEN 'signup'       THEN v_max_attempts := 5; v_window_minutes := 15; v_block_minutes := 15;
    ELSE
      -- Unknown action: fail closed rather than let an unrecognized
      -- p_action slip through with no limit at all.
      RETURN json_build_object('allowed', false, 'retry_after_seconds', 900);
  END CASE;

  SELECT * INTO v_row FROM public.auth_rate_limits
  WHERE identifier = v_identifier AND action = p_action
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.auth_rate_limits (identifier, action, attempt_count, window_start)
    VALUES (v_identifier, p_action, 1, now());
    RETURN json_build_object('allowed', true, 'retry_after_seconds', 0);
  END IF;

  -- Already inside an active block window.
  IF v_row.blocked_until IS NOT NULL AND v_row.blocked_until > now() THEN
    RETURN json_build_object(
      'allowed', false,
      'retry_after_seconds', GREATEST(0, EXTRACT(EPOCH FROM (v_row.blocked_until - now()))::int)
    );
  END IF;

  -- The counting window has expired since the first attempt — start fresh.
  IF v_row.window_start < now() - (v_window_minutes || ' minutes')::interval THEN
    UPDATE public.auth_rate_limits
    SET attempt_count = 1, window_start = now(), blocked_until = NULL
    WHERE identifier = v_identifier AND action = p_action;
    RETURN json_build_object('allowed', true, 'retry_after_seconds', 0);
  END IF;

  -- Still inside the window — would this attempt push it over the limit?
  IF v_row.attempt_count + 1 > v_max_attempts THEN
    UPDATE public.auth_rate_limits
    SET attempt_count = attempt_count + 1,
        blocked_until = now() + (v_block_minutes || ' minutes')::interval
    WHERE identifier = v_identifier AND action = p_action;
    RETURN json_build_object('allowed', false, 'retry_after_seconds', v_block_minutes * 60);
  END IF;

  UPDATE public.auth_rate_limits
  SET attempt_count = attempt_count + 1
  WHERE identifier = v_identifier AND action = p_action;

  RETURN json_build_object('allowed', true, 'retry_after_seconds', 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer, integer) TO anon, authenticated;

-- ── reset_rate_limit ──────────────────────────────
-- Call after a SUCCESSFUL login so one earlier mistyped password doesn't
-- keep counting against the user for the rest of the window.
--
-- SECURITY FIX: this used to delete ANY identifier's rate-limit row for
-- ANY action, with no auth check at all — anyone (even anon) could clear
-- their own block after being locked out for brute-forcing someone
-- else's login/OTP, or clear a block they set on a victim's identifier.
-- Now it requires the caller to be logged in, only ever clears the
-- 'otp_verify' row (the one legitimate post-login use case in
-- rateLimit.js), and only for the identifier matching the caller's own
-- authenticated email — never an arbitrary identifier passed by the
-- client.
CREATE OR REPLACE FUNCTION public.reset_rate_limit(p_identifier text, p_action text) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_own_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN; -- not logged in — nothing to clear, no-op rather than error
  END IF;

  IF p_action != 'otp_verify' THEN
    RETURN; -- only the post-login-OTP case is legitimate from the client
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

-- ── inspection_transactions: drop legacy wide-open policies ──
-- "Allow all read" / "Allow insert" predate the properly-scoped
-- insp_tx_*_own policies below. Because RLS policies are OR'd together,
-- these two silently overrode the scoped ones — anyone (including
-- unauthenticated callers) could insert or read any row. The scoped
-- policies (insp_tx_insert_own, insp_tx_select_own) already cover the
-- legitimate cases, so it's safe to drop the old ones outright.
DROP POLICY IF EXISTS "Allow all read" ON public.inspection_transactions;
DROP POLICY IF EXISTS "Allow insert" ON public.inspection_transactions;
-- inspection_transactions_select_own duplicates insp_tx_select_own
-- exactly (same USING clause) — keep one, drop the redundant copy.
DROP POLICY IF EXISTS "inspection_transactions_select_own" ON public.inspection_transactions;

-- ── Public buckets: drop the broad SELECT policies ──
-- these SELECT policies aren't needed for normal display and only add
-- the ability to LIST every file in the bucket. Safe to drop.
DROP POLICY IF EXISTS "Anyone can view ad images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "move_in_photos_read" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view property images" ON storage.objects;
