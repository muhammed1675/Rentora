-- Rentora — URGENT hotfix for capture_audit_event().
--
-- BUG: capture_audit_event() is attached to 7 different tables and used
-- direct field access like `NEW.status` / `NEW.suspended` inside IF/ELSIF
-- branches guarded by `TG_TABLE_NAME = '...' AND ...`. Postgres does NOT
-- guarantee short-circuit evaluation of AND/OR — it can evaluate the
-- right-hand side even when the left-hand side is false. That means
-- `NEW.status` was sometimes evaluated on tables with no `status` column
-- (e.g. `users`, which only has `suspended`), throwing:
--   record "new" has no field "status"
--
-- IMPACT: every login updates public.users.last_login_at, which fires
-- this trigger on the `users` table, which hit the bug above and failed
-- the entire transaction — breaking login for every single user
-- ("Database error granting user"). Run this immediately.
--
-- FIX: read every field through jsonb (`row_json->>'status'`) instead of
-- direct dot access. jsonb key lookup safely returns NULL for a missing
-- key on any row type, instead of erroring.
--
-- Also: stop inserting a noisy 'users.update' row on every single login
-- (last_login_at changes every time) — only log `users` updates when the
-- thing we actually care about (suspended) changed.
--
-- Safe to re-run. Only replaces the function body — no trigger changes
-- needed, they already point at this function name.

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
  v_new jsonb;
  v_old jsonb;
  v_new_status text;
  v_old_status text;
  v_new_suspended text;
  v_old_suspended text;
BEGIN
  SELECT role, email INTO v_actor_role, v_actor_email
    FROM public.users WHERE id = auth.uid();

  v_new := to_jsonb(NEW);
  v_old := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
  v_target_id := (v_new->>'id')::uuid;

  -- Safe field reads: jsonb ->> returns NULL for a key that doesn't
  -- exist on this row type, instead of erroring like NEW.status would.
  v_new_status := v_new->>'status';
  v_old_status := v_old->>'status';
  v_new_suspended := v_new->>'suspended';
  v_old_suspended := v_old->>'suspended';

  v_event_type := TG_TABLE_NAME || '.' || lower(TG_OP);
  v_category := 'user_action';

  IF TG_TABLE_NAME = 'properties' AND TG_OP = 'UPDATE' AND v_new_status IS DISTINCT FROM v_old_status THEN
    v_event_type := 'property.status_' || v_new_status;
    v_category := 'admin';
  ELSIF TG_TABLE_NAME = 'properties' AND TG_OP = 'INSERT' THEN
    v_event_type := 'property.created';
  ELSIF TG_TABLE_NAME = 'property_rent_payments' AND TG_OP = 'UPDATE' AND v_new_status IS DISTINCT FROM v_old_status THEN
    v_event_type := 'payment.' || v_new_status;
    v_category := 'financial';
  ELSIF TG_TABLE_NAME = 'withdrawal_requests' AND TG_OP = 'INSERT' THEN
    v_event_type := 'withdrawal.requested';
    v_category := 'financial';
  ELSIF TG_TABLE_NAME = 'withdrawal_requests' AND TG_OP = 'UPDATE' AND v_new_status IS DISTINCT FROM v_old_status THEN
    v_event_type := 'withdrawal.' || v_new_status;
    v_category := 'financial';
  ELSIF TG_TABLE_NAME = 'users' AND TG_OP = 'UPDATE' AND v_new_suspended IS DISTINCT FROM v_old_suspended THEN
    v_event_type := CASE WHEN v_new_suspended = 'true' THEN 'user.suspended' ELSE 'user.unsuspended' END;
    v_category := 'admin';
  ELSIF TG_TABLE_NAME = 'agent_bank_change_requests' AND TG_OP = 'UPDATE' AND v_new_status IS DISTINCT FROM v_old_status THEN
    v_event_type := 'agent_bank_change.' || v_new_status;
    v_category := 'admin';
  ELSIF TG_TABLE_NAME = 'student_verification_requests' AND TG_OP = 'UPDATE' AND v_new_status IS DISTINCT FROM v_old_status THEN
    v_event_type := 'student_verification.' || v_new_status;
    v_category := 'admin';
  ELSIF TG_TABLE_NAME = 'inspections' AND TG_OP = 'INSERT' THEN
    v_event_type := 'inspection.booked';
  END IF;

  -- `users` updates on every login (last_login_at) or profile edit would
  -- otherwise flood the log as generic 'users.update' rows — only log
  -- users-table changes when something we actually track (suspended)
  -- changed above.
  IF TG_TABLE_NAME = 'users' AND v_event_type = 'users.update' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.audit_log (
    actor_id, actor_role, actor_email, event_type, category,
    target_type, target_id, metadata
  ) VALUES (
    auth.uid(), v_actor_role, v_actor_email, v_event_type, v_category,
    TG_TABLE_NAME, v_target_id,
    jsonb_build_object('op', TG_OP, 'new', v_new, 'old', v_old)
  );

  RETURN NEW;
END;
$$;

-- After running, confirm logins work again, then sanity-check no errors
-- are still being thrown:
-- select event_type, category, count(*) from public.audit_log group by 1,2 order by 1;