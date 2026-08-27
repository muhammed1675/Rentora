DROP POLICY IF EXISTS "users_can_read_all" ON public.users;
DROP POLICY IF EXISTS "users_select_admin" ON public.users;
DROP POLICY IF EXISTS "users_select_own" ON public.users;

CREATE POLICY "users_select_own"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "users_select_admin"
ON public.users
FOR SELECT
TO authenticated
USING (is_admin());