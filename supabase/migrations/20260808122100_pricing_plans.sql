-- Charta Home · the pricing model
--
-- Five tiers, priced per country, sized by the number of apartments an agency
-- manages. That count is the only thing a tier restricts: an agency on Starter
-- can run as many buildings and colleagues as it likes, up to thirty flats.
--
-- What was here before was three rows keyed by an enum and priced in dollars
-- that nobody in Conakry or Douala pays in, gating buildings and team members
-- the product never actually gated. The enum stays as it is. Postgres allows
-- a new enum value inside a transaction but refuses to use it as a literal in
-- the same one, and this whole file is pasted as one transaction; a catalogue
-- table has no such rule, and a sixth tier one day is an insert rather than a
-- type change.
--
-- Prices are whole francs. GNF and XAF have no minor unit, so the smallest
-- unit and the franc are the same number.

-- ------------------------------------------------------------ the tiers
create table if not exists plans (
  code           text primary key,
  rank           smallint not null,
  min_apartments integer not null check (min_apartments >= 1),
  -- null is no ceiling at all
  max_apartments integer check (max_apartments is null or max_apartments >= min_apartments)
);

comment on table plans is
  'The five tiers. A tier is a band of managed apartments; nothing else is restricted.';

insert into plans (code, rank, min_apartments, max_apartments) values
  ('starter',    1,   1,  30),
  ('growth',     2,  31,  50),
  ('pro',        3,  51, 100),
  ('business',   4, 101, 250),
  ('enterprise', 5, 251, null)
on conflict (code) do update
  set rank           = excluded.rank,
      min_apartments = excluded.min_apartments,
      max_apartments = excluded.max_apartments;

-- ----------------------------------------------------------- the prices
-- One row per tier per country. A null price is a quote: Enterprise is priced
-- by conversation, and a country with no list yet gets no row at all.
create table if not exists plan_prices (
  plan     text not null references plans (code) on delete cascade,
  country  text not null,
  currency char(3) not null,
  monthly  bigint check (monthly is null or monthly > 0),
  annual   bigint check (annual is null or annual > 0),
  primary key (plan, country)
);

comment on table plan_prices is
  'Whole francs, per tier and country. Annual is ten months for twelve.';

insert into plan_prices (plan, country, currency, monthly, annual) values
  ('starter',    'Guinea',   'GNF', 175000, 1750000),
  ('growth',     'Guinea',   'GNF', 450000, 4500000),
  ('pro',        'Guinea',   'GNF', 500000, 5000000),
  ('business',   'Guinea',   'GNF', 850000, 8500000),
  ('enterprise', 'Guinea',   'GNF', null,   null),
  ('starter',    'Cameroon', 'XAF',  12000,  120000),
  ('growth',     'Cameroon', 'XAF',  30000,  300000),
  ('pro',        'Cameroon', 'XAF',  50000,  500000),
  ('business',   'Cameroon', 'XAF',  55000,  550000),
  ('enterprise', 'Cameroon', 'XAF', null,   null)
on conflict (plan, country) do update
  set currency = excluded.currency,
      monthly  = excluded.monthly,
      annual   = excluded.annual;

-- The price list is public: the marketing page reads it before anyone signs
-- in. Nothing but the service role writes it.
alter table plans       enable row level security;
alter table plan_prices enable row level security;

create policy plans_select       on plans       for select using (true);
create policy plan_prices_select on plan_prices for select using (true);

-- ---------------------------------------------- the subscription's plan
-- From the enum to the catalogue. Done once, and only while the column is
-- still the enum, so a second paste of this file finds nothing to do. The
-- one tier that changed its name is carried across.
do $$
begin
  if exists (
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_type t on t.oid = a.atttypid
    where n.nspname = 'public'
      and c.relname = 'subscriptions'
      and a.attname = 'plan'
      and t.typname = 'plan_tier'
  ) then
    alter table public.subscriptions alter column plan drop default;
    alter table public.subscriptions
      alter column plan type text
      using (case plan::text when 'agency' then 'enterprise' else plan::text end);
    alter table public.subscriptions alter column plan set default 'growth';
  end if;
end $$;

alter table subscriptions drop constraint if exists subscriptions_plan_fkey;
alter table subscriptions
  add constraint subscriptions_plan_fkey foreign key (plan) references plans (code);

-- An owner could update their own subscription row, which meant an owner
-- could set plan = 'enterprise' with one API call. Now that the plan is what
-- they pay for, only the service role moves it, once the money has arrived.
drop policy if exists subscriptions_update on subscriptions;

-- ------------------------------------------------ the old limits, gone
-- Buildings and members are no longer restricted, and the dollar list is
-- replaced by plan_prices. The table can go once nothing reads it.
drop trigger if exists buildings_plan_limit on buildings;
drop function if exists public.enforce_building_limit();
drop table if exists plan_limits;

-- ------------------------------------------------- the one restriction
-- Counted across the agency rather than the building, because the tier is
-- the agency's. An agency with no subscription row has no ceiling, which can
-- only be reached through the service role.
create or replace function public.enforce_apartment_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ceiling integer;
  used integer;
  plan_code text;
begin
  select s.plan, p.max_apartments
    into plan_code, ceiling
  from public.subscriptions s
  join public.plans p on p.code = s.plan
  where s.agency_id = new.agency_id;

  if ceiling is null then
    return new;
  end if;

  select count(*) into used from public.apartments where agency_id = new.agency_id;

  if used >= ceiling then
    raise exception 'plan limit reached: % apartments allowed on the % plan', ceiling, plan_code
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger apartments_plan_limit before insert on apartments
  for each row execute function public.enforce_apartment_limit();

-- ------------------------------------------------- signup picks a tier
-- The pricing page carries the chosen tier into signup. The old signature is
-- dropped rather than overloaded, because a six argument call would match
-- both and Postgres would refuse to choose.
drop function if exists public.create_agency_for_current_user(text, text, text, char, text, text);

create or replace function public.create_agency_for_current_user(
  agency_name text,
  agency_country text default 'Guinea',
  agency_city text default 'Conakry',
  agency_currency char(3) default 'GNF',
  agency_locale text default 'fr',
  owner_name text default null,
  plan_code text default 'growth'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_agency uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (select 1 from public.plans where code = plan_code) then
    raise exception 'unknown plan %', plan_code;
  end if;

  insert into public.agencies (name, country, city, currency, locale)
  values (agency_name, agency_country, agency_city, agency_currency, agency_locale)
  returning id into new_agency;

  insert into public.memberships (user_id, agency_id, role, full_name)
  values (auth.uid(), new_agency, 'owner', owner_name);

  insert into public.subscriptions (agency_id, plan, status)
  values (new_agency, plan_code, 'trialing');

  insert into public.reminder_rules (agency_id, offset_days, channel, escalation_step) values
    (new_agency, -3, 'whatsapp', 0),
    (new_agency,  0, 'whatsapp', 0),
    (new_agency,  5, 'whatsapp', 1),
    (new_agency, 10, 'whatsapp', 2);

  return new_agency;
end;
$$;

revoke all on function public.create_agency_for_current_user from public;
grant execute on function public.create_agency_for_current_user to authenticated;

-- ---------------------------------------------------- asking for a plan
-- There is no card form yet. An owner picks a tier and a cycle, the request
-- is recorded here, the team is emailed, and the agency pays by mobile money.
-- The team marks the row paid and moves the subscription; until then the
-- request is what the settings page shows.
create table if not exists plan_requests (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references agencies (id) on delete cascade,
  plan         text not null references plans (code),
  cycle        text not null check (cycle in ('monthly', 'annual')),
  currency     char(3) not null,
  -- null is a quote to be agreed
  amount       bigint check (amount is null or amount > 0),
  status       text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  requested_by uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists plan_requests_agency_idx on plan_requests (agency_id, created_at desc);

alter table plan_requests enable row level security;

-- Members read their own agency's requests. Nobody inserts directly: the
-- function below does, so the amount on the row is always the list price.
create policy plan_requests_select on plan_requests for select
  using (agency_id in (select public.current_agency_ids()));

-- The output names avoid currency and amount on purpose. Those are columns of
-- plan_requests, and an OUT parameter sharing a name with a column makes every
-- mention of it inside the body ambiguous.
create or replace function public.request_plan(
  target_agency uuid,
  plan_code text,
  cycle_in text
)
returns table (request_id uuid, paid_in char(3), due bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  price record;
  money bigint;
begin
  if not public.has_role(target_agency, array['owner']::public.member_role[]) then
    raise exception 'only the owner can choose a plan';
  end if;
  if cycle_in not in ('monthly', 'annual') then
    raise exception 'unknown billing cycle %', cycle_in;
  end if;
  if not exists (select 1 from public.plans where code = plan_code) then
    raise exception 'unknown plan %', plan_code;
  end if;

  select ag.country, ag.currency into a from public.agencies ag where ag.id = target_agency;

  select pp.currency, pp.monthly, pp.annual into price
  from public.plan_prices pp
  where pp.plan = plan_code and pp.country = a.country;

  if not found then
    -- No list for this country yet. Recorded as a quote in the agency's own
    -- currency, so the team knows what to reply in.
    return query
      insert into public.plan_requests (agency_id, plan, cycle, currency, amount, requested_by)
      values (target_agency, plan_code, cycle_in, a.currency, null, auth.uid())
      returning plan_requests.id, plan_requests.currency, plan_requests.amount;
    return;
  end if;

  money := case cycle_in when 'annual' then price.annual else price.monthly end;

  return query
    insert into public.plan_requests (agency_id, plan, cycle, currency, amount, requested_by)
    values (target_agency, plan_code, cycle_in, price.currency, money, auth.uid())
    returning plan_requests.id, plan_requests.currency, plan_requests.amount;
end;
$$;

revoke all on function public.request_plan from public;
grant execute on function public.request_plan to authenticated;

comment on function public.request_plan is
  'Records an owner''s choice of tier and cycle at the list price for the agency''s country. Owner only.';
