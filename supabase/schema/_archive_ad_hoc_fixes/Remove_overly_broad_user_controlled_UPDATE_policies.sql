-- STEP 3: Remove overly broad user-controlled UPDATE policies

DROP POLICY IF EXISTS "inspections_update_agent"
ON public.inspections;

DROP POLICY IF EXISTS "rent_payments_update_own"
ON public.property_rent_payments;

DROP POLICY IF EXISTS "properties_update_own_agent"
ON public.properties;

DROP POLICY IF EXISTS "users_update_own"
ON public.users;

DROP POLICY IF EXISTS "Users can update their own notifications"
ON public.user_notifications;

DROP POLICY IF EXISTS "user_notifications_update_own"
ON public.user_notifications;