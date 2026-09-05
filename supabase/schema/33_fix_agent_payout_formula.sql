-- Rentora — Fix release_rent_to_agent() to pay out ALL agent-set fees.
--
-- BUG: when a rent payment moves from 'held' to 'released', this trigger
-- only credited (rent_amount + agent_fee + caution_fee) to agent_balances.
-- It was written before migration 22_final_payment_model.sql added
-- agreement_fee, documentation_fee, and other_fees_total to
-- property_rent_payments, and was never updated afterward. As a result,
-- tenants were charged for agreement/documentation/other fees, but that
-- money was never credited to the agent (or recorded anywhere else) —
-- exactly the mismatch the agent-facing emails already promise won't
-- happen ("The full rent and all disclosed property-related charges are
-- released together to your Rentora balance ... Rentora's only cut is a
-- separate service fee").
--
-- This migration corrects the formula to match that promise: the agent
-- gets everything EXCEPT service_fee (Rentora's only cut).
--
-- Safe to re-run. Only changes behavior for FUTURE releases — does not
-- touch any existing agent_balances rows or already-released payments.
-- (Confirmed with the team: no backfill wanted right now, still testing.)

CREATE OR REPLACE FUNCTION public.release_rent_to_agent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_payout NUMERIC;
BEGIN
  IF NEW.status = 'released' AND OLD.status = 'held' THEN
    v_total_payout := NEW.rent_amount
                     + NEW.agent_fee
                     + COALESCE(NEW.caution_fee, 0)
                     + COALESCE(NEW.agreement_fee, 0)
                     + COALESCE(NEW.documentation_fee, 0)
                     + COALESCE(NEW.inspection_fee, 0)
                     + COALESCE(NEW.other_fees_total, 0);

    INSERT INTO public.agent_balances (agent_id, total_earned, total_withdrawn)
    VALUES (NEW.agent_id, v_total_payout, 0)
    ON CONFLICT (agent_id) DO UPDATE
      SET total_earned = public.agent_balances.total_earned + EXCLUDED.total_earned;

    UPDATE public.properties
       SET availability = 'unavailable'
     WHERE id = NEW.property_id;

    NEW.released_at := COALESCE(NEW.released_at, NOW());
  END IF;

  RETURN NEW;
END;
$$;

-- Sanity check after running — this should print 0 rows if nothing else
-- changed unexpectedly:
-- select proname, prosecdef from pg_proc where proname = 'release_rent_to_agent';