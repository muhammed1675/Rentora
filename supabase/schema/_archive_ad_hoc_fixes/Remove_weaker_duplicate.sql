-- STEP 2: Remove weaker duplicate INSERT/WRITE policies
-- that bypass the intended verification/security checks.

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

DROP POLICY IF EXISTS "reviews_insert_own"
ON public.reviews;

DROP POLICY IF EXISTS "reviews_own_write"
ON public.reviews;