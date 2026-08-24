-- =========================================================
-- Rentora — Web Push subscriptions
--
-- Real OS/browser push notifications (Phase 2), layered on top of the
-- broadcast system in 13_admin_broadcasts.sql. One row per device/browser
-- a user has said "yes, notify me" on — a user can have several (phone +
-- laptop), each with its own endpoint.
--
-- HOW TO APPLY: paste this whole file into Supabase Dashboard →
-- SQL Editor → New query → Run. Safe to re-run.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    -- The three fields the browser's PushManager.subscribe() call returns.
    -- endpoint is effectively this device's unique "address" for push.
    endpoint text NOT NULL UNIQUE,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- A user manages only their own subscriptions (subscribe, and unsubscribe
-- when they turn notifications off). The send-push edge function reads
-- across all users, but it authenticates with the service role key, which
-- bypasses RLS entirely — it doesn't need a policy of its own here.
DROP POLICY IF EXISTS "push_subscriptions_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own" ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);