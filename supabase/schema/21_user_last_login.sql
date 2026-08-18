-- Run this once in the Supabase SQL editor (or via `supabase db execute`).
--
-- Adds a last_login_at column to public.users and keeps it in sync with
-- Supabase Auth's own last_sign_in_at, so the admin dashboard can show
-- when each user was last active without needing the service-role key on
-- the client (auth.users isn't directly readable by the app; this trigger
-- copies the one field we need into a table admins already have RLS
-- access to).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

COMMENT ON COLUMN public.users.last_login_at IS
  'Mirrors auth.users.last_sign_in_at — updated automatically by the sync_last_login trigger on every sign-in.';

-- One-time backfill from existing auth data.
UPDATE public.users u
SET last_login_at = a.last_sign_in_at
FROM auth.users a
WHERE a.id = u.id
  AND a.last_sign_in_at IS NOT NULL;

-- Keep it in sync going forward: auth.users.last_sign_in_at updates on
-- every successful sign-in, so mirror it into public.users whenever it
-- changes.
CREATE OR REPLACE FUNCTION public.sync_last_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET last_login_at = NEW.last_sign_in_at
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at)
  EXECUTE FUNCTION public.sync_last_login();