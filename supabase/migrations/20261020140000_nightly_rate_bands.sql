-- Charta Home · a nightly price that falls as the stay gets longer
--
-- A rate used to be one package: exactly three nights for exactly this much.
-- Agencies do not sell that way. They sell a nightly price that drops as the
-- stay lengthens, one to three nights at one rate, five to seven at another,
-- and the guest who wants four nights still has to be quoted something.
--
-- So a rate is a band now: from so many nights to so many, this much per
-- night. The total is the nights times the rate, which is the arithmetic the
-- agency does on the phone anyway.
--
-- Gaps in the bands are the reason this reads the way it does. An agency that
-- writes 1 to 3 and 5 to 7 has said nothing about four nights, and refusing
-- the booking would be absurd. Four nights takes the last band that starts at
-- or below four, which is the one to three rate: the guest has not yet
-- stayed long enough to have earned the longer stay discount.

alter table stay_rates add column if not exists min_nights    integer;
alter table stay_rates add column if not exists max_nights    integer;
alter table stay_rates add column if not exists price_per_night bigint;

-- What is already on file is a package of N nights for a total. Its nightly
-- rate is that total over those nights, and its band is exactly N.
--
-- Guarded because this file is pasted again every time a later migration
-- lands, and by then the package columns are gone. plpgsql parses only the
-- branch it takes, so naming them inside the `if` is safe once they are not
-- there any more.
do $backfill$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'stay_rates' and column_name = 'nights'
  ) then
    update public.stay_rates
       set min_nights      = coalesce(min_nights, nights),
           max_nights      = coalesce(max_nights, nights),
           price_per_night = coalesce(price_per_night, greatest(1, round(price::numeric / greatest(nights, 1))::bigint))
     where min_nights is null or price_per_night is null;
  end if;
end
$backfill$;

alter table stay_rates alter column min_nights set not null;
alter table stay_rates alter column price_per_night set not null;

alter table stay_rates drop constraint if exists stay_rates_band_sane;
alter table stay_rates add constraint stay_rates_band_sane
  check (
    min_nights between 1 and 365
    and (max_nights is null or (max_nights >= min_nights and max_nights <= 365))
    and price_per_night > 0
  );

-- One band per starting length. Two bands both starting at five nights is a
-- price list that cannot answer its own question.
alter table stay_rates drop constraint if exists stay_rates_apartment_id_nights_key;
drop index if exists stay_rates_apartment_id_nights_key;
create unique index if not exists stay_rates_apartment_min_key
  on stay_rates (apartment_id, min_nights);

-- The old shape goes, so nothing can read a package price that no longer
-- means anything.
alter table stay_rates drop column if exists nights;
alter table stay_rates drop column if exists price;

create index if not exists stay_rates_apartment_idx on stay_rates (apartment_id, min_nights);

comment on table stay_rates is
  'Nightly price by length of stay. A band runs from min_nights to max_nights; the total is nights times price_per_night.';

-- ------------------------------------------------------------- the quote
/**
 * What a stay of this many nights costs.
 *
 * The band containing the stay, or failing that the last band that starts at
 * or below it, so a length the agency never wrote a band for is still
 * quoted at the rate it has earned rather than refused.
 */
create or replace function public.stay_quote(target_apartment uuid, nights integer)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  rate bigint;
begin
  if nights < 1 then
    raise exception 'a stay is at least one night' using errcode = 'check_violation';
  end if;

  select r.price_per_night into rate
  from public.stay_rates r
  where r.apartment_id = target_apartment
    and r.min_nights <= stay_quote.nights
    and (r.max_nights is null or r.max_nights >= stay_quote.nights)
  order by r.min_nights desc
  limit 1;

  -- No band covers it. Fall back to the last one that starts at or below the
  -- stay, and failing that to the shortest band the agency sells.
  if rate is null then
    select r.price_per_night into rate
    from public.stay_rates r
    where r.apartment_id = target_apartment and r.min_nights <= stay_quote.nights
    order by r.min_nights desc
    limit 1;
  end if;
  if rate is null then
    select r.price_per_night into rate
    from public.stay_rates r
    where r.apartment_id = target_apartment
    order by r.min_nights asc
    limit 1;
  end if;

  if rate is null then
    raise exception 'this unit has no short-stay rates' using errcode = 'check_violation';
  end if;

  return rate * nights;
end;
$$;

grant execute on function public.stay_quote(uuid, integer) to anon, authenticated;
