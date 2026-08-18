-- Charta Home · settings page support
--
-- The settings screen needs the team roster with each member's email, and
-- auth.users is not reachable through PostgREST. list_agency_members bridges
-- it the same way the rest of the schema bridges auth: a security definer
-- function that checks membership itself rather than trusting the caller.

create or replace function public.list_agency_members(target_agency uuid)
returns table (
  user_id    uuid,
  full_name  text,
  role       public.member_role,
  email      text,
  created_at timestamptz
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
    select m.user_id, m.full_name, m.role, u.email::text, m.created_at
    from public.memberships m
    join auth.users u on u.id = m.user_id
    where m.agency_id = target_agency
    order by m.created_at;
end;
$$;

grant execute on function public.list_agency_members to authenticated;

comment on function public.list_agency_members is
  'The settings team roster, email included. Raises unless the caller belongs to the agency.';
