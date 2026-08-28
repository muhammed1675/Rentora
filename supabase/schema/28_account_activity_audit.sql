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
language plpgsql security invoker set search_path = public
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

grant execute on function public.log_account_activity(uuid,text,text,text,numeric,text,text,jsonb,uuid) to authenticated;

-- Backfill payment-like rows after confirming your exact table/column names.
-- Use the introspection query supplied in chat before adding those inserts.
-- Never log passwords, auth tokens, identity document URLs, or full bank details.

-- Example event categories: account, payment, listing, booking, verification,
-- message, report, admin, security.
