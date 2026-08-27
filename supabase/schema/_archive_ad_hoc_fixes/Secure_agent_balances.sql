-- STEP 7: Make agent balances server/admin controlled

DROP POLICY IF EXISTS "agent_balances_insert_own"
ON public.agent_balances;

DROP POLICY IF EXISTS "agent_balances_insert_admin"
ON public.agent_balances;

DROP POLICY IF EXISTS "agent_balances_update_admin"
ON public.agent_balances;

CREATE POLICY "agent_balances_update_admin"
ON public.agent_balances
FOR UPDATE
TO authenticated
USING (
  is_admin()
)
WITH CHECK (
  is_admin()
);