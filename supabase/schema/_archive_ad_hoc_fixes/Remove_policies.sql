-- STEP 1: Remove policies that bypass verification requirements

DROP POLICY IF EXISTS "inspections_insert_own"
ON public.inspections;

DROP POLICY IF EXISTS "rent_payments_insert_own"
ON public.property_rent_payments;

DROP POLICY IF EXISTS "reports_insert_own"
ON public.property_reports;

DROP POLICY IF EXISTS "Users can insert own reviews"
ON public.property_reviews;

DROP POLICY IF EXISTS "unlocks_insert_own"
ON public.unlocks;