-- =========================================================
-- Rentora — Admin broadcast notifications
--
-- One message sent from the admin panel, fanned out to every user (or a
-- role-targeted subset) via the SAME bell / /notifications UI that already
-- exists for personal notifications (see 07_notifications_and_rate_limiting.sql).
--
-- Deliberately a single row per broadcast (not one row per recipient) so
-- sending to thousands of users is one INSERT, not thousands. Each user's
-- read/unread state for a broadcast lives in broadcast_reads instead.
--
-- HOW TO APPLY: paste this whole file into Supabase Dashboard →
-- SQL Editor → New query → Run. It's idempotent-ish (CREATE TABLE
-- IF NOT EXISTS, CREATE OR REPLACE FUNCTION) so it's safe to re-run.
-- =========================================================

-- ── admin_broadcasts ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_broadcasts (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    body text NOT NULL,
    link text,
    -- 'all' reaches everyone; 'user' / 'agent' match public.users.role so a
    -- broadcast can be scoped to just students or just agents.
    target text NOT NULL DEFAULT 'all' CHECK (target IN ('all', 'user', 'agent')),
    created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_broadcasts_created_at_idx
  ON public.admin_broadcasts (created_at DESC);

ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;

-- Every user can read broadcasts aimed at "all" or at their own role.
-- Admins can also see everything (needed for the send-history list in the
-- admin panel, including broadcasts targeted at a role they aren't).
DROP POLICY IF EXISTS "admin_broadcasts_select_targeted" ON public.admin_broadcasts;
CREATE POLICY "admin_broadcasts_select_targeted" ON public.admin_broadcasts FOR SELECT
  USING (
    target = 'all'
    OR target = (SELECT role FROM public.users WHERE id = auth.uid())
    OR is_admin()
  );

-- Only admins may write directly to the table. In practice all inserts go
-- through send_broadcast() below (SECURITY DEFINER + its own admin check),
-- but this policy is defense-in-depth, same pattern as create_notification().
DROP POLICY IF EXISTS "admin_broadcasts_admin_manage" ON public.admin_broadcasts;
CREATE POLICY "admin_broadcasts_admin_manage" ON public.admin_broadcasts FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Let the bell update live without polling, same as user_notifications.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_broadcasts;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- already added, fine
END $$;

-- ── broadcast_reads ──────────────────────────────
-- Per-user read state for a broadcast. Deliberately separate from
-- admin_broadcasts.read_at (which doesn't exist) because one broadcast row
-- is shared by every recipient — "read" can't live on the shared row.
CREATE TABLE IF NOT EXISTS public.broadcast_reads (
    broadcast_id uuid NOT NULL REFERENCES public.admin_broadcasts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    read_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (broadcast_id, user_id)
);

ALTER TABLE public.broadcast_reads ENABLE ROW LEVEL SECURITY;

-- A user may only ever see/write their own read receipts.
DROP POLICY IF EXISTS "broadcast_reads_own" ON public.broadcast_reads;
CREATE POLICY "broadcast_reads_own" ON public.broadcast_reads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── send_broadcast ──────────────────────────────
-- The one and only way the admin panel sends a broadcast. Admin-checked
-- server-side (RAISE EXCEPTION, not just a hidden UI tab) so no other
-- authenticated user can call this directly and spam every user.
CREATE OR REPLACE FUNCTION public.send_broadcast(
  p_title text,
  p_body text,
  p_target text DEFAULT 'all',
  p_link text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can send broadcasts';
  END IF;

  IF p_target NOT IN ('all', 'user', 'agent') THEN
    RAISE EXCEPTION 'Invalid target: %', p_target;
  END IF;

  IF trim(coalesce(p_title, '')) = '' OR trim(coalesce(p_body, '')) = '' THEN
    RAISE EXCEPTION 'Broadcast needs both a title and a message';
  END IF;

  INSERT INTO public.admin_broadcasts (title, body, link, target, created_by)
  VALUES (trim(p_title), trim(p_body), p_link, p_target, auth.uid())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_broadcast(text, text, text, text) TO authenticated;

-- ── mark_broadcast_read ──────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_broadcast_read(p_broadcast_id uuid) RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  INSERT INTO public.broadcast_reads (broadcast_id, user_id)
  VALUES (p_broadcast_id, auth.uid())
  ON CONFLICT (broadcast_id, user_id) DO NOTHING;
$$;

GRANT EXECUTE ON FUNCTION public.mark_broadcast_read(uuid) TO authenticated;

-- ── broadcast_reach ──────────────────────────────
-- Read-count for a broadcast, for the admin history list. Admin-only (same
-- is_admin() check) since it implicitly reveals how many users have a given
-- role by counting eligible recipients.
CREATE OR REPLACE FUNCTION public.broadcast_reach(p_broadcast_id uuid) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target text;
  v_total int;
  v_read int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can view broadcast reach';
  END IF;

  SELECT target INTO v_target FROM public.admin_broadcasts WHERE id = p_broadcast_id;

  SELECT count(*) INTO v_total FROM public.users
    WHERE v_target = 'all' OR role = v_target;

  SELECT count(*) INTO v_read FROM public.broadcast_reads WHERE broadcast_id = p_broadcast_id;

  RETURN json_build_object('total', v_total, 'read', v_read);
END;
$$;

GRANT EXECUTE ON FUNCTION public.broadcast_reach(uuid) TO authenticated;