"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "./server";
import { isSupabaseConfigured } from "./config";
import { isEmailConfigured, passwordResetEmail, sendEmail, welcomeEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";
import { currencyFor, isPlanCode } from "@/lib/pricing";

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

  // Where the middleware sent them from, if anywhere. Only a path on this
  // site is honoured: an absolute address here would be an open redirect.
  const next = String(formData.get("next") ?? "");
  if (next.startsWith(`/${locale}/`) && !next.startsWith("//")) {
    revalidatePath(next, "layout");
    redirect(next);
  }

  // Charta Home's own staff are not agencies. They have no portfolio to
  // land on, so they land on the desk.
  const { data: staff } = await supabase.rpc("is_platform_admin");
  if (staff === true) redirect(`/${locale}/admin`);

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
  // The tier chosen on the pricing page, carried through the form. Anything
  // else, including nothing, starts the trial on Growth as before.
  const chosen = formData.get("plan");
  const plan = isPlanCode(chosen) ? chosen : "growth";

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
    // Was GNF for Guinea and dollars for everyone else, so an agency in
    // Douala was billing its tenants in a currency none of them hold.
    agency_currency: currencyFor(country),
    agency_locale: locale === "en" ? "en" : "fr",
    owner_name: fullName,
    plan_code: plan,
  });
  if (rpcError) return { error: rpcError.message };

  // The welcome is worth sending but never worth blocking on: the agency
  // exists either way, and a mail outage should not look like a failed signup.
  if (isEmailConfigured()) {
    const message = welcomeEmail({
      agencyName: agencyName,
      ownerName: fullName || email.split("@")[0],
      dashboardUrl: `${siteUrl()}/${locale}/dashboard`,
      locale,
    });
    const sent = await sendEmail({ to: email, ...message });
    if (!sent.ok) console.error("welcome email failed:", sent.error);
  }

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
  const redirectTo = `${siteUrl()}/${locale}/reset-password`;

  if (!isEmailConfigured()) {
    // No sender configured, so Supabase's own mail is the only route.
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return { error: error.message };
    return;
  }

  // generateLink mints the recovery link without Supabase mailing its own
  // copy, which puts the delivery on Resend and the wording on us.
  const admin = createAdminClient();
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  // An address with no account must look exactly like one that has an account,
  // or this page becomes a way to ask whether somebody is a customer.
  if (error || !link?.properties?.action_link) {
    console.error("reset link failed:", error?.message ?? "no action link");
    return;
  }

  const sent = await sendEmail({
    to: email,
    ...passwordResetEmail({ resetLink: link.properties.action_link, locale }),
  });
  if (!sent.ok) console.error("reset email failed:", sent.error);
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
