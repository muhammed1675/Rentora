-- =========================================================
-- Rentora — Self-serve Ads feature
-- =========================================================
-- New, self-contained feature: no advertiser login. Businesses buy one of
-- 3 rotating ad slots on the public site, pay via the existing Flutterwave
-- integration (verified server-side in frontend/api/confirm-ad-payment.js,
-- same fail-closed pattern as confirm-payment.js), get reviewed by an
-- admin, then rotate live in <AdSlot />. Clicking an ad opens a WhatsApp
-- chat with the advertiser directly — there's no advertiser dashboard.

-- ── Per-slot configuration: caps and pricing, editable from admin UI ──
create table if not exists ad_slot_config (
  slot_type            text primary key
                        check (slot_type in ('header_billboard','in_feed_banner','mid_page_content')),
  max_concurrent_ads   integer not null default 4,
  price_week           numeric not null,
  price_month          numeric not null,
  image_width          integer not null,
  image_height         integer not null,
  updated_at           timestamptz not null default now()
);

insert into ad_slot_config (slot_type, max_concurrent_ads, price_week, price_month, image_width, image_height)
values
  ('header_billboard', 4, 3000, 9000, 970, 250),
  ('mid_page_content', 5, 2000, 6000, 1000, 200),
  ('in_feed_banner',   5, 1500, 4500, 728, 90)
on conflict (slot_type) do nothing;

-- ── Individual ad orders ──
create table if not exists ads (
  id                 uuid primary key default gen_random_uuid(),
  slot_type          text not null references ad_slot_config(slot_type),
  business_name      text not null,
  contact_name       text not null,
  whatsapp_number    text not null,   -- international format, e.g. 2348012345678
  email              text,            -- optional backup contact
  image_url          text,            -- set after upload to storage
  duration_type      text not null check (duration_type in ('week','month')),
  amount_paid        numeric not null,
  payment_reference  text unique not null,
  payment_status     text not null default 'pending'
                      check (payment_status in ('pending','completed','failed')),
  status             text not null default 'pending_payment'
                      check (status in (
                        'pending_payment', -- created, awaiting Flutterwave charge
                        'pending_review',  -- paid, waiting on admin approval
                        'pending_queue',   -- paid, waiting for a slot to free up
                        'active',          -- currently live and rotating
                        'rejected',        -- admin rejected the creative
                        'expired',         -- ran its full duration
                        'paused'           -- admin manually paused
                      )),
  queue_position     integer,          -- only meaningful when status = 'pending_queue'
  rejection_reason   text,
  click_count        integer not null default 0,
  start_date         timestamptz,      -- set only when it actually goes live
  end_date           timestamptz,      -- computed from start_date + duration_type
  created_at         timestamptz not null default now()
);

create index if not exists idx_ads_slot_status on ads(slot_type, status);
create index if not exists idx_ads_payment_reference on ads(payment_reference);

-- Atomic click counter, callable from the browser without exposing writes
-- to the rest of the row.
create or replace function increment_ad_click(ad_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update ads set click_count = click_count + 1 where id = ad_id and status = 'active';
$$;

-- Public, PII-free availability summary — the public policy below only
-- lets anon users select status='active' rows, which isn't enough for the
-- /advertise slot picker to show "N waiting" for a full slot's queue. This
-- RPC exposes just the counts, nothing else, to any caller.
create or replace function get_ad_slot_availability()
returns table(slot_type text, active_count integer, queue_count integer)
language sql
security definer
stable
set search_path = public
as $$
  select
    c.slot_type,
    (select count(*)::integer from ads a where a.slot_type = c.slot_type and a.status = 'active') as active_count,
    (select count(*)::integer from ads a where a.slot_type = c.slot_type and a.status = 'pending_queue') as queue_count
  from ad_slot_config c;
$$;

-- ── RLS ──
alter table ads enable row level security;
alter table ad_slot_config enable row level security;

-- Public can read only active ads (for display) — no PII beyond what's
-- shown on the ad creative itself.
create policy "public can view active ads" on ads
  for select using (status = 'active');

-- Public can insert new ad orders (this is the self-serve entry point —
-- no auth required).
create policy "public can create ad orders" on ads
  for insert with check (status = 'pending_payment');

-- Only admins can update/delete ad rows directly from the client; all
-- payment-status transitions happen server-side via the service role key
-- inside confirm-ad-payment.js.
create policy "admins can manage ads" on ads
  for all using (is_admin());

create policy "anyone can view slot config" on ad_slot_config
  for select using (true);

create policy "admins can edit slot config" on ad_slot_config
  for update using (is_admin());

-- ── Storage bucket ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ads', 'ads', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "Anyone can view ad images" on storage.objects for select
  using (bucket_id = 'ads');

create policy "Anyone can upload ad images" on storage.objects for insert
  with check (bucket_id = 'ads');

-- =========================================================
-- Ad lifecycle — expiry + queue promotion
-- =========================================================
-- Runs every 15 minutes: expires ads whose end_date has passed, then
-- backfills any freed-up slot from the queue (lowest queue_position
-- first), shifting everyone else's position up.
create or replace function process_ad_lifecycle()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot record;
  v_next_id uuid;
  v_next_pos integer;
begin
  -- 1. Expire ads whose run has ended.
  update ads
  set status = 'expired'
  where status = 'active' and end_date is not null and end_date < now();

  -- 2. Backfill each slot from its queue, oldest position first.
  for v_slot in select slot_type, max_concurrent_ads from ad_slot_config loop
    loop
      exit when (
        select count(*) from ads where slot_type = v_slot.slot_type and status = 'active'
      ) >= v_slot.max_concurrent_ads;

      select id, queue_position into v_next_id, v_next_pos
      from ads
      where slot_type = v_slot.slot_type and status = 'pending_queue'
      order by queue_position asc nulls last, created_at asc
      limit 1;

      exit when not found;

      update ads
      set status = 'active',
          start_date = now(),
          end_date = now() + (case when duration_type = 'week' then interval '7 days' else interval '30 days' end),
          queue_position = null
      where id = v_next_id;

      update ads
      set queue_position = queue_position - 1
      where slot_type = v_slot.slot_type
        and status = 'pending_queue'
        and queue_position > coalesce(v_next_pos, 0);
    end loop;
  end loop;
end;
$$;

-- Schedule it. pg_cron needs to be enabled once per project — if this
-- block fails with "permission denied" or "extension not available",
-- enable pg_cron from the Supabase Dashboard → Database → Extensions,
-- then re-run just the two statements below.
do $$
begin
  create extension if not exists pg_cron with schema extensions;
exception when others then
  raise notice 'pg_cron not enabled automatically — enable it from Database > Extensions in the Supabase Dashboard, then re-run the cron.schedule call below.';
end $$;

do $$
begin
  perform cron.unschedule('rentora-ad-lifecycle');
exception when others then
  null; -- no existing job with that name yet, nothing to unschedule
end $$;

select cron.schedule('rentora-ad-lifecycle', '*/15 * * * *', $$select public.process_ad_lifecycle();$$);
