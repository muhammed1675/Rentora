-- Rentora account activity statements
-- Run this in Supabase SQL Editor. This is append-only and admin-readable.

create table if not exists public.account_activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  category text not null default 'account',
  description text not null,
  amount numeric,
  currency text default 'NGN',
  reference_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists account_activity_log_user_created_idx
  on public.account_activity_log(user_id, created_at desc);
create index if not exists account_activity_log_category_idx
  on public.account_activity_log(category, created_at desc);

alter table public.account_activity_log enable row level security;

drop policy if exists "Admins can read account activity" on public.account_activity_log;
create policy "Admins can read account activity"
  on public.account_activity_log for select to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

drop policy if exists "Users can read their own activity" on public.account_activity_log;
create policy "Users can read their own activity"
  on public.account_activity_log for select to authenticated
  using (user_id = auth.uid());

-- Admin-only helper used by the dashboard. It avoids exposing arbitrary rows.
create or replace function public.get_account_activity_statement(target_user_id uuid)
returns table (
  id uuid, user_id uuid, actor_id uuid, action text, category text,
  description text, amount numeric, currency text, reference_id text,
  metadata jsonb, created_at timestamptz
)
language sql stable security invoker set search_path = public
as $$
  select a.id, a.user_id, a.actor_id, a.action, a.category, a.description,
         a.amount, a.currency, a.reference_id, a.metadata, a.created_at
  from public.account_activity_log a
  where a.user_id = target_user_id
    and (a.user_id = auth.uid() or exists (
      select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
    ))
  order by a.created_at desc;
$$;

grant execute on function public.get_account_activity_statement(uuid) to authenticated;

-- Recoverable history from the existing users table.
insert into public.account_activity_log (user_id, action, category, description, created_at, metadata)
select u.id, 'account_created', 'account', 'Account created', u.created_at,
       jsonb_build_object('source', 'users', 'recovered', true)
from public.users u
where u.created_at is not null
  and not exists (
    select 1 from public.account_activity_log a
    where a.user_id = u.id and a.action = 'account_created'
  );

-- Going forward, this helper can be called by existing business actions.
-- Example: select public.log_account_activity(user_id, 'payment_completed', 'payment', 'Rent payment completed', 50000, 'NGN', payment_id, '{}'::jsonb);
create or replace function public.log_account_activity(
  target_user_id uuid, event_action text, event_category text,
  event_description text, event_amount numeric default null,
  event_currency text default 'NGN', event_reference_id text default null,
  event_metadata jsonb default '{}'::jsonb, event_actor_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare new_id uuid;
begin
  insert into public.account_activity_log
    (user_id, actor_id, action, category, description, amount, currency, reference_id, metadata)
  values
    (target_user_id, coalesce(event_actor_id, auth.uid()), event_action, event_category,
     event_description, event_amount, event_currency, event_reference_id, event_metadata)
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.log_account_activity(uuid,text,text,text,numeric,text,text,jsonb,uuid) from public, anon, authenticated;

-- Recoverable business history from the confirmed Rentora schema.
insert into public.account_activity_log (user_id, action, category, description, amount, currency, reference_id, created_at, metadata)
select p.user_id, 'rent_payment', 'payment', 'Rent payment ' || coalesce(p.status, 'recorded'), p.total_amount, 'NGN', p.reference, p.created_at,
       jsonb_build_object('source', 'property_rent_payments', 'status', p.status, 'recovered', true)
from public.property_rent_payments p
where p.user_id is not null
  and not exists (select 1 from public.account_activity_log a where a.user_id = p.user_id and a.reference_id = p.reference and a.action = 'rent_payment');

insert into public.account_activity_log (user_id, action, category, description, amount, currency, reference_id, created_at, metadata)
select t.user_id, 'token_transaction', 'payment', 'Token transaction ' || coalesce(t.status, 'recorded'), t.amount, 'NGN', t.reference, t.created_at,
       jsonb_build_object('source', 'transactions', 'status', t.status, 'recovered', true)
from public.transactions t
where t.user_id is not null
  and not exists (select 1 from public.account_activity_log a where a.user_id = t.user_id and a.reference_id = t.reference and a.action = 'token_transaction');

insert into public.account_activity_log (user_id, action, category, description, reference_id, created_at, metadata)
select u.user_id, 'property_unlock', 'listing', 'Property details unlocked', u.property_id::text, u.unlocked_at,
       jsonb_build_object('source', 'unlocks', 'recovered', true)
from public.unlocks u
where u.user_id is not null
  and not exists (select 1 from public.account_activity_log a where a.user_id = u.user_id and a.reference_id = u.property_id::text and a.action = 'property_unlock');

-- Never log passwords, auth tokens, identity document URLs, or full bank details.

-- Forward-looking capture for core user-owned records. Details are intentionally
-- summarized so the statement contains activity without sensitive payloads.
create or replace function public.capture_user_activity()
returns trigger
language plpgsql security invoker set search_path = public
as $$
declare target uuid; event_category text; event_action text; event_description text;
begin
  target := nullif(to_jsonb(new)->>'user_id', '')::uuid;
  if target is null then return new; end if;
  event_category := case when tg_table_name in ('transactions','property_rent_payments') then 'payment'
                         when tg_table_name in ('properties','unlocks','property_reviews','reviews') then 'listing'
                         when tg_table_name in ('inspections','inspection_transactions') then 'booking'
                         when tg_table_name like '%verification%' then 'verification' else 'account' end;
  event_action := tg_table_name || '_' || lower(tg_op);
  event_description := initcap(replace(tg_table_name, '_', ' ')) || ' ' || lower(tg_op);
  perform public.log_account_activity(target, event_action, event_category, event_description, null, 'NGN', coalesce(to_jsonb(new)->>'reference', to_jsonb(new)->>'id'), jsonb_build_object('source', tg_table_name, 'operation', tg_op));
  return new;
exception when others then
  raise warning 'Rentora activity capture skipped for %: %', tg_table_name, sqlerrm;
  return new;
end;
$$;

drop trigger if exists capture_properties_activity on public.properties;
create trigger capture_properties_activity after insert or update on public.properties for each row execute function public.capture_user_activity();
drop trigger if exists capture_payments_activity on public.property_rent_payments;
create trigger capture_payments_activity after insert or update on public.property_rent_payments for each row execute function public.capture_user_activity();
drop trigger if exists capture_transactions_activity on public.transactions;
create trigger capture_transactions_activity after insert or update on public.transactions for each row execute function public.capture_user_activity();
drop trigger if exists capture_unlocks_activity on public.unlocks;
create trigger capture_unlocks_activity after insert on public.unlocks for each row execute function public.capture_user_activity();
drop trigger if exists capture_inspections_activity on public.inspections;
create trigger capture_inspections_activity after insert or update on public.inspections for each row execute function public.capture_user_activity();
drop trigger if exists capture_student_verification_activity on public.student_verification_requests;
create trigger capture_student_verification_activity after insert or update on public.student_verification_requests for each row execute function public.capture_user_activity();

-- Example event categories: account, payment, listing, booking, verification,
-- message, report, admin, security.
