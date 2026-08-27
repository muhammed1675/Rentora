-- STEP 4: Secure review creation

DROP POLICY IF EXISTS "reviews_insert_own"
ON public.reviews;

CREATE POLICY "reviews_insert_authenticated_own"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
);

CREATE POLICY "reviews_select_public"
ON public.reviews
FOR SELECT
TO anon, authenticated
USING (true);