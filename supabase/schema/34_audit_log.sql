-- Rentora — Platform-wide audit log.
--
-- One central table capturing: auth events (login/logout/failed login),
-- admin actions (approvals, suspensions, refunds), financial events
-- (payment held/released/refunded, withdrawals), and key user actions
-- (listings created, inspections booked). Admin-dashboard-only.
--
-- Design notes vs. the old (reverted) account_activity_audit:
--  - Platform-wide from the start, not scoped to a single account.
--  - Writes only ever happen via SECURITY DEFINER functions/triggers —
--    RLS blocks all direct inserts, so a compromised client can't write
--    fake history or block a real one from being written.
--  - Uses one generic capture trigger (capture_audit_event) reused across
--    tables instead of one bespoke trigger per table, so extending
--    coverage later is a one-line ADD TRIGGER, not a new function.
--
-- Safe to re-run.

-- ── audit_log ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    actor_id uuid,                    -- null for system/auto events (e.g. auto-release cron)
    actor_role text,                  -- snapshotted at write time
    actor_email text,                 -- snapshotted so it still reads fine after account deletion
    event_type text NOT NULL,         -- e.g. 'auth.login', 'payment.released', 'property.status_approved'
    category text NOT NULL,           -- 'auth' | 'admin' | 'financial' | 'user_action'
    target_type text,                 -- table/entity the event is about
    target_id uuid,
    description text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    ip_address text,
    user_agent text
);

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_category_idx ON public.audit_log (category);
CREATE INDEX IF NOT EXISTS audit_log_event_type_idx ON public.audit_log (event_type);
CREATE INDEX IF NOT EXISTS audit_log_actor_id_idx ON public.audit_log (actor_id);
CREATE INDEX IF NOT EXISTS audit_log_target_idx ON public.audit_log (target_type, target_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select_admin" ON public.audit_log;
CREATE POLICY "audit_log_select_admin" ON public.audit_log FOR SELECT
  USING (public.is_admin());

-- Deliberately NO insert/update/delete policy for anon/authenticated.
-- Every row is written by a SECURITY DEFINER function or trigger below —
-- direct client writes are impossible, so the log can't be tampered with
-- or blocked from a compromised browser session.

-- ── log_audit_event ──────────────────────────────
-- The one client-callable entry point, for events that have no natural
-- database trigger to hang off (logout, failed login attempts, and any
-- future admin action that doesn't correspond to a row status change).
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_event_type text,
  p_category text,
  p_target_type text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_actor_role text;
  v_actor_email text;
BEGIN
  SELECT role, email INTO v_actor_role, v_actor_email
    FROM public.users WHERE id = auth.uid();

  INSERT INTO public.audit_log (
    actor_id, actor_role, actor_email, event_type, category,
    target_type, target_id, description, metadata
  ) VALUES (
    auth.uid(), v_actor_role, v_actor_email, p_event_type, p_category,
    p_target_type, p_target_id, p_description, p_metadata
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, uuid, text, jsonb) TO authenticated;
-- Also grant to anon: a failed OTP/login attempt happens BEFORE a session
-- exists, so there's no "authenticated" caller yet. Safe to expose — the
-- function only INSERTs (never reads), auth.uid() will simply be null for
-- these calls, and audit_log itself stays admin-read-only regardless.
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, uuid, text, jsonb) TO anon;

-- ── capture_audit_event ──────────────────────────────
-- Generic trigger: attach to any table and it logs inserts / status
-- changes automatically, with the full before/after row as metadata.
-- Add coverage to a new table later with just:
--   CREATE TRIGGER trg_audit_<table> AFTER INSERT OR UPDATE ON public.<table>
--     FOR EACH ROW EXECUTE FUNCTION public.capture_audit_event();
CREATE OR REPLACE FUNCTION public.capture_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role text;
  v_actor_email text;
  v_event_type text;
  v_category text;
  v_target_id uuid;
  v_row jsonb;
BEGIN
  SELECT role, email INTO v_actor_role, v_actor_email
    FROM public.users WHERE id = auth.uid();

  v_row := to_jsonb(NEW);
  v_target_id := (v_row->>'id')::uuid;
  v_event_type := TG_TABLE_NAME || '.' || lower(TG_OP);
  v_category := 'user_action';

  IF TG_TABLE_NAME = 'properties' AND TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_event_type := 'property.status_' || NEW.status;
    v_category := 'admin';
  ELSIF TG_TABLE_NAME = 'properties' AND TG_OP = 'INSERT' THEN
    v_event_type := 'property.created';
  ELSIF TG_TABLE_NAME = 'property_rent_payments' AND TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_event_type := 'payment.' || NEW.status;
    v_category := 'financial';
  ELSIF TG_TABLE_NAME = 'withdrawal_requests' AND TG_OP = 'INSERT' THEN
    v_event_type := 'withdrawal.requested';
    v_category := 'financial';
  ELSIF TG_TABLE_NAME = 'withdrawal_requests' AND TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_event_type := 'withdrawal.' || NEW.status;
    v_category := 'financial';
  ELSIF TG_TABLE_NAME = 'users' AND TG_OP = 'UPDATE' AND NEW.suspended IS DISTINCT FROM OLD.suspended THEN
    v_event_type := CASE WHEN NEW.suspended THEN 'user.suspended' ELSE 'user.unsuspended' END;
    v_category := 'admin';
  ELSIF TG_TABLE_NAME = 'agent_bank_change_requests' AND TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_event_type := 'agent_bank_change.' || NEW.status;
    v_category := 'admin';
  ELSIF TG_TABLE_NAME = 'student_verification_requests' AND TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_event_type := 'student_verification.' || NEW.status;
    v_category := 'admin';
  ELSIF TG_TABLE_NAME = 'inspections' AND TG_OP = 'INSERT' THEN
    v_event_type := 'inspection.booked';
  END IF;

  INSERT INTO public.audit_log (
    actor_id, actor_role, actor_email, event_type, category,
    target_type, target_id, metadata
  ) VALUES (
    auth.uid(), v_actor_role, v_actor_email, v_event_type, v_category,
    TG_TABLE_NAME, v_target_id,
    jsonb_build_object(
      'op', TG_OP,
      'new', v_row,
      'old', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END
    )
  );

  RETURN NEW;
END;
$$;

-- ── Attach capture triggers ──────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_properties ON public.properties;
CREATE TRIGGER trg_audit_properties AFTER INSERT OR UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.capture_audit_event();

DROP TRIGGER IF EXISTS trg_audit_property_rent_payments ON public.property_rent_payments;
CREATE TRIGGER trg_audit_property_rent_payments AFTER UPDATE ON public.property_rent_payments
  FOR EACH ROW EXECUTE FUNCTION public.capture_audit_event();

DROP TRIGGER IF EXISTS trg_audit_withdrawal_requests ON public.withdrawal_requests;
CREATE TRIGGER trg_audit_withdrawal_requests AFTER INSERT OR UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.capture_audit_event();

DROP TRIGGER IF EXISTS trg_audit_users_suspended ON public.users;
CREATE TRIGGER trg_audit_users_suspended AFTER UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.capture_audit_event();

DROP TRIGGER IF EXISTS trg_audit_agent_bank_change_requests ON public.agent_bank_change_requests;
CREATE TRIGGER trg_audit_agent_bank_change_requests AFTER UPDATE ON public.agent_bank_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.capture_audit_event();

DROP TRIGGER IF EXISTS trg_audit_student_verification_requests ON public.student_verification_requests;
CREATE TRIGGER trg_audit_student_verification_requests AFTER UPDATE ON public.student_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.capture_audit_event();

DROP TRIGGER IF EXISTS trg_audit_inspections ON public.inspections;
CREATE TRIGGER trg_audit_inspections AFTER INSERT ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.capture_audit_event();

-- ── Successful logins ──────────────────────────────
-- Extends the EXISTING sync_last_login() trigger function (same trigger
-- on_auth_user_login already wired to it — no change needed in
-- 21_user_last_login.sql) so every real sign-in is captured at the DB
-- level. This can't be skipped by client code the way an RPC call could.
CREATE OR REPLACE FUNCTION public.sync_last_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_email text;
BEGIN
  UPDATE public.users
  SET last_login_at = NEW.last_sign_in_at
  WHERE id = NEW.id
  RETURNING role, email INTO v_role, v_email;

  INSERT INTO public.audit_log (actor_id, actor_role, actor_email, event_type, category, target_type, target_id)
  VALUES (NEW.id, v_role, v_email, 'auth.login', 'auth', 'users', NEW.id);

  RETURN NEW;
END;
$$;

-- Sanity check after running:
-- select event_type, category, count(*) from public.audit_log group by 1,2 order by 1;