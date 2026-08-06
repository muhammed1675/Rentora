-- =========================================================
-- Rentora — Verification checkpoint + agent invites
--
-- Turns the student-verification "wall" into a checkpoint:
--   - Browsing every page never requires verification.
--   - Paying rent always requires approved (no exceptions).
--   - A pending (submitted, not yet reviewed) student may still
--     be treated as "has started verification" for lower-stakes
--     actions if the product later needs that distinction.
--   - Agent applications move behind an invite-only, single-use
--     link instead of a public page.
--
-- Safe to run more than once.
-- =========================================================

-- ── has_started_verification() ──────────────────────────
-- True for approved OR pending students, and for agents/admins
-- (who use the separate agent flow and are never gated here).
-- Kept alongside is_verified_student() (approved-only) so any
-- future policy that wants to allow "submitted, still under
-- review" users through can opt into the looser check without
-- touching the strict one that payments rely on.
CREATE OR REPLACE FUNCTION public.has_started_verification()
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
       AND (u.role IN ('agent', 'admin') OR u.verification_status IN ('approved', 'pending'))
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_started_verification() TO authenticated;

-- NOTE: property_rent_payments, inspections, property_reviews and
-- property_reports stay on the strict public.is_verified_student()
-- policies from 07_student_verification.sql — payments and these
-- actions require approved, no exceptions. Only a future "unlock
-- contact" write path would repoint to has_started_verification();
-- that feature isn't built yet, so nothing changes on the unlocks
-- table here.

-- ── agent_invites ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    created_by uuid NOT NULL REFERENCES auth.users(id),
    email text,
    expires_at timestamptz NOT NULL,
    used_by uuid REFERENCES auth.users(id),
    used_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_invites_code ON public.agent_invites (code);
CREATE INDEX IF NOT EXISTS idx_agent_invites_created_by ON public.agent_invites (created_by);

ALTER TABLE public.agent_invites ENABLE ROW LEVEL SECURITY;

-- No policy grants SELECT/INSERT/UPDATE/DELETE to plain authenticated
-- users — only admins can read or manage the table directly. Everyone
-- else goes through the two SECURITY DEFINER functions below, which
-- never expose the full row (no email, no created_by) to the caller.
DROP POLICY IF EXISTS "agent_invites_admin_all" ON public.agent_invites;
CREATE POLICY "agent_invites_admin_all" ON public.agent_invites
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_invites TO authenticated;
GRANT ALL ON public.agent_invites TO service_role;

-- ── check_agent_invite(code) ─────────────────────────────
-- Read-only validity check for rendering /become-agent — never
-- returns table contents, just whether the code currently works.
CREATE OR REPLACE FUNCTION public.check_agent_invite(p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agent_invites
     WHERE code = p_code
       AND used_by IS NULL
       AND revoked_at IS NULL
       AND expires_at > now()
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_agent_invite(text) TO authenticated;

-- ── redeem_agent_invite(code) ────────────────────────────
-- Atomically marks a code used by the current caller. Called when
-- the agent application is actually submitted (not just viewed), so
-- a copied form can't be posted without a still-valid invite, and a
-- code can't be redeemed twice even under concurrent requests.
CREATE OR REPLACE FUNCTION public.redeem_agent_invite(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE public.agent_invites
     SET used_by = auth.uid(),
         used_at = now()
   WHERE code = p_code
     AND used_by IS NULL
     AND revoked_at IS NULL
     AND expires_at > now();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_agent_invite(text) TO authenticated;

-- NOTE on agent listing writes: public.properties already requires
-- is_agent_or_admin() on INSERT/UPDATE (see 04_policies.sql), which
-- is role = 'agent' — role only flips to 'agent' once an admin
-- approves an agent_verification_requests row. No change needed
-- there; a redeemed invite only unlocks the application form, not
-- listing rights.
