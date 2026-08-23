-- Charta Home · which pages a colleague sees
--
-- Roles decide what somebody may do to the data, and row level security
-- enforces that. What they did not decide is what somebody is shown. A
-- caretaker who only ever fixes taps was handed the whole dashboard, rent
-- collection included, and had to know for themselves which parts were not
-- their business.
--
-- This is navigation, not security. It is written down here rather than in the
-- interface so the server can honour it too: hiding a link while leaving the
-- route open is theatre, and the route is closed in the dashboard layout using
-- exactly this column. The data underneath stays guarded by RLS either way,
-- which is the difference between a menu that is tidy and a rule that holds.

-- The four working pages. Settings is deliberately absent: it is where a
-- person sets their own name, and its agency fields are already owner only,
-- so removing it would only strand somebody with a misspelled name.
create or replace function public.default_pages_for_role(r member_role)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case r
    when 'owner'      then array['dashboard', 'apartments', 'rent', 'maintenance']
    when 'manager'    then array['dashboard', 'apartments', 'rent', 'maintenance']
    -- Money, and the portfolio it comes from. Not the repairs.
    when 'accountant' then array['dashboard', 'rent']
    -- The jobs, and the units they are in. Not what anybody pays.
    when 'caretaker'  then array['dashboard', 'maintenance']
    else array['dashboard']
  end;
$$;

alter table memberships
  add column if not exists allowed_pages text[];

-- Everyone already in an agency keeps what their role implies, so nobody
-- loses a page they were using this morning.
update memberships
   set allowed_pages = public.default_pages_for_role(role)
 where allowed_pages is null;

-- No column default: a fixed one would give every new colleague the same
-- menu whatever they were hired to do, which is how a caretaker ended up
-- with nothing but the dashboard. The trigger below fills it from the role
-- instead, and runs before the not null check.
alter table memberships
  alter column allowed_pages drop default,
  alter column allowed_pages set not null;

create or replace function public.membership_default_pages()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.allowed_pages is null then
    new.allowed_pages := public.default_pages_for_role(new.role);
  end if;
  return new;
end;
$$;

drop trigger if exists memberships_default_pages on memberships;
create trigger memberships_default_pages
  before insert on memberships
  for each row execute function public.membership_default_pages();

-- A page name that does not exist would silently hide a link, so the set is
-- closed rather than free text.
alter table memberships
  drop constraint if exists memberships_allowed_pages_known;
alter table memberships
  add constraint memberships_allowed_pages_known
  check (allowed_pages <@ array['dashboard', 'apartments', 'rent', 'maintenance']);

comment on column memberships.allowed_pages is
  'Sidebar pages this member may open. Navigation only: RLS still guards the data.';

/**
 * Sets what a colleague may see.
 *
 * Owner only, and it cannot reach role, so the one function an owner uses to
 * tidy a menu can never be the one that quietly promotes somebody. An owner
 * cannot narrow their own view either, which would otherwise be a way to lock
 * the last owner out of the agency's own settings.
 */
create or replace function public.set_member_pages(
  target_agency uuid,
  target_user uuid,
  pages text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role(target_agency, array['owner']::public.member_role[]) then
    raise exception 'only the owner can change what a colleague sees';
  end if;

  if target_user = auth.uid() then
    raise exception 'an owner cannot restrict their own access';
  end if;

  update public.memberships
     set allowed_pages = coalesce(pages, array['dashboard'])
   where agency_id = target_agency
     and user_id = target_user;
end;
$$;

revoke all on function public.set_member_pages from public;
grant execute on function public.set_member_pages to authenticated;
grant execute on function public.default_pages_for_role to authenticated;

-- ------------------------------------------------------- the team roster
-- The roster now has to carry what each colleague may see, so the settings
-- page can show it and change it. Dropped and recreated because the return
-- type is changing, which `create or replace` will not do.
drop function if exists public.list_agency_members(uuid);

create or replace function public.list_agency_members(target_agency uuid)
returns table (
  user_id       uuid,
  full_name     text,
  role          public.member_role,
  email         text,
  allowed_pages text[],
  created_at    timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_member(target_agency) then
    raise exception 'not a member of this agency';
  end if;

  return query
    select m.user_id, m.full_name, m.role, u.email::text, m.allowed_pages, m.created_at
    from public.memberships m
    join auth.users u on u.id = m.user_id
    where m.agency_id = target_agency
    order by m.created_at;
end;
$$;

grant execute on function public.list_agency_members to authenticated;

comment on function public.list_agency_members is
  'The settings team roster, email and page access included. Raises unless the caller belongs to the agency.';
