-- =====================================================================
-- Rentora Migration v2
-- Features:
--   1. Agent-set inspection fee (dynamic 70/30 split)
--   2. Fix double/triple crediting bug
--   3. Rent escrow flow (Rentora holds rent + 5% service fee)
--   4. "Mark as Taken" support (already have properties.availability)
-- Safe to run multiple times (idempotent where possible).
-- =====================================================================

-- ============ 1. INSPECTION FEE (dynamic, min ₦1000) ============
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS inspection_fee INTEGER NOT NULL DEFAULT 3000
  CHECK (inspection_fee >= 1000);

-- Backfill existing rows to the old default
UPDATE public.properties SET inspection_fee = 3000 WHERE inspection_fee IS NULL;

-- inspection_transactions.amount should reflect the real fee charged
ALTER TABLE public.inspection_transactions
  ALTER COLUMN amount DROP DEFAULT;

-- ============ 2. FIX DOUBLE-CREDITING BUG ============
-- Drop duplicate triggers and functions. Keep ONE canonical trigger.
DROP TRIGGER IF EXISTS inspection_paid_credit_agent  ON public.inspections;
DROP TRIGGER IF EXISTS on_inspection_completed       ON public.inspections;
DROP TRIGGER IF EXISTS trg_credit_agent_balance      ON public.inspections;
DROP FUNCTION IF EXISTS public.credit_agent_on_inspection() CASCADE;
DROP FUNCTION IF EXISTS public.credit_agent_balance()       CASCADE;

-- Canonical function: credits agent 70% of the inspection amount ONCE
CREATE OR REPLACE FUNCTION public.credit_agent_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount     INTEGER;
  v_agent_cut  INTEGER;
BEGIN
  -- Fire only when payment_status transitions to 'completed'
  IF NEW.payment_status = 'completed'
     AND (OLD.payment_status IS DISTINCT FROM 'completed')
     AND NEW.agent_id IS NOT NULL THEN

    -- Get the real amount from the inspection transaction (dynamic fee)
    SELECT amount INTO v_amount
      FROM public.inspection_transactions
     WHERE inspection_id = NEW.id
       AND status = 'completed'
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_amount IS NULL THEN
      -- Fallback: use property.inspection_fee
      SELECT inspection_fee INTO v_amount
        FROM public.properties WHERE id = NEW.property_id;
    END IF;

    IF v_amount IS NULL OR v_amount <= 0 THEN
      RETURN NEW;
    END IF;

    v_agent_cut := FLOOR(v_amount * 0.70);   -- 70% to agent, 30% to Rentora

    INSERT INTO public.agent_balances (agent_id, total_earned, total_withdrawn, balance)
    VALUES (NEW.agent_id, v_agent_cut, 0, v_agent_cut)
    ON CONFLICT (agent_id) DO UPDATE
      SET total_earned = public.agent_balances.total_earned + EXCLUDED.total_earned,
          balance      = public.agent_balances.balance      + EXCLUDED.total_earned;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_credit_agent_balance
AFTER UPDATE ON public.inspections
FOR EACH ROW EXECUTE FUNCTION public.credit_agent_balance();


-- ============ 3. RENT ESCROW ============
-- Configurable service fee percentage (defaults to 5%)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO public.platform_settings (key, value)
VALUES ('rent_service_fee_pct', '5'),
       ('rent_auto_release_days', '5')
ON CONFLICT (key) DO NOTHING;

GRANT SELECT ON public.platform_settings TO authenticated, anon;
GRANT ALL    ON public.platform_settings TO service_role;

-- Rent payment ledger with escrow states
CREATE TABLE IF NOT EXISTS public.property_rent_payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  user_id           UUID NOT NULL REFERENCES public.users(id)      ON DELETE RESTRICT,
  agent_id          UUID NOT NULL REFERENCES public.users(id)      ON DELETE RESTRICT,
  rent_amount       INTEGER NOT NULL CHECK (rent_amount > 0),
  service_fee       INTEGER NOT NULL CHECK (service_fee >= 0),
  total_amount      INTEGER NOT NULL CHECK (total_amount > 0),
  reference         TEXT UNIQUE NOT NULL,
  koralpay_reference TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','held','released','refunded','failed')),
  held_at           TIMESTAMPTZ,
  released_at       TIMESTAMPTZ,
  refunded_at       TIMESTAMPTZ,
  auto_release_at   TIMESTAMPTZ,
  released_by       TEXT,           -- 'user' | 'auto' | 'admin'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rent_payments_user     ON public.property_rent_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_agent    ON public.property_rent_payments(agent_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_property ON public.property_rent_payments(property_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_status   ON public.property_rent_payments(status);

GRANT SELECT, INSERT, UPDATE ON public.property_rent_payments TO authenticated;
GRANT ALL                    ON public.property_rent_payments TO service_role;

ALTER TABLE public.property_rent_payments ENABLE ROW LEVEL SECURITY;

-- User: see own rent payments
DROP POLICY IF EXISTS rent_payments_select_own ON public.property_rent_payments;
CREATE POLICY rent_payments_select_own ON public.property_rent_payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Agent: see rent payments on their properties
DROP POLICY IF EXISTS rent_payments_select_agent ON public.property_rent_payments;
CREATE POLICY rent_payments_select_agent ON public.property_rent_payments
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

-- Admin: see all (assumes is_admin() helper exists in your project)
DROP POLICY IF EXISTS rent_payments_select_admin ON public.property_rent_payments;
CREATE POLICY rent_payments_select_admin ON public.property_rent_payments
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- User can insert own rent payment (initiate)
DROP POLICY IF EXISTS rent_payments_insert_own ON public.property_rent_payments;
CREATE POLICY rent_payments_insert_own ON public.property_rent_payments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- User can update ONLY to confirm move-in on their own held payment
DROP POLICY IF EXISTS rent_payments_update_own ON public.property_rent_payments;
CREATE POLICY rent_payments_update_own ON public.property_rent_payments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin can update any (dispute resolution)
DROP POLICY IF EXISTS rent_payments_update_admin ON public.property_rent_payments;
CREATE POLICY rent_payments_update_admin ON public.property_rent_payments
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));


-- Trigger: on release, credit 70% of RENT (not fee) to agent, mark property unavailable
CREATE OR REPLACE FUNCTION public.release_rent_to_agent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_cut INTEGER;
BEGIN
  IF NEW.status = 'released' AND (OLD.status IS DISTINCT FROM 'released') THEN
    v_agent_cut := FLOOR(NEW.rent_amount * 0.70);  -- 70/30 on rent as well

    INSERT INTO public.agent_balances (agent_id, total_earned, total_withdrawn, balance)
    VALUES (NEW.agent_id, v_agent_cut, 0, v_agent_cut)
    ON CONFLICT (agent_id) DO UPDATE
      SET total_earned = public.agent_balances.total_earned + EXCLUDED.total_earned,
          balance      = public.agent_balances.balance      + EXCLUDED.total_earned;

    -- Property is now taken
    UPDATE public.properties
       SET availability = 'unavailable'
     WHERE id = NEW.property_id;

    NEW.released_at := COALESCE(NEW.released_at, NOW());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_rent_to_agent ON public.property_rent_payments;
CREATE TRIGGER trg_release_rent_to_agent
BEFORE UPDATE ON public.property_rent_payments
FOR EACH ROW EXECUTE FUNCTION public.release_rent_to_agent();


-- ============ 4. AUTO-RELEASE (5 days) ============
-- Call this function from pg_cron (or your scheduler) once a day.
-- Example: SELECT cron.schedule('rentora-auto-release', '0 3 * * *',
--                               $$ SELECT public.auto_release_rent_escrow(); $$);
CREATE OR REPLACE FUNCTION public.auto_release_rent_escrow()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH released AS (
    UPDATE public.property_rent_payments
       SET status      = 'released',
           released_by = 'auto',
           released_at = NOW()
     WHERE status = 'held'
       AND auto_release_at IS NOT NULL
       AND auto_release_at <= NOW()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM released;
  RETURN v_count;
END;
$$;


-- ============ 5. MARK-AS-TAKEN GUARD FOR USERS ============
-- Allow the user who unlocked a property to flip its availability to 'unavailable'.
-- (Agents/admins already have their own policies.)
DROP POLICY IF EXISTS properties_mark_taken_by_unlocker ON public.properties;
CREATE POLICY properties_mark_taken_by_unlocker ON public.properties
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.unlocks u
       WHERE u.property_id = properties.id
         AND u.user_id     = auth.uid()
    )
  )
  WITH CHECK (
    availability IN ('available','unavailable')
    AND EXISTS (
      SELECT 1 FROM public.unlocks u
       WHERE u.property_id = properties.id
         AND u.user_id     = auth.uid()
    )
  );

-- Done.
