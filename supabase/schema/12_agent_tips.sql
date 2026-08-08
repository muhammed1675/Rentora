-- =========================================================
-- Rentora — Migration: tip an agent (replaces the old "Payment:
-- not_required" label on free viewings)
--
-- THIS FILE IS a runnable migration (see note in 09_...). Run it
-- once, in full, via Supabase Dashboard → SQL Editor.
--
-- Background: viewings are free now, so there's nothing left to
-- pay for on a viewing request. Instead, a student can optionally
-- send the assigned agent a one-off tip after requesting a
-- viewing. Money flows straight to the agent's Rentora balance —
-- Rentora takes no cut of tips.
--
-- Rules enforced here:
--   1. A tip can only be made ONCE per viewing (inspection).
--      Enforced at the DB level with a partial unique index on
--      inspection_id WHERE status = 'completed', so even a race
--      between two tabs can't produce two paid tips on the same
--      viewing.
--   2. The agent's balance is only credited once the tip payment
--      is actually verified server-side (frontend/api/confirm-
--      payment.js) and the row transitions to status='completed'
--      — never on the client's say-so. Same pattern as every
--      other payment type in this app.
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- 1. Table
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inspection_tips (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    inspection_id uuid NOT NULL REFERENCES public.inspections(id),
    user_id uuid NOT NULL REFERENCES public.users(id),
    agent_id uuid NOT NULL REFERENCES public.users(id),
    amount integer NOT NULL,
    reference text NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

ALTER TABLE public.inspection_tips
  DROP CONSTRAINT IF EXISTS inspection_tips_status_check;
ALTER TABLE public.inspection_tips
  ADD CONSTRAINT inspection_tips_status_check
  CHECK (status IN ('pending', 'completed'));

ALTER TABLE public.inspection_tips
  DROP CONSTRAINT IF EXISTS inspection_tips_amount_check;
ALTER TABLE public.inspection_tips
  ADD CONSTRAINT inspection_tips_amount_check
  CHECK (amount > 0);

-- One PAID tip per viewing, ever. A student can retry a failed/pending
-- tip attempt freely (those don't hit this index), but once one
-- actually completes, no more rows for that inspection_id can reach
-- status='completed'.
CREATE UNIQUE INDEX IF NOT EXISTS inspection_tips_one_completed_per_inspection
  ON public.inspection_tips (inspection_id)
  WHERE (status = 'completed');

CREATE INDEX IF NOT EXISTS inspection_tips_user_id_idx ON public.inspection_tips (user_id);
CREATE INDEX IF NOT EXISTS inspection_tips_agent_id_idx ON public.inspection_tips (agent_id);
CREATE INDEX IF NOT EXISTS inspection_tips_reference_idx ON public.inspection_tips (reference);

-- ─────────────────────────────────────────────────────────
-- 2. RLS
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.inspection_tips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspection_tips_insert_own" ON public.inspection_tips;
CREATE POLICY "inspection_tips_insert_own" ON public.inspection_tips FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "inspection_tips_select_own" ON public.inspection_tips;
CREATE POLICY "inspection_tips_select_own" ON public.inspection_tips FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "inspection_tips_select_agent" ON public.inspection_tips;
CREATE POLICY "inspection_tips_select_agent" ON public.inspection_tips FOR SELECT
  USING (agent_id = auth.uid());

DROP POLICY IF EXISTS "inspection_tips_select_admin" ON public.inspection_tips;
CREATE POLICY "inspection_tips_select_admin" ON public.inspection_tips FOR SELECT
  USING (public.is_admin());

-- No UPDATE policy for anyone client-side — only /api/confirm-payment.js,
-- using the service-role key (which bypasses RLS entirely), is allowed to
-- flip a tip from 'pending' to 'completed'. This mirrors how
-- property_rent_payments and inspection_transactions are locked down.

-- ─────────────────────────────────────────────────────────
-- 3. Credit the agent's balance the moment a tip is confirmed paid.
--    Mirrors credit_agent_balance() (02_functions_reference.sql) but
--    keyed off inspection_tips instead of inspections.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.credit_agent_tip_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    INSERT INTO public.agent_balances (agent_id, total_earned, total_withdrawn)
    VALUES (NEW.agent_id, NEW.amount, 0)
    ON CONFLICT (agent_id) DO UPDATE
      SET total_earned = public.agent_balances.total_earned + EXCLUDED.total_earned;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_credit_agent_tip_balance ON public.inspection_tips;
CREATE TRIGGER trg_credit_agent_tip_balance
  AFTER UPDATE ON public.inspection_tips
  FOR EACH ROW EXECUTE FUNCTION public.credit_agent_tip_balance();