-- ---------------------------------------------------------------------------
-- A repair request names the home it is for.
--
-- The app used to file every request against the resident's latest active
-- lease, so a guest on a short stay could not report anything, and someone
-- renting two units could not say which one leaked. Now the app sends the
-- apartment the person picked, and the request is accepted only for a home
-- they are in right now: an active lease of theirs, or a paid stay running
-- today. The six-argument version stays for app builds already installed.
-- ---------------------------------------------------------------------------

create or replace function public.resident_create_ticket(
  title_in text,
  description_in text,
  category_in text,
  priority_in text,
  location_in text,
  photo_paths_in text[],
  apartment_in uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ap record;
  res uuid;
  t record;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  if apartment_in is null then
    raise exception 'choose the home this request is for' using errcode = 'check_violation';
  end if;
  if length(btrim(coalesce(title_in, ''))) = 0 then
    raise exception 'a ticket needs a title' using errcode = 'check_violation';
  end if;

  -- Their tenancy in this home, or else a paid stay there today.
  select le.resident_id into res
  from public.leases le
  where le.apartment_id = apartment_in
    and le.status = 'active'
    and le.resident_id in (select public.current_resident_ids())
  order by le.starts_on desc
  limit 1;
  if not found then
    perform 1
    from public.stays s
    where s.apartment_id = apartment_in
      and s.guest_user_id = auth.uid()
      and s.status <> 'cancelled'
      and s.paid > 0
      and current_date between s.check_in and s.check_out;
    if not found then
      raise exception 'you can only report on a home you are in' using errcode = 'insufficient_privilege';
    end if;
  end if;

  select id, agency_id, building_id into ap from public.apartments where id = apartment_in;

  insert into public.tickets
    (agency_id, building_id, apartment_id, resident_id, title, description, priority,
     reported_via, category, location, photo_paths)
  values
    (ap.agency_id, ap.building_id, ap.id, res, btrim(title_in), description_in,
     coalesce(nullif(priority_in, ''), 'normal')::public.ticket_priority, 'app',
     category_in, location_in,
     -- Only the user's own uploads are accepted.
     coalesce(array(select p from unnest(photo_paths_in) p where p like auth.uid()::text || '/%'), '{}'))
  returning id, number into t;

  insert into public.ticket_messages (agency_id, ticket_id, direction, body)
  values (ap.agency_id, t.id, 'inbound', description_in);

  return jsonb_build_object('id', t.id, 'number', t.number);
end;
$$;

revoke all on function public.resident_create_ticket(text, text, text, text, text, text[], uuid) from public, anon;
grant execute on function public.resident_create_ticket(text, text, text, text, text, text[], uuid) to authenticated;
