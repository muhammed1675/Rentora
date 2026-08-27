DROP POLICY IF EXISTS "users_update_admin" ON public.users;

CREATE POLICY "users_update_admin"
ON public.users
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());