-- ============================================================
-- RENTORA — fix: admin suspend blocked + agent "mark unavailable"
-- silently no-ops on approved listings
-- ============================================================

-- ------------------------------------------------------------
-- 1) Admin suspend / role change on public.users
--
-- Remove_all_direct_access_to_users_from_anon.sql narrowed
-- `authenticated`'s UPDATE grant to only (full_name, phone,
-- avatar_url). RLS (users_update_admin) already correctly lets
-- an admin through — but Postgres blocks at the column-privilege
-- check before RLS is even consulted, hence
-- "permission denied for table users".
-- ------------------------------------------------------------

GRANT UPDATE (role, suspended, deleted_at) ON public.users TO authenticated;

-- RLS still gates this: users_update_admin requires is_admin(),
-- so a non-admin authenticated user still can't touch these
-- columns on someone else's row. This only unblocks the admin's
-- own already-correct action.


-- ------------------------------------------------------------
-- 2) Agent "mark unavailable" on an approved listing
--
-- properties_update_own_agent_pending only matches status =
-- 'pending'. properties_mark_taken_by_unlocker depends on the
-- `unlocks` table, which is dead since the token/unlock system
-- was removed. Net effect: an agent updating an approved
-- listing's availability matches zero UPDATE policies, RLS
-- silently affects 0 rows, and the client shows a fake success.
-- ------------------------------------------------------------

CREATE POLICY "properties_update_own_agent_approved"
ON public.properties
FOR UPDATE
TO authenticated
USING (auth.uid() = uploaded_by_agent_id AND status = 'approved')
WITH CHECK (auth.uid() = uploaded_by_agent_id AND status = 'approved');

-- Safe to leave broad (not limited to just the availability
-- column) because your existing triggers already guard field-
-- level tampering on this table:
--   - reset_property_status_on_update: flips status back to
--     'pending' if title/price/description/etc change
--   - prevent_agent_self_approval: blocks the agent setting
--     status to approved/rejected themselves
--   - lock_taken_property_edits: blocks content edits once a
--     property has a paid rent record
-- Those already ran before this policy existed, so nothing new
-- opens up.


-- ------------------------------------------------------------
-- 3) Frontend follow-up (not SQL, do this in your app code):
-- Any .update(...).eq('id', ...) call that doesn't check the
-- returned row count/data will show a false "success" on a
-- 0-row RLS-blocked update, same as the availability bug above.
-- Add .select() and check the result length before toasting
-- success, at least on the properties and users update calls.
-- ------------------------------------------------------------
