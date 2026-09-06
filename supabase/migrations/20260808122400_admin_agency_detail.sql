-- Charta Home · one agency, in full, for the desk
--
-- The listing answers "who is on what". This answers "tell me about this
-- one": its people, its buildings, what it has paid for and asked for, and
-- every code that was ever issued to it. One call, one document, because
-- the page is read far more often than any part of it changes.

create or replace function public.admin_agency_detail(target_agency uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  doc jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform admin';
  end if;

  select jsonb_build_object(
    'agency', jsonb_build_object(
      'id', a.id,
      'name', a.name,
      'country', a.country,
      'city', a.city,
      'currency', a.currency,
      'locale', a.locale,
      'whatsapp', a.whatsapp_number,
      'address', a.address,
      'email', a.email,
      'registration', a.registration,
      'joined_at', a.created_at
    ),
    'subscription', (
      select jsonb_build_object(
        'plan', s.plan,
        'status', s.status,
        'started_at', s.created_at,
        'trial_until', s.trial_ends_at,
        'period_until', s.current_period_end,
        'max_apartments', p.max_apartments,
        'monthly_price', pp.monthly,
        'annual_price', pp.annual
      )
      from public.subscriptions s
      left join public.plans p on p.code = s.plan
      left join public.plan_prices pp on pp.plan = s.plan and pp.country = a.country
      where s.agency_id = a.id
    ),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'name', m.full_name,
        'email', u.email,
        'role', m.role,
        'joined_at', m.created_at
      ) order by m.created_at)
      from public.memberships m
      left join auth.users u on u.id = m.user_id
      where m.agency_id = a.id
    ), '[]'::jsonb),
    'buildings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'city', b.city,
        'apartments', (select count(*) from public.apartments ap where ap.building_id = b.id),
        'occupied', (select count(distinct l.apartment_id) from public.leases l
                      join public.apartments ap on ap.id = l.apartment_id
                      where ap.building_id = b.id and l.status = 'active'),
        'created_at', b.created_at
      ) order by b.created_at)
      from public.buildings b
      where b.agency_id = a.id
    ), '[]'::jsonb),
    'money', jsonb_build_object(
      'apartments', (select count(*) from public.apartments ap where ap.agency_id = a.id),
      'tenants', (select count(*) from public.leases l where l.agency_id = a.id and l.status = 'active'),
      'collected_total', coalesce((select sum(py.amount) from public.payments py where py.agency_id = a.id), 0),
      'collected_year', coalesce((select sum(py.amount) from public.payments py
                                   where py.agency_id = a.id and py.paid_on >= date_trunc('year', current_date)), 0),
      'collected_month', coalesce((select sum(py.amount) from public.payments py
                                    where py.agency_id = a.id and py.paid_on >= date_trunc('month', current_date)), 0),
      'payments', (select count(*) from public.payments py where py.agency_id = a.id),
      'last_payment_at', (select max(py.created_at) from public.payments py where py.agency_id = a.id)
    ),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'plan', r.plan,
        'cycle', r.cycle,
        'currency', r.currency,
        'amount', r.amount,
        'status', r.status,
        'created_at', r.created_at
      ) order by r.created_at desc)
      from public.plan_requests r
      where r.agency_id = a.id
    ), '[]'::jsonb),
    'codes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', c.code,
        'plan', c.plan,
        'cycle', c.cycle,
        'issued_at', c.created_at,
        'issued_by', iu.email,
        'expires_at', c.expires_at,
        'used_at', c.used_at,
        'state', case
          when c.used_at is not null then 'used'
          when c.expires_at <= now() then 'expired'
          else 'open' end
      ) order by c.created_at desc)
      from public.plan_codes c
      left join auth.users iu on iu.id = c.issued_by
      where c.agency_id = a.id
    ), '[]'::jsonb)
  )
  into doc
  from public.agencies a
  where a.id = target_agency;

  if doc is null then
    raise exception 'unknown agency';
  end if;

  return doc;
end;
$$;

revoke all on function public.admin_agency_detail from public;
grant execute on function public.admin_agency_detail to authenticated;
