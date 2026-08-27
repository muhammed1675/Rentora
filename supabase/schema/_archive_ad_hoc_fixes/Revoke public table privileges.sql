-- first run this to revoke all privileges from the public tables for the anon and authenticated roles
REVOKE ALL ON TABLE
  public.wallets,
  public.agent_balances,
  public.agent_bank_details,
  public.agent_bank_change_requests,
  public.withdrawal_requests,
  public.transactions,
  public.property_rent_payments,
  public.inspection_transactions,
  public.korapay_webhook_events
FROM anon, authenticated;

-- then we restore the Role Grants for Public Tables
GRANT SELECT ON TABLE
  public.wallets,
  public.agent_balances,
  public.agent_bank_details,
  public.agent_bank_change_requests,
  public.withdrawal_requests,
  public.transactions,
  public.property_rent_payments,
  public.inspection_transactions
TO authenticated;