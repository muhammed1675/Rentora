-- Rentora final payment model: additive and idempotent.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS agreement_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS documentation_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_fees jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.property_rent_payments
  ADD COLUMN IF NOT EXISTS agreement_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inspection_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS documentation_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_fees jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS other_fees_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS provider_status text;

-- Existing rows retain their historical totals; new rows use the final rate.
INSERT INTO public.platform_settings(key, value) VALUES ('rent_service_fee_pct', '3.5')
ON CONFLICT (key) DO UPDATE SET value = '3.5';

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS fee_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount numeric;
UPDATE public.withdrawal_requests SET fee_amount = 0, net_amount = amount WHERE fee_amount IS DISTINCT FROM 0 OR net_amount IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS property_rent_payments_reference_unique ON public.property_rent_payments(reference);
CREATE UNIQUE INDEX IF NOT EXISTS property_rent_payments_provider_reference_unique ON public.property_rent_payments(koralpay_reference) WHERE koralpay_reference IS NOT NULL;
ALTER TABLE public.property_rent_payments DROP CONSTRAINT IF EXISTS property_rent_payments_final_total_check;
ALTER TABLE public.property_rent_payments ADD CONSTRAINT property_rent_payments_final_total_check CHECK (total_amount = rent_amount + service_fee + agent_fee + caution_fee + COALESCE(agreement_fee,0) + COALESCE(inspection_fee,0) + COALESCE(documentation_fee,0) + COALESCE(other_fees_total,0));
ALTER TABLE public.withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_minimum_check;
ALTER TABLE public.withdrawal_requests ADD CONSTRAINT withdrawal_requests_minimum_check CHECK (amount >= 3000 AND COALESCE(fee_amount,0) = 0 AND COALESCE(net_amount, amount) = amount);
