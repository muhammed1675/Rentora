-- =========================================================
-- Rentora — Migration: status/payment_status check-constraint fixes
--
-- THIS FILE IS a runnable migration (see note in 09_...). Run it
-- once, in full, via Supabase Dashboard → SQL Editor.
--
-- Background: several check constraints on the live DB predate
-- later feature changes and don't allow all the values the app
-- now writes, so those writes fail with a check-constraint
-- violation. This migration widens the constraints and documents
-- the full allowed value set here in the repo (previously these
-- constraints only existed on the live DB, invisible in git).
--
-- Part 1: viewings were made free (frontend/src/lib/api.js,
-- inspectionAPI.request) and now insert status: 'confirmed',
-- payment_status: 'not_required', which the old constraints didn't allow.
--
-- Part 2: the refund flow (frontend/api/admin-refund-payment.js)
-- locks a payment by setting status: 'refund_processing' before
-- calling Flutterwave, which the old constraint didn't allow.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- 1. inspections.payment_status
--    Allowed values used in code:
--      'pending'      — legacy paid-viewing flow, before payment
--      'completed'    — legacy paid-viewing flow, payment confirmed
--                        (frontend/api/confirm-payment.js)
--      'not_required' — current free-viewing flow (api.js inspectionAPI.request)
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.inspections
  DROP CONSTRAINT IF EXISTS inspections_payment_status_check;

ALTER TABLE public.inspections
  ADD CONSTRAINT inspections_payment_status_check
  CHECK (payment_status IN ('pending', 'completed', 'not_required'));

-- ─────────────────────────────────────────────────────────
-- 2. inspections.status
--    Allowed values used in code:
--      'pending'   — legacy paid-viewing flow, before payment
--      'confirmed' — current free-viewing flow, set immediately on request
--      'assigned'  — legacy paid-viewing flow, after payment confirmed
--                    (frontend/api/confirm-payment.js)
--      'completed' — agent marks the viewing done (AgentDashboard.jsx)
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.inspections
  DROP CONSTRAINT IF EXISTS inspections_status_check;

ALTER TABLE public.inspections
  ADD CONSTRAINT inspections_status_check
  CHECK (status IN ('pending', 'confirmed', 'assigned', 'completed'));

-- ─────────────────────────────────────────────────────────
-- 3. property_rent_payments.status
--    Allowed values used in code:
--      'pending'            — created, awaiting payment (confirm-payment.js)
--      'held'                — payment confirmed, funds held in escrow
--      'move_in_reported'    — student confirmed move-in (api.js reportMoveIn)
--      'released'            — funds released to agent (api.js confirmMoveIn / auto-release)
--      'refund_processing'   — admin refund in progress, locked (admin-refund-payment.js)
--      'refunded'            — refund completed (admin-refund-payment.js)
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.property_rent_payments
  DROP CONSTRAINT IF EXISTS property_rent_payments_status_check;

ALTER TABLE public.property_rent_payments
  ADD CONSTRAINT property_rent_payments_status_check
  CHECK (status IN ('pending', 'held', 'move_in_reported', 'released', 'refund_processing', 'refunded'));