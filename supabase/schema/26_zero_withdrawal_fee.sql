-- Rentora: new withdrawals are fee-free; historical withdrawal rows remain unchanged.
-- Apply after the existing withdrawal function has been deployed.
CREATE OR REPLACE FUNCTION public.set_withdrawal_fee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.fee_amount := 0;
  NEW.net_amount := NEW.amount;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.set_withdrawal_fee() SET search_path = public;

-- Keep the database as the source of truth for new withdrawal values.
DROP TRIGGER IF EXISTS trg_set_withdrawal_fee ON public.withdrawal_requests;
CREATE TRIGGER trg_set_withdrawal_fee
BEFORE INSERT ON public.withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.set_withdrawal_fee();

COMMENT ON FUNCTION public.set_withdrawal_fee() IS
'New withdrawal requests have fee_amount 0 and net_amount equal to amount; historical rows are unchanged.';

-- Concurrency support for successful rent claims. Pending rows are intentionally
-- excluded so an abandoned checkout does not permanently block a property.
-- Existing data is not changed; this fails safely if duplicate successful claims
-- already exist and must be reviewed before applying.
CREATE UNIQUE INDEX IF NOT EXISTS property_rent_payments_one_successful_claim_idx
ON public.property_rent_payments(property_id)
WHERE status IN ('held', 'move_in_reported', 'released');

-- Keep the non-unique lookup index for pending/active payment administration.
CREATE INDEX IF NOT EXISTS property_rent_payments_active_property_idx_v2
ON public.property_rent_payments(property_id)
WHERE status IN ('pending', 'held', 'move_in_reported', 'released');
