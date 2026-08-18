/**
 * Whether a Supabase project is wired up yet.
 *
 * Both variables are NEXT_PUBLIC, so this answers the same on the server and
 * in the browser. Until they are set the app runs on the mock data in
 * `lib/data.ts`, which is what keeps the demo usable before the project
 * exists. The middleware guard makes the same check.
 */
export const isSupabaseConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
