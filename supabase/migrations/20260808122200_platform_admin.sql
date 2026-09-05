-- Charta Home · the platform's own desk
--
-- Somebody at Charta Home has to see every agency, what it is on, what it
-- has collected, and turn a mobile money receipt into an active plan. Until
-- now that was a SQL editor. This gives it a table of admins, a view across
-- agencies, and one-time codes, so the flow is: the agency pays and sends
-- the receipt over WhatsApp or email; the desk checks it and issues a code;
-- the owner types the code into settings and the plan is live.
--
-- A code is bound to one agency and one tier, is good for an hour, and dies
-- the moment it is used. Only the owner of that agency can redeem it, so a
-- code read over somebody's shoulder is worth nothing to anyone else.

-- ------------------------------------------------------------ who we are
-- No policies at all: nothing but the service role reads or writes this, and
-- is_platform_admin() answers the one question anybody else needs to ask.
create table if not exists platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table platform_admins enable row level security;

comment on table platform_admins is
  'Charta Home staff. Insert through the service role only; see docs/backend-setup.md.';

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

grant execute on function public.is_platform_admin to authenticated;

-- ------------------------------------------------------- one-time codes
create table if not exists plan_codes (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  agency_id  uuid not null references agencies (id) on delete cascade,
  plan       text not null references plans (code),
  cycle      text not null check (cycle in ('monthly', 'annual')),
  -- the request this settles, when the desk issued it for one
  request_id uuid references plan_requests (id) on delete set null,
  issued_by  uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  used_at    timestamptz,
  used_by    uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists plan_codes_agency_idx on plan_codes (agency_id, created_at desc);

-- No policies here either. The desk issues through one function and the
-- owner redeems through another; nobody selects from the table.
alter table plan_codes enable row level security;

-- ------------------------------------------------- every agency, at once
-- The output names avoid every column name they are read from. An OUT
-- parameter that shares a name with a column makes every mention of it in
-- the body ambiguous.
create or replace function public.admin_list_agencies()
returns table (
  agency_id          uuid,
  agency_name        text,
  agency_country     text,
  agency_city        text,
  agency_currency    char(3),
  signed_up_at       timestamptz,
  owner_name         text,
  owner_email        text,
  agency_whatsapp    text,
  member_count       integer,
  current_plan       text,
  plan_status        text,
  trial_until        timestamptz,
  period_until       timestamptz,
  apartments_used    integer,
  apartments_max     integer,
  collected_total    bigint,
  collected_year     bigint,
  pending_request_id uuid,
  pending_plan       text,
  pending_cycle      text,
  pending_amount     bigint,
  pending_currency   char(3),
  pending_at         timestamptz,
  open_code          text,
  open_code_until    timestamptz
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
    a.created_at,
    o.full_name,
    u.email::text,
    a.whatsapp_number,
    (select count(*)::integer from public.memberships m where m.agency_id = a.id),
    s.plan,
    s.status::text,
    s.trial_ends_at,
    s.current_period_end,
    (select count(*)::integer from public.apartments ap where ap.agency_id = a.id),
    p.max_apartments,
    coalesce((select sum(py.amount) from public.payments py where py.agency_id = a.id), 0)::bigint,
    coalesce((select sum(py.amount) from public.payments py
               where py.agency_id = a.id and py.paid_on >= date_trunc('year', current_date)), 0)::bigint,
    pr.id,
    pr.plan,
    pr.cycle,
    pr.amount,
    pr.currency,
    pr.created_at,
    pc.code,
    pc.expires_at
  from public.agencies a
  left join public.subscriptions s on s.agency_id = a.id
  left join public.plans p on p.code = s.plan
  left join lateral (
    select m.user_id, m.full_name
    from public.memberships m
    where m.agency_id = a.id and m.role = 'owner'
    order by m.created_at
    limit 1
  ) o on true
  left join auth.users u on u.id = o.user_id
  left join lateral (
    select r.id, r.plan, r.cycle, r.amount, r.currency, r.created_at
    from public.plan_requests r
    where r.agency_id = a.id and r.status = 'pending'
    order by r.created_at desc
    limit 1
  ) pr on true
  left join lateral (
    select c.code, c.expires_at
    from public.plan_codes c
    where c.agency_id = a.id and c.used_at is null and c.expires_at > now()
    order by c.created_at desc
    limit 1
  ) pc on true
  order by a.created_at desc;
end;
$$;

revoke all on function public.admin_list_agencies from public;
grant execute on function public.admin_list_agencies to authenticated;

-- --------------------------------------------------------- issuing one
create or replace function public.admin_issue_plan_code(
  target_agency uuid,
  plan_code text,
  cycle_in text
)
returns table (issued_code text, valid_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- No 0, O, 1 or I: a code is read out over the phone and typed back.
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  fresh text;
  i integer;
  settles uuid;
  until timestamptz := now() + interval '1 hour';
begin
  if not public.is_platform_admin() then
    raise exception 'not a platform admin';
  end if;
  if cycle_in not in ('monthly', 'annual') then
    raise exception 'unknown billing cycle %', cycle_in;
  end if;
  if not exists (select 1 from public.plans where code = plan_code) then
    raise exception 'unknown plan %', plan_code;
  end if;
  if not exists (select 1 from public.agencies where id = target_agency) then
    raise exception 'unknown agency';
  end if;

  -- One open code per agency. Issuing again means the last one was wrong or
  -- lost, and two live codes is how the wrong tier gets activated.
  update public.plan_codes
     set expires_at = now()
   where agency_id = target_agency and used_at is null and expires_at > now();

  loop
    fresh := '';
    for i in 1..8 loop
      fresh := fresh || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.plan_codes where code = fresh);
  end loop;

  -- Settles the pending request only when it is the same thing. The desk may
  -- well issue a different tier from the one asked for, after a conversation.
  select r.id into settles
  from public.plan_requests r
  where r.agency_id = target_agency and r.status = 'pending'
    and r.plan = plan_code and r.cycle = cycle_in
  order by r.created_at desc
  limit 1;

  insert into public.plan_codes (code, agency_id, plan, cycle, request_id, issued_by, expires_at)
  values (fresh, target_agency, plan_code, cycle_in, settles, auth.uid(), until);

  return query select fresh, until;
end;
$$;

revoke all on function public.admin_issue_plan_code from public;
grant execute on function public.admin_issue_plan_code to authenticated;

-- ---------------------------------------------------------- using one
-- The row is locked before it is checked, so two redemptions of one code in
-- the same second cannot both pass the "not yet used" test.
create or replace function public.redeem_plan_code(code_in text)
returns table (new_plan text, active_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  base timestamptz;
  span interval;
  until timestamptz;
begin
  select * into c
  from public.plan_codes
  where code = upper(btrim(code_in))
  for update;

  if not found then
    raise exception 'code not found';
  end if;
  if not public.has_role(c.agency_id, array['owner']::public.member_role[]) then
    raise exception 'only the owner of this agency can use this code';
  end if;
  if c.used_at is not null then
    raise exception 'code already used';
  end if;
  if c.expires_at <= now() then
    raise exception 'code expired';
  end if;

  span := case c.cycle when 'annual' then interval '1 year' else interval '1 month' end;

  -- A renewal runs on from the current period rather than from today, so
  -- paying a week early does not cost a week.
  select greatest(coalesce(s.current_period_end, now()), now()) into base
  from public.subscriptions s
  where s.agency_id = c.agency_id;
  until := coalesce(base, now()) + span;

  insert into public.subscriptions (agency_id, plan, status, current_period_end)
  values (c.agency_id, c.plan, 'active', until)
  on conflict (agency_id) do update
    set plan = excluded.plan,
        status = 'active',
        current_period_end = excluded.current_period_end;

  update public.plan_codes
     set used_at = now(), used_by = auth.uid()
   where id = c.id;

  if c.request_id is not null then
    update public.plan_requests set status = 'paid' where id = c.request_id;
  end if;

  return query select c.plan, until;
end;
$$;

revoke all on function public.redeem_plan_code from public;
grant execute on function public.redeem_plan_code to authenticated;

comment on function public.redeem_plan_code is
  'Activates or renews the plan a one-time code was issued for. Owner of that agency only; the code dies on use.';
