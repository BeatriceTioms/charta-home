"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import {
  AuthHeading,
  PasswordField,
  SubmitButton,
  SuccessPanel,
} from "@/components/auth/fields";
import { useI18n } from "@/lib/i18n/context";

export default function ResetPasswordPage() {
  const { t, path } = useI18n();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");

    if (password.length < 8) {
      setError(t.auth.login.errorPassword);
      return;
    }
    if (password !== confirm) {
      setError(t.auth.reset.mismatch);
      return;
    }
    setError(null);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setDone(true);
    }, 400);
  };

  return (
    <AuthShell>
      {done ? (
        <SuccessPanel title={t.auth.reset.successTitle}>
          <p>{t.auth.reset.successBody}</p>
          <Link
            href={path("/login")}
            className="mt-5 inline-block rounded-full bg-azure-800 px-8 py-3 text-sm font-semibold text-white transition hover:bg-azure-900"
          >
            {t.auth.reset.goToLogin}
          </Link>
        </SuccessPanel>
      ) : (
        <>
          <AuthHeading title={t.auth.reset.title} subtitle={t.auth.reset.subtitle} />
          <form className="space-y-5" onSubmit={submit} noValidate>
            <PasswordField
              label={t.auth.reset.password}
              name="password"
              autoComplete="new-password"
              hint={t.auth.signup.passwordHint}
            />
            <PasswordField
              label={t.auth.reset.confirm}
              name="confirm"
              autoComplete="new-password"
            />
            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
                {error}
              </p>
            )}
            <SubmitButton loading={loading}>
              {loading ? t.auth.reset.submitting : t.auth.reset.submit}
            </SubmitButton>
          </form>
        </>
      )}
    </AuthShell>
  );
}
