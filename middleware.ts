import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, locales } from "./lib/i18n";
import { allowedPagesFor, refreshSession } from "./lib/supabase/middleware";

const PUBLIC_FILE = /\.(png|jpg|jpeg|svg|ico|webp|txt|xml|json|webmanifest)$/;

function preferredLocale(request: NextRequest) {
  const cookie = request.cookies.get("charta-locale")?.value;
  if (cookie && (locales as readonly string[]).includes(cookie)) return cookie;

  const header = request.headers.get("accept-language") ?? "";
  // Guinea speaks French, so anything that is not clearly English gets French.
  return header.toLowerCase().startsWith("en") ? "en" : defaultLocale;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/photos") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Send anything without a locale prefix to the right language first.
  const hasLocale = locales.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)
  );
  if (!hasLocale) {
    const url = request.nextUrl.clone();
    url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  // Keep the Supabase session fresh, and guard the dashboard.
  const response = NextResponse.next({ request });
  const { user, configured, supabase } = await refreshSession(request, response);

  const locale = pathname.split("/")[1];
  const isDashboard = pathname.startsWith(`/${locale}/dashboard`);
  const isAuthPage = ["/login", "/signup", "/forgot-password", "/reset-password"].some(
    (p) => pathname === `/${locale}${p}`
  );

  if (configured && isDashboard && !user) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (configured && isAuthPage && user && pathname !== `/${locale}/reset-password`) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/dashboard`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  // A colleague only sees some of the dashboard, and the route has to agree
  // with the menu. Checked after the sign in guard, so an unauthenticated
  // visitor is sent to log in rather than told a page does not exist.
  if (configured && user && supabase && isDashboard) {
    const page = dashboardPage(pathname, locale);
    if (page) {
      const allowed = await allowedPagesFor(supabase, user.id);
      if (allowed && !allowed.includes(page)) {
        const url = request.nextUrl.clone();
        url.pathname = `/${locale}/dashboard`;
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

/**
 * Which sidebar page a path belongs to, or null for anything not gated.
 *
 * Sub paths count as their section: a unit's own page is part of Apartments,
 * so somebody who may see the list may see what is in it. Settings is never
 * gated, because it is where a person sets their own name and its agency
 * fields are already owner only.
 */
function dashboardPage(pathname: string, locale: string): string | null {
  const rest = pathname.slice(`/${locale}/dashboard`.length).replace(/^\//, "");
  if (rest === "") return "dashboard";
  const section = rest.split("/")[0];
  return ["apartments", "rent", "maintenance"].includes(section) ? section : null;
}

export const config = {
  // Metadata routes such as /apple-icon carry no extension, so they need
  // naming here or the locale redirect swallows them.
  matcher: ["/((?!_next|api|photos|icon|apple-icon|manifest|opengraph-image|.*\\.).*)"],
};
