-- =========================================================
-- Rentora — Restrict cross-user PII exposure on public.users
--
-- HOW TO APPLY: paste this whole file into Supabase Dashboard →
-- SQL Editor → New query → Run.
--
-- PROBLEM:
-- 09_refund_and_delete_fixes.sql tightened "users_can_read_all" to stop
-- *deleted* accounts from being readable by everyone — but the resulting
-- policy still reads:
--
--   USING (deleted_at IS NULL OR auth.uid() = id OR is_admin())
--
-- For any ACTIVE (non-deleted) account, "deleted_at IS NULL" alone makes
-- the whole USING clause true — regardless of who's asking. That means
-- literally anyone holding only the public anon key (no login required)
-- can read every active user's full_name, email, and phone via a direct
-- PostgREST call, e.g. GET /rest/v1/users?select=full_name,email,phone.
--
-- Confirmed in the frontend that agents' name+email ARE meant to be
-- publicly visible (shown on property listing pages so renters can reach
-- out — see storageAPI/propertyAPI callers of
-- `.from('users').select('email, full_name')...eq('id', uploaded_by_agent_id)`).
-- Regular renter/student accounts have no such public-facing use case —
-- nothing in the app looks up another user's row by anything other than
-- their own id, an admin context, or an agent's id specifically.
--
-- FIX: only agent/admin rows (their public-facing business identity) are
-- readable by everyone; everyone else's row is only visible to themselves,
-- an admin, OR an agent who has an actual paid booking from that renter
-- (needed so the Agent Dashboard can keep showing a renter's name/email/
-- phone once they've paid for that agent's property — see
-- api.js:getPaymentsForAgent). Phone numbers stop being blanket-readable
-- for anyone with no such relationship — the app doesn't currently surface
-- them beyond that one legitimate case, so narrowing this doesn't change
-- any other working feature; it just closes a direct-API-call route that
-- had no corresponding UI use.
-- =========================================================

DROP POLICY IF EXISTS "users_can_read_all" ON public.users;

CREATE POLICY "users_can_read_all" ON public.users FOR SELECT
  USING (
    (deleted_at IS NULL AND role IN ('agent', 'admin'))
    OR auth.uid() = id
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM public.property_rent_payments prp
      WHERE prp.user_id = users.id
        AND prp.agent_id = auth.uid()
    )
  );
