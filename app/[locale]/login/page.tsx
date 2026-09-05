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
} from "@/components/auth/fields";
import { useI18n } from "@/lib/i18n/context";
import { signIn } from "@/lib/supabase/auth-actions";
import { authErrorMessage } from "@/lib/auth-errors";

export default function LoginPage() {
  const { t, path, locale } = useI18n();
  const router = useRouter();
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [failure, setFailure] = useState<string>();
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    // Where the middleware turned them away from, so signing in lands there
    // rather than on the dashboard. Read at submit rather than at render, so
    // the page needs no client only bailout; the server checks it is a path
    // on this site before following it.
    const returnTo = new URLSearchParams(window.location.search).get("next");
    if (returnTo) data.set("next", returnTo);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = t.auth.login.errorEmail;
    if (password.length < 8) next.password = t.auth.login.errorPassword;
    setErrors(next);
    setFailure(undefined);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    // On success the server action redirects, so nothing after it runs.
    const result = await signIn(locale, data);

    if (result?.demo) {
      // No Supabase project yet: keep the walkthrough usable.
      try {
        localStorage.setItem("charta-session", JSON.stringify({ email }));
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
    <AuthShell>
      <AuthHeading title={t.auth.login.title} subtitle={t.auth.login.subtitle} />
      <form className="space-y-5" onSubmit={submit} noValidate>
        <TextField
          label={t.auth.login.email}
          type="email"
          name="email"
          placeholder={t.auth.login.emailPlaceholder}
          autoComplete="email"
          error={errors.email}
        />
        <div>
          <PasswordField label={t.auth.login.password} error={errors.password} />
          <div className="mt-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-onyx/60">
              <input
                type="checkbox"
                name="remember"
                defaultChecked
                className="h-4 w-4 rounded border-azure-800/20 accent-[#003152]"
              />
              {t.auth.login.remember}
            </label>
            <Link
              href={path("/forgot-password")}
              className="text-sm font-semibold text-azure-600 transition hover:text-azure-800"
            >
              {t.auth.login.forgot}
            </Link>
          </div>
        </div>
        {failure && (
          <p
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {failure}
          </p>
        )}
        <SubmitButton loading={loading}>
          {loading ? t.auth.login.submitting : t.auth.login.submit}
        </SubmitButton>
      </form>

      <p className="mt-8 text-center text-sm text-onyx/55">
        {t.auth.login.newHere}{" "}
        <Link
          href={path("/signup")}
          className="font-semibold text-azure-600 transition hover:text-azure-800"
        >
          {t.auth.login.startTrial}
        </Link>
      </p>
    </AuthShell>
  );
}
