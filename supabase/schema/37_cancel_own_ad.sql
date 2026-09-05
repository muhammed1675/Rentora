-- Rentora — Let an advertiser cancel their own campaign once it has ended.
--
-- Why an RPC instead of a client-side update: ads has no advertiser-facing
-- UPDATE policy (only "Admins manage ads" can UPDATE — see 04_policies.sql)
-- so a plain supabase.from('ads').update(...) from the dashboard would be
-- blocked by RLS. This SECURITY DEFINER function does the one narrow thing
-- the dashboard's "Cancel" button needs: mark a campaign 'cancelled', but
-- only for the ad's own owner, and only once it has actually finished
-- running (ends_at in the past). Nothing else about ads' RLS changes.
--
-- Note: there's no cron job that flips status to 'expired' when ends_at
-- passes — the dashboard's "Expired" badge is computed purely from
-- ends_at vs. now(). So this checks ends_at directly rather than
-- status = 'expired', which would never match.
--
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.cancel_own_ad(p_ad_id uuid)
RETURNS public.ads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ad public.ads;
BEGIN
  SELECT * INTO v_ad FROM public.ads WHERE id = p_ad_id FOR UPDATE;

  IF v_ad.id IS NULL THEN
    RAISE EXCEPTION 'Ad not found';
  END IF;
  IF v_ad.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to cancel this ad';
  END IF;
  IF v_ad.status = 'cancelled' THEN
    RETURN v_ad; -- already cancelled, nothing to do
  END IF;
  IF v_ad.ends_at IS NULL OR v_ad.ends_at > now() THEN
    RAISE EXCEPTION 'Only campaigns that have already ended can be cancelled here';
  END IF;

  UPDATE public.ads SET status = 'cancelled' WHERE id = p_ad_id RETURNING * INTO v_ad;
  RETURN v_ad;
END;
$$;

-- Owner-only, enforced inside the function itself — no broader exposure
-- from granting this to every logged-in user.
REVOKE ALL ON FUNCTION public.cancel_own_ad(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_own_ad(uuid) TO authenticated;