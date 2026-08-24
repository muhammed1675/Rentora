-- =========================================================
-- Rentora — Student verification (school document + selfie)
--
-- Adds a mandatory verification step for student accounts.
-- Nothing here touches inspection fee tables/columns: the
-- inspection fee is only being switched off in the app, so
-- all historical rows stay exactly as they are.
--
-- Safe to run more than once.
-- =========================================================

-- ── users.verification_status ───────────────────────────
-- 'none' | 'pending' | 'approved' | 'rejected'
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'none';

-- Existing accounts must not be locked out by this release.
UPDATE public.users
   SET verification_status = 'approved'
 WHERE verification_status = 'none';

-- New signups start unverified.
ALTER TABLE public.users
  ALTER COLUMN verification_status SET DEFAULT 'none';

-- ── student_verification_requests ───────────────────────
CREATE TABLE IF NOT EXISTS public.student_verification_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name text,
    user_email text,
    document_type text NOT NULL DEFAULT 'student_id',  -- 'student_id' | 'admission_letter'
    document_url text NOT NULL,
    selfie_url text NOT NULL,
    matric_number text,
    status text NOT NULL DEFAULT 'pending',            -- 'pending' | 'approved' | 'rejected'
    admin_note text,
    reviewed_by_admin_id uuid,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.student_verification_requests TO authenticated;
GRANT ALL ON public.student_verification_requests TO service_role;

ALTER TABLE public.student_verification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "svr_insert_own" ON public.student_verification_requests;
CREATE POLICY "svr_insert_own" ON public.student_verification_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "svr_select_own_or_admin" ON public.student_verification_requests;
CREATE POLICY "svr_select_own_or_admin" ON public.student_verification_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "svr_update_admin" ON public.student_verification_requests;
CREATE POLICY "svr_update_admin" ON public.student_verification_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_svr_user_id ON public.student_verification_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_svr_status ON public.student_verification_requests (status, created_at DESC);

-- ── is_verified_student() ───────────────────────────────
-- Backend enforcement helper. Agents and admins are exempt:
-- they go through the existing agent verification flow.
CREATE OR REPLACE FUNCTION public.is_verified_student()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.users u
     WHERE u.id = auth.uid()
       AND u.suspended = false
       AND (u.role IN ('agent', 'admin') OR u.verification_status = 'approved')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_verified_student() TO authenticated;

-- ── Enforce verification on housing actions ─────────────
-- Reads stay open; only authenticated writes are gated, so a
-- bypassed UI still cannot create data.

-- Viewing requests (table name kept as `inspections`)
DROP POLICY IF EXISTS "insp_insert_verified_student" ON public.inspections;
CREATE POLICY "insp_insert_verified_student" ON public.inspections
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_verified_student());

-- Rent payments (escrow flow unchanged, just gated)
DROP POLICY IF EXISTS "rent_insert_verified_student" ON public.property_rent_payments;
CREATE POLICY "rent_insert_verified_student" ON public.property_rent_payments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_verified_student());

-- Saved / unlocked properties
DROP POLICY IF EXISTS "unlocks_insert_verified_student" ON public.unlocks;
CREATE POLICY "unlocks_insert_verified_student" ON public.unlocks
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_verified_student());

-- Reviews and reports
DROP POLICY IF EXISTS "reviews_insert_verified_student" ON public.property_reviews;
CREATE POLICY "reviews_insert_verified_student" ON public.property_reviews
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_verified_student());

DROP POLICY IF EXISTS "reports_insert_verified_student" ON public.property_reports;
CREATE POLICY "reports_insert_verified_student" ON public.property_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND public.is_verified_student());

-- NOTE: remove any older permissive INSERT policies on the tables above
-- (e.g. "Allow insert" style policies) so the verified check cannot be
-- side-stepped through a second, wider policy.

-- ── Storage: school documents live in the private
-- `verification` bucket, selfies in the public `avatars` bucket.
-- Both buckets and their policies already exist (06_storage.sql).
