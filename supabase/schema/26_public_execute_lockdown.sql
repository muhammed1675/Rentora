-- ============================================================
-- RENTORA SECURITY HARDENING (cont'd)
-- Closes out the Supabase advisor's SECURITY DEFINER warnings
-- by extending the REVOKE-FROM-PUBLIC pattern already started
-- in Rentora_security_hardening_plan.sql to every remaining
-- flagged function.
--
-- Do NOT run this blindly against prod. Run block by block,
-- retest the relevant flow (admin broadcast, agent signup,
-- property edit, etc.) after each block.
-- ============================================================


-- ------------------------------------------------------------
-- A) TRIGGER-ONLY functions — never called via client RPC.
-- Revoke entirely; triggers keep firing regardless (trigger
-- execution doesn't need EXECUTE granted to the calling role).
-- ------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_last_login() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_user_suspended() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_taken_property_edits() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_owner_details_after_set() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_agent_self_approval() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restrict_self_profile_edits() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.block_inspection_on_taken_property() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.flag_possible_duplicate_property() FROM PUBLIC, anon, authenticated;

-- After this block: test signup, property edit-after-approval,
-- agent self-edit of a listing, and marking a property taken.


-- ------------------------------------------------------------
-- B) Admin-action RPCs called from the logged-in admin's own
-- browser session. Keep on `authenticated` — the internal
-- is_admin() check is what actually gates them, not the grant.
-- Do NOT move these to service_role or the admin dashboard
-- breaks (it calls these with the admin's own JWT, not a
-- service key).
-- ------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.send_broadcast(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_broadcast(text, text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.broadcast_reach(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_reach(uuid) TO authenticated;

-- approve_ad / reject_ad are NOT in the tracked schema files —
-- pull their real CREATE FUNCTION statement from
-- Dashboard > Database > Functions first, confirm they call
-- is_admin() internally the same way send_broadcast does, THEN
-- uncomment and run:
-- REVOKE EXECUTE ON FUNCTION public.approve_ad(uuid) FROM PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.approve_ad(uuid) TO authenticated;
-- REVOKE EXECUTE ON FUNCTION public.reject_ad(uuid) FROM PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.reject_ad(uuid) TO authenticated;

-- After this block: test sending a broadcast and approving/
-- rejecting an ad as admin; confirm a non-admin authenticated
-- user still gets rejected by the internal check, not a 403
-- from Postgres.


-- ------------------------------------------------------------
-- C) Signed-in-user helper RPCs — currently callable by anon
-- for no reason. Lock to authenticated.
-- ------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.check_agent_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_agent_invite(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.redeem_agent_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_agent_invite(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_agent_or_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_agent_or_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.find_possible_duplicate_properties(text, text, integer, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_possible_duplicate_properties(text, text, integer, text, uuid, uuid) TO authenticated;

-- email_exists / increment_ad_click are also NOT in the tracked
-- schema files. Check WHY email_exists needs anon before
-- touching it: if it's used on the signup form to warn "this
-- email is already registered" before the user has an account,
-- anon access is intentional and correct — leave it. If it's
-- only ever called after login, lock it down like the others
-- above. increment_ad_click, by contrast, almost certainly does
-- need anon (ads are shown to logged-out visitors too) — that
-- one is very likely fine as-is; just confirm its body doesn't
-- also expose more than a click counter.


-- ------------------------------------------------------------
-- D) Stop this from happening again on every future function.
-- Postgres's default is EXECUTE-to-PUBLIC on CREATE FUNCTION;
-- flip the default so new functions start locked down and you
-- explicitly opt roles in.
-- ------------------------------------------------------------

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
