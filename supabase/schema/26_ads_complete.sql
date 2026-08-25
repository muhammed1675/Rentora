-- Rentora ads: run this file in Supabase SQL Editor.
-- Existing ads/ad_slot_config tables are extended; no existing rows are deleted.
begin;

create extension if not exists pgcrypto;

alter table public.ads
  add column if not exists full_name text,
  add column if not exists business_name text,
  add column if not exists whatsapp_number text,
  add column if not exists image_url text,
  add column if not exists ad_text text,
  add column if not exists slot text,
  add column if not exists status text default 'pending_review',
  add column if not exists payment_status text default 'pending',
  add column if not exists amount_paid numeric(12,2) default 0,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists clicks integer default 0,
  add column if not exists created_at timestamptz default now();

alter table public.ad_slot_config
  add column if not exists slot text,
  add column if not exists max_concurrent_ads integer default 5,
  add column if not exists weekly_price numeric(12,2),
  add column if not exists monthly_price numeric(12,2),
  add column if not exists updated_at timestamptz default now();

update public.ad_slot_config set weekly_price = coalesce(weekly_price, price_per_week), monthly_price = coalesce(monthly_price, price_per_month);

insert into public.ad_slot_config (slot, max_concurrent_ads, price_per_week, price_per_month, weekly_price, monthly_price, updated_at)
values
 ('header_billboard', 5, 1000, 9000, 1000, 9000, now()),
 ('mid_page_content', 5, 1000, 6000, 1000, 6000, now()),
 ('in_feed_banner', 5, 1000, 4500, 1000, 4500, now())
on conflict (slot) do update set
 max_concurrent_ads=excluded.max_concurrent_ads, price_per_week=excluded.price_per_week,
 price_per_month=excluded.price_per_month, weekly_price=excluded.weekly_price,
 monthly_price=excluded.monthly_price, updated_at=now();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ads', 'ads', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true, file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp'];

alter table public.ads enable row level security;
alter table public.ad_slot_config enable row level security;

drop policy if exists "Public can view approved active ads" on public.ads;
create policy "Public can view approved active ads" on public.ads for select to anon, authenticated using (status in ('approved','active') and payment_status in ('paid','completed') and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()));

drop policy if exists "Anyone can view ad images" on storage.objects;
create policy "Anyone can view ad images" on storage.objects for select using (bucket_id='ads');
drop policy if exists "Anyone can upload ad images" on storage.objects;
create policy "Anyone can upload ad images" on storage.objects for insert to anon, authenticated with check (bucket_id='ads' and lower(storage.extension(name)) in ('jpg','jpeg','png','webp') and (metadata->>'size')::bigint <= 5242880);

drop policy if exists "Anyone can read slot config" on public.ad_slot_config;
create policy "Anyone can read slot config" on public.ad_slot_config for select to anon, authenticated using (true);

create index if not exists ads_public_active_idx on public.ads(slot, status, starts_at, ends_at);
create index if not exists ads_created_at_idx on public.ads(created_at desc);

create or replace function public.increment_ad_click(p_ad_id uuid) returns void language sql volatile security definer set search_path=public as $$ update public.ads set clicks=coalesce(clicks,0)+1 where id=p_ad_id and status in ('approved','active') and payment_status in ('paid','completed') and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()); $$;
revoke all on function public.increment_ad_click(uuid) from public;
grant execute on function public.increment_ad_click(uuid) to anon, authenticated;

commit;

-- Required creative dimensions (one image per advert):
-- header_billboard: 970x250 (ratio 3.88:1)
-- mid_page_content: 728x90 (ratio 8.09:1)
-- in_feed_banner: 300x200 (ratio 1.5:1)
-- Dimension validation is performed before upload in SubmitAd.jsx.
-- Admin approval remains the only way an advert becomes public.
