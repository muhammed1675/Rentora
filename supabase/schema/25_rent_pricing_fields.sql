-- New-transaction pricing fields only; historical rows remain unchanged.
ALTER TABLE public.property_rent_payments
  ADD COLUMN IF NOT EXISTS inspection_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agreement_fee integer NOT NULL DEFAULT 0;

ALTER TABLE public.property_rent_payments
  DROP CONSTRAINT IF EXISTS property_rent_payments_total_amount_check;
ALTER TABLE public.property_rent_payments
  ADD CONSTRAINT property_rent_payments_total_amount_check
  CHECK (total_amount >= rent_amount + agent_fee + caution_fee + service_fee + inspection_fee + agreement_fee);

CREATE INDEX IF NOT EXISTS property_rent_payments_active_property_idx
  ON public.property_rent_payments(property_id)
  WHERE status IN ('pending', 'held', 'move_in_reported', 'released');
