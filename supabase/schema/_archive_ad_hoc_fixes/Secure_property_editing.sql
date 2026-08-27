-- First, remove the broad agent UPDATE policy:

DROP POLICY IF EXISTS "properties_update_own_agent"
ON public.properties;

-- Then create a restricted policy allowing an agent to update their own listing only while it is pending:

CREATE POLICY "properties_update_own_agent_pending"
ON public.properties
FOR UPDATE
TO authenticated
USING (
  auth.uid() = uploaded_by_agent_id
  AND status = 'pending'
)
WITH CHECK (
  auth.uid() = uploaded_by_agent_id
  AND status = 'pending'
);