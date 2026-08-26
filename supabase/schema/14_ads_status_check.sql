-- Rentora advertising status constraint patch
-- Run this in Supabase SQL Editor. It preserves the existing ads table and
-- allows the moderation lifecycle used by the application.

ALTER TABLE public.ads
DROP CONSTRAINT IF EXISTS ads_status_check;

ALTER TABLE public.ads
ADD CONSTRAINT ads_status_check
CHECK (
  status IN (
    'draft',
    'pending',
    'pending_review',
    'approved',
    'active',
    'rejected',
    'expired',
    'cancelled'
  )
);
