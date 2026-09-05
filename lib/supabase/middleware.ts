import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the Supabase session cookie on every request and reports whether a
 * user is signed in, so the locale middleware can guard /dashboard.
 *
 * If Supabase is not configured yet the app keeps working unauthenticated,
 * which keeps local development possible before the project exists.
 */
export async function refreshSession(request: NextRequest, response: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { response, user: null, configured: false };

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        list.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user, configured: true, supabase };
}

/**
 * The dashboard pages this user may open.
 *
 * Read here rather than trusted from the interface, because hiding a link is
 * not the same as closing a route: a caretaker who has been given the address
 * of the rent page would otherwise simply type it. What is behind these pages
 * is still guarded by row level security, so this decides what somebody is
 * shown, not what they could reach if this were wrong.
 */
export async function allowedPagesFor(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("memberships")
    .select("allowed_pages")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  // A failure here must not lock somebody out of their own dashboard, so an
  // error reads as "no opinion" and the request carries on. That covers the
  // window between a deployment and its migration, when the column does not
  // exist yet and every dashboard route would otherwise redirect.
  if (error || !data) return null;
  return (data.allowed_pages as string[] | null) ?? null;
}

/**
 * Whether this person sits at the platform's own desk.
 *
 * Asked of the database on every request to /admin, because the answer is a
 * row somebody at Charta Home inserted by hand and nothing in the browser can
 * be trusted to say it. A failure reads as "no", which is the safe direction
 * for a page that sees every agency.
 */
export async function isPlatformAdmin(
  supabase: ReturnType<typeof createServerClient>
): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_platform_admin");
  return !error && data === true;
}
