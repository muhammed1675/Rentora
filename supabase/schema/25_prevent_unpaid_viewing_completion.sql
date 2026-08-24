-- Prevent an agent/admin/UI update from marking a paid viewing physically
-- completed before its payment has actually been confirmed.
CREATE OR REPLACE FUNCTION public.prevent_unpaid_viewing_completion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND COALESCE(NEW.payment_status, 'pending') NOT IN ('completed', 'not_required') THEN
    RAISE EXCEPTION 'A viewing cannot be marked completed until its payment is confirmed.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_unpaid_viewing_completion ON public.inspections;
CREATE TRIGGER trg_prevent_unpaid_viewing_completion
BEFORE UPDATE OF status, payment_status ON public.inspections
FOR EACH ROW
EXECUTE FUNCTION public.prevent_unpaid_viewing_completion();
