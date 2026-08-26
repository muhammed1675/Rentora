-- Adds a dedicated message body for advertisement copy.
-- Run this in Supabase SQL Editor before deploying the frontend changes.

ALTER TABLE public.ads
ADD COLUMN IF NOT EXISTS message_body text;

COMMENT ON COLUMN public.ads.message_body IS 'Long-form advertiser message shown on the ad preview page.';

UPDATE public.ads
SET message_body = NULLIF(split_part(ad_text, ' — ', 2), '')
WHERE message_body IS NULL
  AND ad_text IS NOT NULL
  AND position(' — ' in ad_text) > 0;
