-- Rentora — Admin user report (replaces the 28_account_activity_audit
-- approach entirely).
--
-- Why this instead of an audit-log table + triggers:
--   * No new table to keep in sync, no triggers that can silently fail
--     or drift from the real data.
--   * No forward-only log that can fall out of date if a trigger is
--     ever missed on a future table — this reads the live, current
--     source of truth every time it's called.
--   * One function, tightly scoped: callable only by an admin, or by
--     the account owner about themselves. Nothing else changes.
--   * Nothing further needs to be run in Supabase to add new report
--     fields later — only this function needs editing/replacing.
--
-- Run this once in Supabase SQL Editor. Safe to re-run.

create or replace function public.get_admin_user_report(target_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  caller_role text;
  result jsonb;
begin
  -- Access control: admins can pull anyone's report; anyone else can
  -- only pull their own.
  select role into caller_role from public.users where id = auth.uid();
  if auth.uid() is null or (caller_role is distinct from 'admin' and auth.uid() <> target_user_id) then
    raise exception 'not authorized to view this report';
  end if;

  select jsonb_build_object(
    'generated_at', now(),

    'account', (
      select jsonb_build_object(
        'id', u.id, 'full_name', u.full_name, 'email', u.email, 'phone', u.phone,
        'role', u.role, 'suspended', u.suspended, 'joined_at', u.created_at,
        'last_login_at', u.last_login_at, 'deleted_at', u.deleted_at
      )
      from public.users u where u.id = target_user_id
    ),

    -- ── As a tenant / student ─────────────────────────────
    'rent_payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'created_at', p.created_at, 'status', p.status,
        'held_at', p.held_at, 'released_at', p.released_at, 'refunded_at', p.refunded_at,
        'reference', p.reference,
        'rent_amount', p.rent_amount, 'service_fee', p.service_fee, 'agent_fee', p.agent_fee,
        'caution_fee', p.caution_fee, 'agreement_fee', p.agreement_fee,
        'inspection_fee', p.inspection_fee, 'documentation_fee', p.documentation_fee,
        'other_fees_total', p.other_fees_total, 'total_amount', p.total_amount,
        'owner_name', p.owner_name, 'owner_phone', p.owner_phone,
        'property', jsonb_build_object('id', pr.id, 'title', pr.title, 'address', pr.address, 'location_text', pr.location_text, 'property_type', pr.property_type),
        'agent', jsonb_build_object('full_name', ag.full_name, 'phone', ag.phone, 'email', ag.email)
      ) order by p.created_at desc)
      from public.property_rent_payments p
      left join public.properties pr on pr.id = p.property_id
      left join public.users ag on ag.id = p.agent_id
      where p.user_id = target_user_id
    ), '[]'::jsonb),

    'viewing_payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', it.id, 'created_at', it.created_at, 'status', it.status, 'amount', it.amount,
        'reference', it.reference, 'inspection_date', i.inspection_date,
        'property_title', i.property_title, 'agent_name', i.agent_name
      ) order by it.created_at desc)
      from public.inspection_transactions it
      left join public.inspections i on i.id = it.inspection_id
      where it.user_id = target_user_id
    ), '[]'::jsonb),

    'tips_given', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'created_at', t.created_at, 'status', t.status, 'amount', t.amount,
        'reference', t.reference, 'agent', jsonb_build_object('full_name', ag.full_name, 'phone', ag.phone)
      ) order by t.created_at desc)
      from public.inspection_tips t
      left join public.users ag on ag.id = t.agent_id
      where t.user_id = target_user_id
    ), '[]'::jsonb),

    'token_transactions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', tr.id, 'created_at', tr.created_at, 'status', tr.status,
        'amount', tr.amount, 'tokens_added', tr.tokens_added, 'reference', tr.reference
      ) order by tr.created_at desc)
      from public.transactions tr
      where tr.user_id = target_user_id
    ), '[]'::jsonb),

    'property_unlocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'unlocked_at', un.unlocked_at,
        'property', jsonb_build_object('id', pr.id, 'title', pr.title, 'location_text', pr.location_text)
      ) order by un.unlocked_at desc)
      from public.unlocks un
      left join public.properties pr on pr.id = un.property_id
      where un.user_id = target_user_id
    ), '[]'::jsonb),

    'reports_filed', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rp.id, 'created_at', rp.created_at, 'status', rp.status, 'reason', rp.reason,
        'details', rp.details, 'property_title', pr.title
      ) order by rp.created_at desc)
      from public.property_reports rp
      left join public.properties pr on pr.id = rp.property_id
      where rp.reporter_id = target_user_id
    ), '[]'::jsonb),

    -- ── As an agent ───────────────────────────────────────
    'properties_listed', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pr.id, 'title', pr.title, 'status', pr.status, 'availability', pr.availability,
        'price', pr.price, 'location_text', pr.location_text, 'created_at', pr.created_at
      ) order by pr.created_at desc)
      from public.properties pr
      where pr.uploaded_by_agent_id = target_user_id
    ), '[]'::jsonb),

    'rent_payments_received', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'created_at', p.created_at, 'status', p.status, 'total_amount', p.total_amount,
        'agent_fee', p.agent_fee, 'reference', p.reference,
        'property', jsonb_build_object('title', pr.title, 'location_text', pr.location_text),
        'tenant', jsonb_build_object('full_name', te.full_name, 'phone', te.phone, 'email', te.email)
      ) order by p.created_at desc)
      from public.property_rent_payments p
      left join public.properties pr on pr.id = p.property_id
      left join public.users te on te.id = p.user_id
      where p.agent_id = target_user_id
    ), '[]'::jsonb),

    'tips_received', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'created_at', t.created_at, 'status', t.status, 'amount', t.amount,
        'tenant', jsonb_build_object('full_name', te.full_name, 'phone', te.phone)
      ) order by t.created_at desc)
      from public.inspection_tips t
      left join public.users te on te.id = t.user_id
      where t.agent_id = target_user_id
    ), '[]'::jsonb),

    'agent_earnings', (
      select jsonb_build_object('total_earned', ab.total_earned, 'total_withdrawn', ab.total_withdrawn, 'balance', ab.balance)
      from public.agent_balances ab where ab.agent_id = target_user_id
    ),

    'withdrawals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id, 'amount', w.amount, 'fee_amount', w.fee_amount, 'net_amount', w.net_amount,
        'status', w.status, 'bank_name', w.bank_name, 'account_number', w.account_number,
        'account_name', w.account_name, 'requested_at', w.requested_at, 'resolved_at', w.resolved_at
      ) order by w.requested_at desc)
      from public.withdrawal_requests w
      where w.agent_id = target_user_id
    ), '[]'::jsonb),

    -- ── Advertising ───────────────────────────────────────
    'ads', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'business_name', a.business_name, 'slot', a.slot, 'price', a.price,
        'billing_period', a.billing_period, 'status', a.status, 'payment_status', a.payment_status,
        'clicks', a.clicks, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'created_at', a.created_at
      ) order by a.created_at desc)
      from public.ads a
      where a.user_id = target_user_id
    ), '[]'::jsonb)

  ) into result;

  return result;
end;
$$;

-- Only logged-in users may call it; the function itself enforces
-- admin-or-self access above, so there is no broader exposure.
revoke all on function public.get_admin_user_report(uuid) from public, anon;
grant execute on function public.get_admin_user_report(uuid) to authenticated;
