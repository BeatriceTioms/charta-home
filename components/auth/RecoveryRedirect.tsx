"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";

/**
 * Catches an invitation or recovery token that arrived on the wrong page.
 *
 * Supabase decides for itself where to send somebody after it has verified a
 * link. It honours the destination we asked for only when that address is
 * listed under Authentication > URL Configuration > Redirect URLs; otherwise
 * it quietly falls back to the project's Site URL, which is the bare domain.
 * The result is a colleague landing on the marketing page with their token in
 * the address bar and no way to set a password.
 *
 * That is configuration, and it should be fixed there. But an invitation is
 * the first thing a new colleague ever sees, and it should not depend on a
 * dashboard setting being right, so the token is picked up wherever it lands
 * and carried to the page that can use it.
 *
 * The token arrives in the URL fragment, which browsers never send to a
 * server, so this cannot be middleware: only the page itself can see it.
 */
export function RecoveryRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useI18n();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;

    const params = new URLSearchParams(hash.slice(1));
    const hasToken = params.has("access_token");
    const hasError = params.has("error") || params.has("error_description");
    if (!hasToken && !hasError) return;

    const target = `/${locale}/reset-password`;
    if (pathname === target) return;

    // The fragment travels with them: the reset page needs it to know who is
    // asking, and Supabase's client reads it from the address bar.
    router.replace(`${target}${hash}`);
  }, [router, pathname, locale]);

  return null;
}
