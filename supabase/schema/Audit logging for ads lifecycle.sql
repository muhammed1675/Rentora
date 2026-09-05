-- Rentora — Extend the audit log to cover advertisements.
--
-- 34_audit_log.sql wired up capture_audit_event() for properties, rent
-- payments, withdrawals, user suspensions, agent bank changes, student
-- verification, and inspections — but never attached it to `ads`, so
-- nothing about a campaign (creation, payment, admin approval/rejection)
-- has ever been written to audit_log. This is why the admin activity log
-- shows nothing for the advertising pages.
--
-- This migration only:
--   1. Adds three `ads`-specific branches to capture_audit_event() (the
--      function is re-created in full, since CREATE OR REPLACE needs the
--      whole body — nothing about the existing branches changes).
--   2. Attaches the trigger to public.ads.
--
-- Safe to re-run.

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

  -- ── Advertising ───────────────────────────────────────
  ELSIF TG_TABLE_NAME = 'ads' AND TG_OP = 'INSERT' THEN
    v_event_type := 'ad.created';
  ELSIF TG_TABLE_NAME = 'ads' AND TG_OP = 'UPDATE' AND NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    -- Fires from /api/confirm-payment.js the moment Korapay's charge is
    -- verified server-side (pending -> paid), and from the retry-payment
    -- path if that ever changes payment_status directly.
    v_event_type := 'ad_payment.' || NEW.payment_status;
    v_category := 'financial';
  ELSIF TG_TABLE_NAME = 'ads' AND TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- Fires from the approve_ad / reject_ad admin RPCs, and from anything
    -- else that transitions status (e.g. an expiry sweep marking 'expired').
    v_event_type := 'ad.status_' || NEW.status;
    v_category := 'admin';
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

-- ── Attach the trigger to ads ──────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_ads ON public.ads;
CREATE TRIGGER trg_audit_ads AFTER INSERT OR UPDATE ON public.ads
  FOR EACH ROW EXECUTE FUNCTION public.capture_audit_event();

-- Sanity check after running (only shows ads created/updated from this
-- point forward — the trigger can't retroactively log past campaigns):
-- select event_type, category, count(*) from public.audit_log where target_type = 'ads' group by 1,2 order by 1;