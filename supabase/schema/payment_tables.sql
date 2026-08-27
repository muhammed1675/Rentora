-- STEP 5: Remove client-side write access to financial records

DROP POLICY IF EXISTS "transactions_insert_own"
ON public.transactions;

DROP POLICY IF EXISTS "wallets_insert_own"
ON public.wallets;

DROP POLICY IF EXISTS "agent_balances_update_admin"
ON public.agent_balances;

DROP POLICY IF EXISTS "rent_payments_insert_own"
ON public.property_rent_payments;