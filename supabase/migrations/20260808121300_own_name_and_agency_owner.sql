-- Charta Home · your own name, and whose agency it is
--
-- Two rules that were wrong in opposite directions. Nobody but the owner could
-- change a name, including their own, and anyone the owner made a manager
-- could rename the agency and change the number tenants reply to.

-- ------------------------------------------------------ setting your own name
-- Opening memberships_update to `user_id = auth.uid()` would have let a manager
-- set their own role to owner, which is the whole of the permission system
-- given away for the sake of a text field. The name is changed through a
-- function instead, which can touch that one column and nothing else.

create or replace function public.set_my_display_name(
  target_agency uuid,
  new_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  trimmed text := btrim(new_name);
begin
  if trimmed = '' then
    raise exception 'a name cannot be empty'
      using errcode = 'check_violation';
  end if;
  if length(trimmed) > 120 then
    raise exception 'that name is too long'
      using errcode = 'check_violation';
  end if;

  -- Membership in the agency is the whole of the authorisation: you are
  -- setting your own name, on your own row.
  if not public.is_member(target_agency) then
    raise exception 'not a member of this agency';
  end if;

  update public.memberships
     set full_name = trimmed
   where agency_id = target_agency
     and user_id = auth.uid();
end;
$$;

revoke all on function public.set_my_display_name from public;
grant execute on function public.set_my_display_name to authenticated;

comment on function public.set_my_display_name is
  'Sets the caller''s own display name. Cannot reach role, or anyone else''s row.';

-- ------------------------------------------------- who owns the agency record
-- The agency's name and its WhatsApp number are its identity: the name on a
-- receipt, and the number a tenant replies to. Someone invited to help manage
-- the portfolio has no business changing either. Managers keep every other
-- permission they had; this narrows one table.

drop policy if exists agencies_update on agencies;
create policy agencies_update on agencies for update
  using (public.has_role(id, array['owner']::member_role[]))
  with check (public.has_role(id, array['owner']::member_role[]));
