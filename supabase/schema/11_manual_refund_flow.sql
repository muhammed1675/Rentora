-- =========================================================
-- Rentora — Migration: manual refund flow
--
-- THIS FILE IS a runnable migration (see note in 09_...). Run it
-- once, in full, via Supabase Dashboard → SQL Editor.
--
-- Background: admin-refund-payment.js used to call Flutterwave's
-- refund API server-side. That call proved unreliable (slow /
-- 502s), leaving payments stuck in 'refund_processing' with no
-- money actually returned and no way to retry from the UI.
--
-- The endpoint no longer calls Flutterwave at all. The admin now
-- sends the refund manually (bank transfer) and clicks "Refund &
-- Remove Listing" purely to RECORD it — who did it, when, why,
-- and an optional internal note. It also now accepts a payment
-- already stuck in 'refund_processing' from the old flow, so any
-- payment left hanging by that version can be resolved in one
-- click instead of being stuck forever.
-- =========================================================

ALTER TABLE public.property_rent_payments
  ADD COLUMN IF NOT EXISTS admin_note text;