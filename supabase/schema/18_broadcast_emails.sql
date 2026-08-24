-- =========================================================
-- Rentora — Email delivery log for admin broadcasts
--
-- Companion to 13_admin_broadcasts.sql. When an admin ticks
-- "Also send this as an email", /api/broadcast-email fans the broadcast out
-- to every matching user's email address. This table is the *claim ticket*
-- for that fan-out: broadcast_id is the PRIMARY KEY, so a second call for
-- the same broadcast (double click, retried request, refreshed tab) hits a
-- unique violation and the endpoint returns already_sent instead of emailing
-- thousands of people twice.
--
-- HOW TO APPLY: paste this whole file into Supabase Dashboard →
-- SQL Editor → New query → Run. Safe to re-run.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.broadcast_email_sends (
    broadcast_id uuid PRIMARY KEY REFERENCES public.admin_broadcasts(id) ON DELETE CASCADE,
    sent_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    target text NOT NULL DEFAULT 'all' CHECK (target IN ('all', 'user', 'agent')),
    recipients int NOT NULL DEFAULT 0,
    sent int NOT NULL DEFAULT 0,
    failed int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz
);

ALTER TABLE public.broadcast_email_sends ENABLE ROW LEVEL SECURITY;

-- Written only by the server (service role bypasses RLS). Admins may read the
-- log so the panel can show "emailed · 412 sent" next to a broadcast.
DROP POLICY IF EXISTS "broadcast_email_sends_admin_read" ON public.broadcast_email_sends;
CREATE POLICY "broadcast_email_sends_admin_read" ON public.broadcast_email_sends FOR SELECT
  USING (is_admin());

GRANT SELECT ON public.broadcast_email_sends TO authenticated;
GRANT ALL ON public.broadcast_email_sends TO service_role;
