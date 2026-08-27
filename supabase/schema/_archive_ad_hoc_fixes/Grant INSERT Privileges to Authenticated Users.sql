-- restore only the required INSERT permissions
GRANT INSERT ON TABLE
  public.agent_bank_change_requests,
  public.withdrawal_requests,
  public.property_rent_payments,
  public.inspection_transactions
TO authenticated;