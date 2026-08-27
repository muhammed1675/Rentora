-- 1. Remove all direct access to users from anon
REVOKE ALL ON public.users FROM anon;

-- 2. Remove broad UPDATE access from authenticated users
REVOKE UPDATE ON public.users FROM authenticated;

-- 3. Give authenticated users only the profile fields they should be
--    able to update themselves.
GRANT UPDATE (
  full_name,
  phone,
  avatar_url
) ON public.users TO authenticated;

-- 4. Keep normal profile reading
GRANT SELECT ON public.users TO authenticated;

-- 5. Allow profile creation only if your application actually
--    inserts into public.users from the client.
GRANT INSERT (
  id,
  email,
  full_name,
  phone,
  avatar_url
) ON public.users TO authenticated;

-- Drop the overly broad self-update policy:
DROP POLICY IF EXISTS "users_can_update_own" ON public.users;

-- DROP POLICY IF EXISTS "users_can_update_own" ON public.users;
CREATE POLICY "users_can_update_own"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);