"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "./server";
import { isSupabaseConfigured } from "./config";

/**
 * `demo` means no Supabase project is configured yet, so the caller should
 * fall back to the unauthenticated demo it used before. Once the environment
 * is set every path below becomes real.
 */
export type AuthResult = { error?: string; demo?: boolean } | undefined;

export async function signIn(
  locale: string,
  formData: FormData
): Promise<AuthResult> {
  if (!isSupabaseConfigured()) return { demo: true };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/dashboard`, "layout");
  redirect(`/${locale}/dashboard`);
}

export async function signUp(
  locale: string,
  formData: FormData
): Promise<AuthResult> {
  if (!isSupabaseConfigured()) return { demo: true };

  const supabase = await createClient();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("name") ?? "").trim();
  const agencyName = String(formData.get("agency") ?? "").trim();
  const country = String(formData.get("country") ?? "Guinea");
  const city = String(formData.get("city") ?? "Conakry");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) return { error: error.message };
  if (!data.session) {
    // Email confirmation is on; the agency is created after the first sign in.
    return { error: "confirm-email" };
  }

  // One RPC creates the agency, the owner membership, the trial and the
  // default reminder cadence, in a single transaction.
  const { error: rpcError } = await supabase.rpc("create_agency_for_current_user", {
    agency_name: agencyName,
    agency_country: country,
    agency_city: city,
    agency_currency: country === "Guinea" ? "GNF" : "USD",
    agency_locale: locale === "en" ? "en" : "fr",
    owner_name: fullName,
  });
  if (rpcError) return { error: rpcError.message };

  revalidatePath(`/${locale}/dashboard`, "layout");
  redirect(`/${locale}/dashboard`);
}

export async function requestPasswordReset(
  locale: string,
  formData: FormData
): Promise<AuthResult> {
  if (!isSupabaseConfigured()) return { demo: true };

  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${site}/${locale}/reset-password`,
  });
  if (error) return { error: error.message };
}

export async function updatePassword(
  locale: string,
  formData: FormData
): Promise<AuthResult> {
  if (!isSupabaseConfigured()) return { demo: true };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: String(formData.get("password") ?? ""),
  });
  if (error) return { error: error.message };
  redirect(`/${locale}/login`);
}

export async function signOut(locale: string) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect(`/${locale}/login`);
}
