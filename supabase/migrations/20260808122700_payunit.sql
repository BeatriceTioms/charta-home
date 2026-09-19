-- Charta Home · paying online, through PayUnit
--
-- Until now a subscription was paid by sending mobile money to a number and
-- the desk issuing a code once the receipt arrived. PayUnit takes the money
-- itself in Cameroon, by MTN MoMo, Orange Money or card, and tells us. So an
-- agency there can pay and be active without anybody at the desk.
--
-- The row is opened before the owner is sent to the gateway and settled
-- after the gateway has been asked, in its own words, what became of it. A
-- notify callback is never enough on its own: it is unsigned, so it is only
-- a reason to ask.

create table if not exists subscription_payments (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references agencies (id) on delete cascade,
  request_id   uuid references plan_requests (id) on delete set null,
  plan         text not null references plans (code),
  cycle        text not null check (cycle in ('monthly', 'annual')),
  amount       bigint not null check (amount > 0),
  currency     char(3) not null,
  provider     text not null default 'payunit',
  -- the transaction id we chose and sent to the gateway
  provider_ref text not null unique,
  status       text not null default 'initiated'
               check (status in ('initiated', 'paid', 'failed', 'cancelled')),
  started_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  settled_at   timestamptz,
  -- the gateway's last answer, kept whole for the day somebody asks
  raw          jsonb
);

create index if not exists subscription_payments_agency_idx on subscription_payments (agency_id, created_at desc);

alter table subscription_payments enable row level security;

-- The agency may read its own. Nothing writes here but the two functions.
drop policy if exists subscription_payments_select on subscription_payments;
create policy subscription_payments_select on subscription_payments for select
  using (agency_id in (select public.current_agency_ids()));

-- ------------------------------------------------------------ opening one
create or replace function public.begin_subscription_payment(
  target_agency uuid,
  plan_code text,
  cycle_in text,
  provider_ref_in text
)
returns table (payment_id uuid, request_id uuid, due bigint, paid_in char(3))
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  price record;
  money bigint;
  req uuid;
begin
  if not public.has_role(target_agency, array['owner']::public.member_role[]) then
    raise exception 'only the owner can pay for a plan';
  end if;
  if cycle_in not in ('monthly', 'annual') then
    raise exception 'unknown billing cycle %', cycle_in;
  end if;
  if not exists (select 1 from public.plans where code = plan_code) then
    raise exception 'unknown plan %', plan_code;
  end if;
  if provider_ref_in !~ '^[A-Za-z0-9]{6,64}$' then
    raise exception 'transaction id must be letters and digits';
  end if;

  select ag.country, ag.currency into a from public.agencies ag where ag.id = target_agency;

  -- Online payment needs a price. A country without a list is a quote, and a
  -- quote is a conversation, not a checkout page.
  select pp.currency, pp.monthly, pp.annual into price
  from public.plan_prices pp
  where pp.plan = plan_code and pp.country = a.country;
  if not found then
    raise exception 'no list price for % in %', plan_code, a.country;
  end if;

  money := case cycle_in when 'annual' then price.annual else price.monthly end;

  -- The same request row the manual path records, so the desk sees one
  -- kind of thing whether the money came by gateway or by receipt.
  insert into public.plan_requests (agency_id, plan, cycle, currency, amount, requested_by)
  values (target_agency, plan_code, cycle_in, price.currency, money, auth.uid())
  returning id into req;

  return query
    insert into public.subscription_payments
      (agency_id, request_id, plan, cycle, amount, currency, provider_ref, started_by)
    values
      (target_agency, req, plan_code, cycle_in, money, price.currency, provider_ref_in, auth.uid())
    returning subscription_payments.id, subscription_payments.request_id,
              subscription_payments.amount, subscription_payments.currency;
end;
$$;

revoke all on function public.begin_subscription_payment from public;
grant execute on function public.begin_subscription_payment to authenticated;

-- ----------------------------------------------------------- settling one
-- Service role only. The server calls this after asking the gateway, never
-- from anything the browser sent. Idempotent: a payment settled twice, which
-- a callback and a return page can easily do, extends the period once.
create or replace function public.settle_subscription_payment(
  payment_id_in uuid,
  final_status text,
  raw_in jsonb default null
)
returns table (outcome text, new_plan text, active_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
  base timestamptz;
  span interval;
  until timestamptz;
begin
  if final_status not in ('paid', 'failed', 'cancelled') then
    raise exception 'unknown final status %', final_status;
  end if;

  select * into p from public.subscription_payments where id = payment_id_in for update;
  if not found then
    raise exception 'unknown payment';
  end if;

  -- Already settled. Say what happened and change nothing.
  if p.status <> 'initiated' then
    select s.current_period_end into until from public.subscriptions s where s.agency_id = p.agency_id;
    return query select p.status::text, p.plan, until;
    return;
  end if;

  update public.subscription_payments
     set status = final_status, settled_at = now(), raw = coalesce(raw_in, raw)
   where id = p.id;

  if final_status <> 'paid' then
    return query select final_status, p.plan, null::timestamptz;
    return;
  end if;

  span := case p.cycle when 'annual' then interval '1 year' else interval '1 month' end;

  -- A renewal runs on from the current period rather than from today, so
  -- paying a week early does not cost a week. Same rule as a code.
  select greatest(coalesce(s.current_period_end, now()), now()) into base
  from public.subscriptions s where s.agency_id = p.agency_id;
  until := coalesce(base, now()) + span;

  insert into public.subscriptions (agency_id, plan, status, current_period_end)
  values (p.agency_id, p.plan, 'active', until)
  on conflict (agency_id) do update
    set plan = excluded.plan,
        status = 'active',
        current_period_end = excluded.current_period_end;

  if p.request_id is not null then
    update public.plan_requests set status = 'paid' where id = p.request_id;
  end if;

  return query select 'paid'::text, p.plan, until;
end;
$$;

revoke all on function public.settle_subscription_payment from public;
revoke all on function public.settle_subscription_payment from authenticated;

-- --------------------------------------------------- the desk sees them
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
      'id', a.id, 'name', a.name, 'country', a.country, 'city', a.city, 'currency', a.currency,
      'locale', a.locale, 'whatsapp', a.whatsapp_number, 'address', a.address, 'email', a.email,
      'registration', a.registration, 'joined_at', a.created_at
    ),
    'subscription', (
      select jsonb_build_object(
        'plan', s.plan, 'status', s.status, 'started_at', s.created_at,
        'trial_until', s.trial_ends_at, 'period_until', s.current_period_end,
        'max_apartments', p.max_apartments, 'monthly_price', pp.monthly, 'annual_price', pp.annual
      )
      from public.subscriptions s
      left join public.plans p on p.code = s.plan
      left join public.plan_prices pp on pp.plan = s.plan and pp.country = a.country
      where s.agency_id = a.id
    ),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'name', m.full_name, 'email', u.email, 'role', m.role, 'joined_at', m.created_at
      ) order by m.created_at)
      from public.memberships m left join auth.users u on u.id = m.user_id
      where m.agency_id = a.id
    ), '[]'::jsonb),
    'buildings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.name, 'city', b.city,
        'apartments', (select count(*) from public.apartments ap where ap.building_id = b.id),
        'occupied', (select count(distinct l.apartment_id) from public.leases l
                      join public.apartments ap on ap.id = l.apartment_id
                      where ap.building_id = b.id and l.status = 'active'),
        'created_at', b.created_at
      ) order by b.created_at)
      from public.buildings b where b.agency_id = a.id
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
        'id', r.id, 'plan', r.plan, 'cycle', r.cycle, 'currency', r.currency, 'amount', r.amount,
        'status', r.status, 'created_at', r.created_at
      ) order by r.created_at desc)
      from public.plan_requests r where r.agency_id = a.id
    ), '[]'::jsonb),
    'codes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', c.code, 'plan', c.plan, 'cycle', c.cycle, 'issued_at', c.created_at, 'issued_by', iu.email,
        'expires_at', c.expires_at, 'used_at', c.used_at,
        'state', case when c.used_at is not null then 'used' when c.expires_at <= now() then 'expired' else 'open' end
      ) order by c.created_at desc)
      from public.plan_codes c left join auth.users iu on iu.id = c.issued_by
      where c.agency_id = a.id
    ), '[]'::jsonb),
    -- Money that came through the gateway, which never needed a code.
    'online_payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sp.id, 'plan', sp.plan, 'cycle', sp.cycle, 'amount', sp.amount, 'currency', sp.currency,
        'provider', sp.provider, 'provider_ref', sp.provider_ref, 'status', sp.status,
        'created_at', sp.created_at, 'settled_at', sp.settled_at
      ) order by sp.created_at desc)
      from public.subscription_payments sp where sp.agency_id = a.id
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
