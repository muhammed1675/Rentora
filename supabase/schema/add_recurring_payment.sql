-- Run this once in the Supabase SQL editor (or via `supabase db execute`)
-- to add the new display-only "Recurring Payment" field to properties.
--
-- This is NOT wired into any payment/escrow logic — it's a value the agent
-- types in when listing a property, shown to students on the property page
-- so they know what to expect to pay after their first payment (e.g. next
-- year's rent, a recurring subscription/service charge, etc). Rentora does
-- not collect this amount.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS recurring_payment numeric;

COMMENT ON COLUMN public.properties.recurring_payment IS
  'Display-only amount the agent enters — what the student will pay after their first payment (e.g. next year''s rent). Not processed by Rentora.';
