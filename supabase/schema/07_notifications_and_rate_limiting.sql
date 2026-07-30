-- =========================================================
-- Rentora — In-app notifications + Login/signup rate limiting
--
-- HOW TO APPLY: paste this whole file into Supabase Dashboard →
-- SQL Editor → New query → Run. It's idempotent-ish (CREATE TABLE
-- IF NOT EXISTS, CREATE OR REPLACE FUNCTION) so it's safe to re-run.
-- =========================================================


-- =========================================================
-- PART 1 — In-app notifications
-- =========================================================

-- ── user_notifications ──────────────────────────────
-- One row per notification shown in a user's bell dropdown / /notifications
-- page. Deliberately separate from the existing `notification_queue` table,
-- which is an internal email-retry log, not something users ever see.
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    link text,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_notifications_user_id_created_at_idx
  ON public.user_notifications (user_id, created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_notifications_select_own" ON public.user_notifications;
CREATE POLICY "user_notifications_select_own" ON public.user_notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users may only flip read_at on their own rows (used for mark-as-read).
DROP POLICY IF EXISTS "user_notifications_update_own" ON public.user_notifications;
CREATE POLICY "user_notifications_update_own" ON public.user_notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Deliberately NO insert policy for anon/authenticated — every insert goes
-- through create_notification() below (SECURITY DEFINER) or the server-side
-- service_role key. Otherwise any logged-in user could write directly into
-- another user's notification feed.

-- Let the bell update live without polling.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- already added, fine
END $$;

-- ── create_notification ──────────────────────────────
-- The one and only way client code creates a notification for ANY user
-- (including one that isn't the caller — e.g. a student's payment
-- notifying their agent). Runs as owner so it bypasses the RLS above,
-- but only ever inserts — it can't read or leak other users' rows.
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
  INSERT INTO public.user_notifications (user_id, type, title, body, link)
  VALUES (p_user_id, p_type, p_title, p_body, p_link)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) TO authenticated;

-- ── mark_all_notifications_read ──────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read() RETURNS void
LANGUAGE sql
SECURITY INVOKER
AS $$
  UPDATE public.user_notifications SET read_at = now()
  WHERE user_id = auth.uid() AND read_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

-- ── queue_rent_held_notification ──────────────────────────────
-- Enhancing the EXISTING trigger function (same name, same trigger
-- trg_queue_rent_held_notification already wired to it — no need to
-- touch 03_triggers.sql) so the agent also gets an in-app notification
-- at the same moment the email-queue row is written.
CREATE OR REPLACE FUNCTION public.queue_rent_held_notification() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_agent_email TEXT;
  v_agent_name TEXT;
  v_agent_id uuid;
  v_property_title TEXT;
BEGIN
  IF NEW.status = 'held' AND (OLD.status IS DISTINCT FROM 'held') THEN
    SELECT id, email, full_name INTO v_agent_id, v_agent_email, v_agent_name
      FROM public.users WHERE id = NEW.agent_id;
    SELECT title INTO v_property_title FROM public.properties WHERE id = NEW.property_id;

    INSERT INTO public.notification_queue (
      type, recipient_email, recipient_name, subject, body_text,
      related_property_id, related_payment_id
    ) VALUES (
      'rent_payment_held',
      v_agent_email,
      v_agent_name,
      'A student has paid rent for ' || COALESCE(v_property_title, 'your property'),
      'Hi ' || COALESCE(v_agent_name, 'there') || ', a student has paid rent for "' || COALESCE(v_property_title, 'your property') ||
      '". The full amount (₦' || NEW.total_amount || ') is currently held safely by Rentora — it has NOT been released to you yet. ' ||
      'It will be released once the student confirms they have moved in, or automatically after 5 days if they do not respond. ' ||
      'You do not need to do anything right now. We will notify you again once it is released.',
      NEW.property_id,
      NEW.id
    );

    IF v_agent_id IS NOT NULL THEN
      PERFORM public.create_notification(
        v_agent_id,
        'rent_payment_held',
        'Rent paid for ' || COALESCE(v_property_title, 'your property'),
        'A student has paid rent — ₦' || NEW.total_amount || ' is held by Rentora and will be released once move-in is confirmed.',
        '/agent'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


-- =========================================================
-- PART 2 — Login / signup rate limiting
-- =========================================================

-- ── auth_rate_limits ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
    identifier text NOT NULL,
    action text NOT NULL,
    attempt_count integer NOT NULL DEFAULT 0,
    window_start timestamptz NOT NULL DEFAULT now(),
    blocked_until timestamptz,
    PRIMARY KEY (identifier, action)
);

-- RLS on with NO policies at all: the table is only ever touched through
-- the SECURITY DEFINER functions below, so anon/authenticated get zero
-- direct access to it (defense in depth, not the primary protection).
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

-- ── check_rate_limit ──────────────────────────────
-- Call this BEFORE attempting a login or signup. It both checks and
-- records the attempt in one atomic call. identifier = email (login) or
-- IP address (signup); action = 'login' or 'signup'.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier text,
  p_action text,
  p_max_attempts integer,
  p_window_minutes integer,
  p_block_minutes integer
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.auth_rate_limits%ROWTYPE;
  v_identifier text := lower(trim(p_identifier));
BEGIN
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
  IF v_row.window_start < now() - (p_window_minutes || ' minutes')::interval THEN
    UPDATE public.auth_rate_limits
    SET attempt_count = 1, window_start = now(), blocked_until = NULL
    WHERE identifier = v_identifier AND action = p_action;
    RETURN json_build_object('allowed', true, 'retry_after_seconds', 0);
  END IF;

  -- Still inside the window — would this attempt push it over the limit?
  IF v_row.attempt_count + 1 > p_max_attempts THEN
    UPDATE public.auth_rate_limits
    SET attempt_count = attempt_count + 1,
        blocked_until = now() + (p_block_minutes || ' minutes')::interval
    WHERE identifier = v_identifier AND action = p_action;
    RETURN json_build_object('allowed', false, 'retry_after_seconds', p_block_minutes * 60);
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
CREATE OR REPLACE FUNCTION public.reset_rate_limit(p_identifier text, p_action text) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.auth_rate_limits
  WHERE identifier = lower(trim(p_identifier)) AND action = p_action;
$$;

GRANT EXECUTE ON FUNCTION public.reset_rate_limit(text, text) TO anon, authenticated;
