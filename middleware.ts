import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, locales } from "./lib/i18n";
import { refreshSession } from "./lib/supabase/middleware";

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
  const { user, configured } = await refreshSession(request, response);

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

  return response;
}

export const config = {
  // Metadata routes such as /apple-icon carry no extension, so they need
  // naming here or the locale redirect swallows them.
  matcher: ["/((?!_next|api|photos|icon|apple-icon|manifest|opengraph-image|.*\\.).*)"],
};
