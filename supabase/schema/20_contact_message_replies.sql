-- Run this once in the Supabase SQL editor (or via `supabase db execute`).
--
-- The admin dashboard's Messages tab has a "Reply to {name}" composer that
-- sends an email (via frontend/api/send-reply.js) but never saved the
-- reply anywhere — so as soon as the admin navigated away or refreshed,
-- there was no record the message had been replied to, and no way to see
-- what was said. This adds columns to store the latest admin reply
-- directly on the message it answers.

ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS admin_reply text,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS replied_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.contact_messages.admin_reply IS
  'Text of the most recent admin reply sent to this message, if any.';
COMMENT ON COLUMN public.contact_messages.replied_at IS
  'When the admin reply was sent.';
COMMENT ON COLUMN public.contact_messages.replied_by IS
  'Which admin user sent the reply.';
COMMENT ON COLUMN public.contact_messages.phone IS
  'Phone number the sender provided on the contact form, so admins can call/WhatsApp instead of only emailing.';