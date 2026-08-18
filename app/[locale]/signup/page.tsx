"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import {
  AuthHeading,
  PasswordField,
  SubmitButton,
  TextField,
  authInputCls,
} from "@/components/auth/fields";
import { COUNTRIES } from "@/lib/countries";
import { useI18n } from "@/lib/i18n/context";
import { signUp } from "@/lib/supabase/auth-actions";
import { authErrorMessage } from "@/lib/auth-errors";

export default function SignupPage() {
  const { t, path, locale } = useI18n();
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const agency = String(data.get("agency") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const city = String(data.get("city") ?? "").trim();
    const password = String(data.get("password") ?? "");

    const next: Record<string, string> = {};
    if (!name) next.name = t.auth.signup.errorName;
    if (!agency) next.agency = t.auth.signup.errorAgency;
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = t.auth.login.errorEmail;
    if (!city) next.city = t.auth.signup.errorCity;
    if (password.length < 8) next.password = t.auth.login.errorPassword;
    setErrors(next);
    setFailure(undefined);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    // On success the server action creates the agency and redirects.
    const result = await signUp(locale, data);

    if (result?.demo) {
      // No Supabase project yet: keep the walkthrough usable.
      try {
        localStorage.setItem("charta-session", JSON.stringify({ email, agency, name }));
      } catch {
        /* ignore */
      }
      router.push(path("/dashboard"));
      return;
    }

    if (result?.error) {
      setFailure(authErrorMessage(result.error, t));
      setLoading(false);
    }
  };

  return (
    <AuthShell variant="signup">
      <AuthHeading title={t.auth.signup.title} subtitle={t.auth.signup.subtitle} />
      <form className="space-y-5" onSubmit={submit} noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label={t.auth.signup.name}
            name="name"
            placeholder={t.auth.signup.namePlaceholder}
            autoComplete="name"
            error={errors.name}
          />
          <TextField
            label={t.auth.signup.agency}
            name="agency"
            placeholder={t.auth.signup.agencyPlaceholder}
            autoComplete="organization"
            error={errors.agency}
          />
        </div>
        <TextField
          label={t.auth.signup.email}
          type="email"
          name="email"
          placeholder={t.auth.signup.emailPlaceholder}
          autoComplete="email"
          error={errors.email}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-azure-800">
              {t.auth.signup.country}
            </span>
            <select name="country" defaultValue="Guinea" className={authInputCls}>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <TextField
            label={t.auth.signup.city}
            name="city"
            placeholder={t.auth.signup.cityPlaceholder}
            autoComplete="address-level2"
            error={errors.city}
          />
        </div>
        <PasswordField
          label={t.auth.signup.password}
          autoComplete="new-password"
          hint={t.auth.signup.passwordHint}
          error={errors.password}
        />
        {failure && (
          <p
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {failure}
          </p>
        )}
        <SubmitButton loading={loading}>
          {loading ? t.auth.signup.submitting : t.auth.signup.submit}
        </SubmitButton>
        <p className="text-center text-xs leading-relaxed text-onyx/45">
          {t.auth.signup.terms}{" "}
          <Link href={path("/contact")} className="underline hover:text-azure-800">
            {t.auth.signup.termsLink}
          </Link>{" "}
          {t.auth.signup.and}{" "}
          <Link href={path("/contact")} className="underline hover:text-azure-800">
            {t.auth.signup.privacyLink}
          </Link>
          .
        </p>
      </form>

      <p className="mt-8 text-center text-sm text-onyx/55">
        {t.auth.signup.haveAccount}{" "}
        <Link
          href={path("/login")}
          className="font-semibold text-azure-600 transition hover:text-azure-800"
        >
          {t.auth.signup.login}
        </Link>
      </p>
    </AuthShell>
  );
}
