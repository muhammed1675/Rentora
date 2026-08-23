-- =========================================================
-- Rentora — Migration: refund flow + property soft-delist +
-- deleted-account visibility lockdown
--
-- Unlike 01-08 (which are a reconstructed snapshot of the live
-- DB for reference), THIS FILE IS a runnable migration. Run it
-- once, in full, via Supabase Dashboard → SQL Editor.
-- It is written to be safe to re-run (IF NOT EXISTS / OR REPLACE
-- everywhere) if you need to.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- 1. New columns on property_rent_payments for the refund flow
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.property_rent_payments
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS refunded_by text; -- admin's email/name, same style as `released_by`

-- ─────────────────────────────────────────────────────────
-- 2. reserve_property_on_rent_hold — STOP auto-reopening the
--    property on refund.
--
--    Previously: held -> refunded automatically flipped the
--    property back to availability = 'available'. That's wrong
--    for the "agent listed a house that isn't actually
--    available" case, which is the main reason a held payment
--    gets refunded. The admin refund action (see
--    admin-refund-payment.js) now explicitly sets the
--    property's status to 'rejected' as part of the same
--    resolution — so it should NOT also silently become
--    bookable again. Availability is left untouched here; the
--    admin decides what happens to the listing.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reserve_property_on_rent_hold()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'held' AND (OLD.status IS DISTINCT FROM 'held') THEN
    UPDATE public.properties SET availability = 'unavailable' WHERE id = NEW.property_id;
  END IF;
  -- NOTE: the old ELSIF branch that auto-set availability = 'available'
  -- on refund has been intentionally removed. See comment above.
  RETURN NEW;
END;
$function$;

-- ─────────────────────────────────────────────────────────
-- 3. prevent_reopening_reserved_property — also block reopening
--    while a refund is actively processing (defense in depth,
--    on top of #2 above).
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.prevent_reopening_reserved_property()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  -- Admins are trusted to relist a property after a tenancy legitimately ends.
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.availability = 'available' AND OLD.availability IS DISTINCT FROM 'available' THEN
    IF EXISTS (
      SELECT 1 FROM public.property_rent_payments
      WHERE property_id = NEW.id AND status IN ('held', 'released', 'refund_processing')
    ) THEN
      RAISE EXCEPTION 'Cannot reopen this property — it has a paid rent record (held, released, or refunding). Contact an admin to relist it.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ─────────────────────────────────────────────────────────
-- 4. Deleted-account visibility lockdown.
--
--    "users_can_read_all" currently lets ANY authenticated user
--    read EVERY column of EVERY user row (USING (true)) — that
--    includes deleted users. Since Postgres OR's together all
--    permissive policies on the same table/action, this one
--    policy alone made the more careful "own row" / "admin only"
--    policies pointless for deleted accounts.
--
--    Fix: once an account is deleted (deleted_at IS NOT NULL),
--    its row is only visible to admins (or, in principle, the
--    user themself — moot in practice since their auth login is
--    removed at the same time). Everyone else's queries simply
--    won't see that row at all — no separate column-masking
--    needed. This is what makes it possible to keep full_name /
--    phone / verification docs intact in the row (see the
--    delete-account edge function fix) for schools / EFCC /
--    legal requests, while the rest of the app never sees them.
-- ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_can_read_all" ON public.users;
CREATE POLICY "users_can_read_all" ON public.users FOR SELECT
  USING (deleted_at IS NULL OR auth.uid() = id OR is_admin());

-- ─────────────────────────────────────────────────────────
-- Verify deleted_at exists (it's referenced above and already
-- used by delete-account/index.ts — this is just a safety net
-- in case this migration is ever run against a DB that predates
-- that column).
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
