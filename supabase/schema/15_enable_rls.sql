-- =========================================================
-- Rentora — Enable RLS on tables that have policies defined
-- in 04_policies.sql but were never explicitly enabled.
--
-- Without ENABLE ROW LEVEL SECURITY, the CREATE POLICY
-- statements in 04_policies.sql are inert: any client holding
-- the anon key can read/write these tables directly, bypassing
-- every policy defined for them.
--
-- Safe to run multiple times — ENABLE ROW LEVEL SECURITY is
-- idempotent in Postgres (no error if already enabled).
-- =========================================================

ALTER TABLE public.agent_balances               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_bank_change_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_bank_details            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_verification_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_rent_payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_reports              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_reviews              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unlocks                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests           ENABLE ROW LEVEL SECURITY;

-- Sanity check: after running this, every table below should show
-- rowsecurity = true. Run this SELECT in the Supabase SQL editor
-- to confirm live status before/after applying:
--
-- SELECT relname, relrowsecurity
-- FROM pg_class
-- WHERE relname IN (
--   'agent_balances','agent_bank_change_requests','agent_bank_details',
--   'agent_verification_requests','contact_messages','inspection_transactions',
--   'inspections','locations','notification_queue','platform_settings',
--   'properties','property_rent_payments','property_reports','property_reviews',
--   'reviews','transactions','unlocks','users','wallets','withdrawal_requests'
-- )
-- ORDER BY relname;
