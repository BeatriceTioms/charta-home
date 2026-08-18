-- Charta Home · development seed
-- Mirrors the mock portfolio the UI was designed against, so a fresh local
-- database looks like the designs. Run automatically by `supabase db reset`.
--
-- Amounts are in GNF (no subunit). The demo user is created below; sign in with
-- amina@horizonrealty.gn / chartahome2026

do $$
declare
  demo_user uuid;
  agency uuid;
  b_palmiers uuid;
  b_ocean uuid;
  b_andalouse uuid;
  apt uuid;
  lease uuid;
begin
  -- Running this twice would build a second Horizon Realty beside the first,
  -- so stop early instead. Wipe the agency to reseed from scratch.
  if exists (select 1 from agencies where name = 'Horizon Realty') then
    raise notice 'Demo agency already present, nothing seeded.';
    return;
  end if;

  -- A confirmed demo user, created the way GoTrue would.
  --
  -- Look first rather than upserting: Supabase makes auth.users.email unique
  -- through a PARTIAL index (where is_sso_user = false), and "on conflict
  -- (email)" cannot match a partial index.
  select id into demo_user from auth.users where email = 'amina@horizonrealty.gn';

  if demo_user is null then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    )
    values (
      '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
      'amina@horizonrealty.gn', crypt('chartahome2026', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Amina Sow"}'
    )
    returning id into demo_user;

    -- GoTrue looks for a matching identity on password sign in. Guarded because
    -- the column names here have changed across releases, and a seed that
    -- cannot write an identity should still leave a usable portfolio behind.
    begin
      insert into auth.identities (
        provider_id, user_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      )
      values (
        demo_user::text, demo_user,
        jsonb_build_object('sub', demo_user::text, 'email', 'amina@horizonrealty.gn'),
        'email', now(), now(), now()
      );
    exception when others then
      raise notice 'auth.identities not seeded (%). Sign in may need a password reset.', sqlerrm;
    end;
  end if;

  insert into agencies (name, country, city, currency, locale, whatsapp_number)
  values ('Horizon Realty', 'Guinea', 'Conakry', 'GNF', 'fr', '+224620000000')
  returning id into agency;

  insert into memberships (user_id, agency_id, role, full_name)
  values (demo_user, agency, 'owner', 'Amina Sow');

  -- The helper functions check has_role(), which reads auth.uid(). Act as the
  -- demo owner for the rest of this transaction so the seed goes through the
  -- same code path the app uses.
  perform set_config('request.jwt.claim.sub', demo_user::text, true);

  insert into subscriptions (agency_id, plan, status) values (agency, 'growth', 'trialing');

  insert into reminder_rules (agency_id, offset_days, channel, escalation_step) values
    (agency, -3, 'whatsapp', 0),
    (agency,  0, 'whatsapp', 0),
    (agency,  5, 'whatsapp', 1),
    (agency, 10, 'whatsapp', 2);

  -- ------------------------------------------------------------- buildings
  insert into buildings (agency_id, name, address, city, market_value, amenities)
  values (agency, 'Résidence Les Palmiers', '14 Avenue des Palmiers', 'Kaloum', 1400000000,
          array['Terrasse sur le toit', 'Parking sécurisé', 'Conciergerie', 'Internet fibre'])
  returning id into b_palmiers;

  insert into buildings (agency_id, name, address, city, market_value, amenities)
  values (agency, 'Immeuble Océan', '3 Boulevard de la Corniche', 'Camayenne', 1100000000,
          array['Balcons vue mer', 'Parking souterrain', 'Groupe électrogène'])
  returning id into b_ocean;

  insert into buildings (agency_id, name, address, city, market_value, amenities)
  values (agency, 'Villa Andalouse', '27 Rue des Jardins', 'Kipé', 800000000,
          array['Jardin privé', 'Piscine', 'Salle de sport équipée', 'Parking visiteurs'])
  returning id into b_andalouse;

  -- Leases. `intent` decides how the history is settled below:
  --   paid    every charge including August is settled
  --   pending charges up to July settled, August still open and not yet due
  --   overdue charges up to July settled, August open and past its due date
  create temporary table seed_leases (lease_id uuid, intent text) on commit drop;

  -- ------------------------------------------------- Les Palmiers, 5 units
  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values (agency, b_palmiers, 'Apt 1A', 3, 2, 92, 1450000) returning id into apt;
  select public.create_lease(apt, 'Mariam Diallo', '+224620142231', 1450000, 'monthly', date '2026-03-01') into lease;
  insert into seed_leases values (lease, 'paid');

  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values (agency, b_palmiers, 'Apt 1B', 2, 1, 68, 1100000) returning id into apt;
  select public.create_lease(apt, 'Karim Osei', '+224620148804', 1100000, 'monthly', date '2026-01-01') into lease;
  insert into seed_leases values (lease, 'paid');

  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values (agency, b_palmiers, 'Apt 2A', 3, 2, 95, 1500000) returning id into apt;
  select public.create_lease(apt, 'Sofia Benali', '+224620193327', 1500000, 'monthly', date '2026-01-01') into lease;
  insert into seed_leases values (lease, 'pending');

  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values (agency, b_palmiers, 'Apt 2B', 1, 1, 44, 780000) returning id into apt;
  select public.create_lease(apt, 'Jonas Petit', '+224620167719', 780000, 'monthly', date '2026-06-01') into lease;
  insert into seed_leases values (lease, 'overdue');

  -- Vacant, no lease.
  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values (agency, b_palmiers, 'Apt 3A', 4, 3, 120, 1950000);

  -- ------------------------------------------------------ Océan, 4 units
  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values (agency, b_ocean, 'Apt 101', 2, 1, 70, 1200000) returning id into apt;
  select public.create_lease(apt, 'Awa Traoré', '+224620215540', 1200000, 'monthly', date '2026-01-01') into lease;
  insert into seed_leases values (lease, 'paid');

  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values (agency, b_ocean, 'Apt 102', 2, 1, 72, 1250000) returning id into apt;
  select public.create_lease(apt, 'Daniel Mensah', '+224620238812', 1250000, 'monthly', date '2026-02-01') into lease;
  insert into seed_leases values (lease, 'overdue');

  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values (agency, b_ocean, 'Apt 201', 3, 2, 88, 1400000) returning id into apt;
  select public.create_lease(apt, 'Leïla Haddad', '+224620273390', 1400000, 'monthly', date '2026-01-01') into lease;
  insert into seed_leases values (lease, 'paid');

  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values (agency, b_ocean, 'Apt 202', 3, 2, 90, 1420000);

  -- -------------------------------------------------- Andalouse, 3 suites
  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values (agency, b_andalouse, 'Suite Jardin', 4, 3, 140, 2400000) returning id into apt;
  select public.create_lease(apt, 'Nadia El Fassi', '+224620316684', 2400000, 'monthly', date '2026-01-01') into lease;
  insert into seed_leases values (lease, 'paid');

  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values (agency, b_andalouse, 'Suite Terrasse', 3, 2, 110, 2100000) returning id into apt;
  select public.create_lease(apt, 'Omar Sy', '+224620331108', 2100000, 'monthly', date '2026-01-01') into lease;
  insert into seed_leases values (lease, 'paid');

  insert into apartments (agency_id, building_id, label, rooms, bathrooms, sqm, base_rent)
  values (agency, b_andalouse, 'Suite Cour', 2, 1, 80, 1600000) returning id into apt;
  select public.create_lease(apt, 'Ines Barka', '+224620379925', 1600000, 'monthly', date '2026-07-01') into lease;
  insert into seed_leases values (lease, 'pending');

  -- ------------------------------------------- generate and settle history
  declare
    sl record;
    m date;
    owed bigint;
    august_amount bigint;
  begin
    for sl in select * from seed_leases loop
      -- A charge for every month from the lease start through August 2026.
      for m in
        select generate_series(
          (select date_trunc('month', starts_on)::date from leases where id = sl.lease_id),
          date '2026-08-01',
          interval '1 month'
        )::date
      loop
        perform public.ensure_rent_charge(sl.lease_id, m);
      end loop;

      select coalesce(sum(balance), 0) into owed
      from public.v_charge_status where lease_id = sl.lease_id;

      select coalesce(sum(amount), 0) into august_amount
      from public.rent_charges
      where lease_id = sl.lease_id and period_start = date '2026-08-01';

      if sl.intent = 'paid' then
        if owed > 0 then
          perform public.record_payment(sl.lease_id, owed, 'orange_money', date '2026-08-02');
        end if;
      else
        -- Settle everything except August, leaving one open charge.
        if owed - august_amount > 0 then
          perform public.record_payment(sl.lease_id, owed - august_amount, 'cash', date '2026-07-30');
        end if;
        if sl.intent = 'pending' then
          -- Not due yet: push the due date into the future.
          update public.rent_charges
          set due_on = current_date + 7
          where lease_id = sl.lease_id and period_start = date '2026-08-01';
        end if;
      end if;
    end loop;
  end;

  -- ----------------------------------------------------------- technicians
  insert into technicians (agency_id, full_name, trade, phone_e164) values
    (agency, 'B. Keita', 'plombier', '+224620400001'),
    (agency, 'S. Diop', 'serrurier', '+224620400002'),
    (agency, 'M. Fall', 'menuisier', '+224620400003'),
    (agency, 'A. Ndiaye', 'électricien', '+224620400004');

  -- --------------------------------------------------------------- tickets
  insert into tickets (agency_id, building_id, apartment_id, title, status, reported_via, priority, opened_at)
  select agency, b_palmiers, a.id, 'Chauffe eau en panne', 'in_progress', 'whatsapp', 'high', now() - interval '4 days'
  from apartments a where a.building_id = b_palmiers and a.label = 'Apt 2A';

  insert into tickets (agency_id, building_id, title, status, reported_via, opened_at)
  values (agency, b_ocean, 'Serrure du portail bloquée', 'assigned', 'whatsapp', now() - interval '3 days');

  insert into tickets (agency_id, building_id, apartment_id, title, status, reported_via, opened_at)
  select agency, b_palmiers, a.id, 'Fuite du robinet de cuisine', 'new', 'whatsapp', now() - interval '1 day'
  from apartments a where a.building_id = b_palmiers and a.label = 'Apt 1B';

  -- A resolved one, so the maintenance page has history and a cost.
  insert into tickets (agency_id, building_id, title, status, reported_via, cost, opened_at, resolved_at)
  values (agency, b_andalouse, 'Joint de porte balcon usé', 'resolved', 'whatsapp', 850000,
          now() - interval '20 days', now() - interval '14 days');

  insert into expenses (agency_id, building_id, category, amount, incurred_on, description)
  values (agency, b_andalouse, 'maintenance', 850000, current_date - 14, 'Joint de porte balcon usé');

  -- ---------------------------------------------------------------- events
  insert into events (agency_id, building_id, kind, title, detail, starts_at, assignee) values
    (agency, b_palmiers, 'viewing', 'Visite', 'Apt 3A · 2 personnes', date_trunc('day', now()) + interval '9 hours', 'KD'),
    (agency, b_palmiers, 'work', 'Plomberie', 'Apt 2A · intervention chauffe eau', date_trunc('day', now()) + interval '10 hours', 'BK'),
    (agency, b_palmiers, 'inspection', 'Inspection', 'Parties communes · visite trimestrielle', date_trunc('day', now()) + interval '14 hours', 'AS'),
    (agency, b_ocean, 'work', 'Serrurerie', 'Portail · remplacement de serrure', date_trunc('day', now()) + interval '9 hours 30 minutes', 'SD'),
    (agency, b_andalouse, 'work', 'Entretien du jardin', 'Passage hebdomadaire', date_trunc('day', now()) + interval '10 hours 30 minutes', 'MF');

  raise notice 'Seeded agency % with 3 buildings and 12 apartments', agency;
end $$;
