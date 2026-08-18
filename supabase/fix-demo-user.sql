-- Charta Home · repair a hand seeded auth user
--
-- GoTrue reads several auth.users columns into non nullable strings. A row
-- inserted directly with SQL leaves them NULL, and every read of that row then
-- fails with "Database error querying schema" on sign in, or "Database error
-- finding users" from the admin API.
--
-- Run once against a project seeded before this was fixed. Safe to re-run, and
-- safe on projects where only some of these columns exist.

do $$
declare
  col text;
  touched int := 0;
begin
  for col in
    select column_name
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and data_type in ('text', 'character varying')
      and column_name in (
        'confirmation_token', 'recovery_token', 'email_change',
        'email_change_token_new', 'email_change_token_current',
        'phone_change', 'phone_change_token', 'reauthentication_token'
      )
  loop
    execute format(
      'update auth.users set %I = %L where %I is null', col, '', col
    );
    touched := touched + 1;
  end loop;

  raise notice 'Normalised % token column(s) on auth.users.', touched;
end $$;
