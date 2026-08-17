-- Charta Home · foundations
-- Agencies are the tenants of the SaaS. Everything else hangs off an agency_id
-- and is protected by row level security based on membership.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------- enums

create type member_role as enum ('owner', 'manager', 'accountant', 'caretaker');
create type lease_cycle as enum ('monthly', 'yearly');
create type lease_status as enum ('upcoming', 'active', 'ended');
create type charge_status as enum ('open', 'paid', 'void');
create type payment_method as enum ('cash', 'orange_money', 'mtn_momo', 'bank_transfer', 'card', 'other');
create type ticket_status as enum ('new', 'assigned', 'in_progress', 'resolved', 'cancelled');
create type ticket_priority as enum ('normal', 'high', 'urgent');
create type report_channel as enum ('whatsapp', 'sms', 'phone', 'email', 'in_person');
create type event_kind as enum ('viewing', 'work', 'inspection', 'other');
create type plan_tier as enum ('starter', 'growth', 'agency');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled');

-- ---------------------------------------------------------------- agencies

create table agencies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(btrim(name)) > 0),
  country         text not null default 'Guinea',
  city            text not null default 'Conakry',
  currency        char(3) not null default 'GNF',
  locale          text not null default 'fr' check (locale in ('fr', 'en')),
  whatsapp_number text,
  logo_path       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table memberships (
  user_id    uuid not null references auth.users (id) on delete cascade,
  agency_id  uuid not null references agencies (id) on delete cascade,
  role       member_role not null default 'manager',
  full_name  text,
  created_at timestamptz not null default now(),
  primary key (user_id, agency_id)
);

create index memberships_user_idx on memberships (user_id);
create index memberships_agency_idx on memberships (agency_id);

-- ------------------------------------------------- rls helper functions
-- SECURITY DEFINER so policies can read memberships without recursing into
-- the policies on memberships itself.

create or replace function public.current_agency_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select agency_id from public.memberships where user_id = auth.uid()
$$;

create or replace function public.is_member(target_agency uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and agency_id = target_agency
  )
$$;

create or replace function public.has_role(target_agency uuid, allowed member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and agency_id = target_agency
      and role = any(allowed)
  )
$$;

comment on function public.current_agency_ids is
  'Agencies the signed in user belongs to. Used by every RLS policy.';

-- ---------------------------------------------------------------- updated_at

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger agencies_touch before update on agencies
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- policies

alter table agencies enable row level security;
alter table memberships enable row level security;

create policy agencies_select on agencies for select
  using (id in (select public.current_agency_ids()));

create policy agencies_update on agencies for update
  using (public.has_role(id, array['owner', 'manager']::member_role[]))
  with check (public.has_role(id, array['owner', 'manager']::member_role[]));

-- Insert is done through public.create_agency_for_current_user, never directly.

create policy memberships_select on memberships for select
  using (agency_id in (select public.current_agency_ids()));

create policy memberships_insert on memberships for insert
  with check (public.has_role(agency_id, array['owner']::member_role[]));

create policy memberships_update on memberships for update
  using (public.has_role(agency_id, array['owner']::member_role[]))
  with check (public.has_role(agency_id, array['owner']::member_role[]));

create policy memberships_delete on memberships for delete
  using (
    public.has_role(agency_id, array['owner']::member_role[])
    or user_id = auth.uid()
  );
