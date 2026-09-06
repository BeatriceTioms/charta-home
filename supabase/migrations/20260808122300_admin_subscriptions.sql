-- Charta Home · every subscription, for the desk
--
-- The desk's first page is one row per agency. This is one row per
-- subscription, with what it costs where the agency is, when it began, and
-- every activation that has run through it, so a question like "who renewed
-- this month" has a page rather than a query.

create or replace function public.admin_list_subscriptions()
returns table (
  agency_id             uuid,
  agency_name           text,
  agency_country        text,
  agency_city           text,
  agency_currency       char(3),
  owner_name            text,
  owner_email           text,
  current_plan          text,
  plan_status           text,
  started_at            timestamptz,
  trial_until           timestamptz,
  period_until          timestamptz,
  monthly_price         bigint,
  annual_price          bigint,
  activations           integer,
  last_activation_at    timestamptz,
  last_activation_plan  text,
  last_activation_cycle text,
  pending_requests      integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform admin';
  end if;

  return query
  select
    a.id,
    a.name,
    a.country,
    a.city,
    a.currency,
    o.full_name,
    u.email::text,
    s.plan,
    s.status::text,
    s.created_at,
    s.trial_ends_at,
    s.current_period_end,
    pp.monthly,
    pp.annual,
    coalesce(act.n, 0)::integer,
    act.last_at,
    act.last_plan,
    act.last_cycle,
    coalesce((select count(*)::integer from public.plan_requests r
               where r.agency_id = a.id and r.status = 'pending'), 0)
  from public.subscriptions s
  join public.agencies a on a.id = s.agency_id
  left join public.plan_prices pp on pp.plan = s.plan and pp.country = a.country
  left join lateral (
    select m.user_id, m.full_name
    from public.memberships m
    where m.agency_id = a.id and m.role = 'owner'
    order by m.created_at
    limit 1
  ) o on true
  left join auth.users u on u.id = o.user_id
  left join lateral (
    select count(*) as n,
           max(c.used_at) as last_at,
           (array_agg(c.plan order by c.used_at desc))[1] as last_plan,
           (array_agg(c.cycle order by c.used_at desc))[1] as last_cycle
    from public.plan_codes c
    where c.agency_id = a.id and c.used_at is not null
  ) act on true
  order by s.created_at desc;
end;
$$;

revoke all on function public.admin_list_subscriptions from public;
grant execute on function public.admin_list_subscriptions to authenticated;
