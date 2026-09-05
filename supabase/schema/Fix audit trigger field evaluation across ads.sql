-- Rentora — Fix capture_audit_event() breaking ad creation.
--
-- 35_ads_audit_log.sql attached capture_audit_event() to `ads`, but the
-- function tests every table's condition as one long IF / ELSIF chain,
-- e.g.:
--     ELSIF TG_TABLE_NAME = 'users' AND TG_OP = 'UPDATE'
--           AND NEW.suspended IS DISTINCT FROM OLD.suspended THEN
--
-- The `TG_TABLE_NAME = 'users'` guard does NOT stop Postgres from trying
-- to resolve `NEW.suspended` when the trigger fires for a *different*
-- table — because NEW is a generic RECORD here (the same function is
-- reused across many tables), and PL/pgSQL has to resolve every field
-- reference against the row that's actually firing, even ones sitting
-- next to a guard condition in the same AND. Since `ads` has no
-- `suspended` column, every insert/update on `ads` hit:
--     record "new" has no field "suspended"
-- and the insert (creating a campaign) failed outright with a 400.
--
-- Fix: nest each table's field-specific checks inside its own
-- `IF TG_TABLE_NAME = '<table>' THEN ... END IF;` block, so a field like
-- NEW.suspended is only ever touched when the trigger is actually firing
-- for `users` — never evaluated, and therefore never resolved, for any
-- other table. Behavior for every existing event type is unchanged;
-- only the structure changes.
--
-- Safe to re-run. Run this AFTER 35_ads_audit_log.sql (or instead of it,
-- if 35 hasn't been run yet — this migration fully replaces the function
-- 35 defined).

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

  IF TG_TABLE_NAME = 'properties' THEN
    IF TG_OP = 'INSERT' THEN
      v_event_type := 'property.created';
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      v_event_type := 'property.status_' || NEW.status;
      v_category := 'admin';
    END IF;

  ELSIF TG_TABLE_NAME = 'property_rent_payments' THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      v_event_type := 'payment.' || NEW.status;
      v_category := 'financial';
    END IF;

  ELSIF TG_TABLE_NAME = 'withdrawal_requests' THEN
    IF TG_OP = 'INSERT' THEN
      v_event_type := 'withdrawal.requested';
      v_category := 'financial';
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      v_event_type := 'withdrawal.' || NEW.status;
      v_category := 'financial';
    END IF;

  ELSIF TG_TABLE_NAME = 'users' THEN
    IF TG_OP = 'UPDATE' AND NEW.suspended IS DISTINCT FROM OLD.suspended THEN
      v_event_type := CASE WHEN NEW.suspended THEN 'user.suspended' ELSE 'user.unsuspended' END;
      v_category := 'admin';
    END IF;

  ELSIF TG_TABLE_NAME = 'agent_bank_change_requests' THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      v_event_type := 'agent_bank_change.' || NEW.status;
      v_category := 'admin';
    END IF;

  ELSIF TG_TABLE_NAME = 'student_verification_requests' THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      v_event_type := 'student_verification.' || NEW.status;
      v_category := 'admin';
    END IF;

  ELSIF TG_TABLE_NAME = 'inspections' THEN
    IF TG_OP = 'INSERT' THEN
      v_event_type := 'inspection.booked';
    END IF;

  -- ── Advertising ───────────────────────────────────────
  ELSIF TG_TABLE_NAME = 'ads' THEN
    IF TG_OP = 'INSERT' THEN
      v_event_type := 'ad.created';
    ELSIF TG_OP = 'UPDATE' AND NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
      v_event_type := 'ad_payment.' || NEW.payment_status;
      v_category := 'financial';
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      v_event_type := 'ad.status_' || NEW.status;
      v_category := 'admin';
    END IF;
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

-- No trigger changes needed — trg_audit_ads (from 35_ads_audit_log.sql)
-- and every other existing trigger already point at this function name,
-- so replacing the function body is enough.

-- Sanity check after running — try creating a test ad campaign again,
-- then: select event_type, category, count(*) from public.audit_log where target_type = 'ads' group by 1,2 order by 1;