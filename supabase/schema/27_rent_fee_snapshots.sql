-- Forward-only fee support. Existing rows are intentionally not rewritten.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS agreement_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_fees jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.property_rent_payments
  ADD COLUMN IF NOT EXISTS inspection_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agreement_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_fees jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.property_rent_payments
  DROP CONSTRAINT IF EXISTS property_rent_payments_total_amount_check;
CREATE OR REPLACE FUNCTION public.other_fees_total(fees jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(SUM(CASE WHEN jsonb_typeof(item->'amount') = 'number' THEN (item->>'amount')::numeric ELSE 0 END), 0)
  FROM jsonb_array_elements(COALESCE(fees, '[]'::jsonb)) AS item;
$$;

ALTER TABLE public.property_rent_payments
  ADD CONSTRAINT property_rent_payments_total_amount_check CHECK (
    total_amount >= rent_amount + agent_fee + caution_fee + inspection_fee + agreement_fee + service_fee
      + public.other_fees_total(other_fees)
  );
