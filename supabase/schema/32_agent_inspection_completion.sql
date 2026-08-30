-- 32_agent_inspection_completion.sql
--
-- WHY THIS EXISTS
-- The Agent Dashboard's "Done" button on an assigned viewing calls
-- inspectionAPI.update(id, { status: 'completed' }). There has never been
-- an RLS UPDATE policy on public.inspections for agents — only
-- inspections_update_admin exists (see 04_policies.sql). Postgres RLS does
-- NOT throw an error when a policy blocks an UPDATE; it just matches zero
-- rows and returns success. So every agent click has always shown
-- "Inspection marked as completed" while silently changing nothing, and
-- the list reverts to showing the Done button again on refresh.
--
-- THE FIX
-- A real UPDATE policy for agents, scoped as tightly as the client-side
-- check in inspectionAPI.update already intends:
--   - only the assigned agent, on their own inspection row
--   - only when payment is already confirmed (or was never required)
--   - only flips status -> 'completed'
-- A BEFORE UPDATE trigger backs this up server-side and pins every other
-- column to its previous value for non-admin updates, so even a
-- hand-crafted REST call (bypassing the app's own JS check) can't use this
-- new policy to rewrite payment_status, reassign the inspection to a
-- different agent, or change anything else about the row.

CREATE POLICY "inspections_update_agent" ON public.inspections FOR UPDATE
  USING (auth.uid() = agent_id)
  WITH CHECK (auth.uid() = agent_id);

CREATE OR REPLACE FUNCTION public.restrict_agent_inspection_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Admins go through inspections_update_admin and aren't restricted here.
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Only a status change to 'completed' is allowed, and only once payment
  -- is confirmed (or wasn't required) — mirrors the check already in
  -- inspectionAPI.update on the client, enforced again here so it can't be
  -- bypassed by calling the REST API directly.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status <> 'completed' THEN
      RAISE EXCEPTION 'Agents can only mark a viewing as completed';
    END IF;
    IF OLD.payment_status NOT IN ('completed', 'not_required') THEN
      RAISE EXCEPTION 'This viewing cannot be marked completed until the payment is confirmed';
    END IF;
  END IF;

  -- Everything else is pinned to its previous value — an agent's UPDATE
  -- can flip status to 'completed' and nothing more, regardless of what
  -- else is in the request payload.
  NEW.id := OLD.id;
  NEW.user_id := OLD.user_id;
  NEW.user_name := OLD.user_name;
  NEW.user_email := OLD.user_email;
  NEW.user_email_override := OLD.user_email_override;
  NEW.user_phone := OLD.user_phone;
  NEW.property_id := OLD.property_id;
  NEW.property_title := OLD.property_title;
  NEW.agent_id := OLD.agent_id;
  NEW.agent_name := OLD.agent_name;
  NEW.inspection_date := OLD.inspection_date;
  NEW.payment_status := OLD.payment_status;
  NEW.payment_reference := OLD.payment_reference;
  NEW.created_at := OLD.created_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_agent_inspection_update ON public.inspections;
CREATE TRIGGER trg_restrict_agent_inspection_update
  BEFORE UPDATE ON public.inspections
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_agent_inspection_update();
