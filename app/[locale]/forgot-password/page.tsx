"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import {
  AuthHeading,
  SubmitButton,
  SuccessPanel,
  TextField,
} from "@/components/auth/fields";
import { useI18n } from "@/lib/i18n/context";

export default function ForgotPasswordPage() {
  const { t, f, path } = useI18n();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(t.auth.login.errorEmail);
      return;
    }
    setError(undefined);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSentTo(email);
    }, 400);
  };

  return (
    <AuthShell>
      {sentTo ? (
        <SuccessPanel title={t.auth.forgot.successTitle}>
          <p>{f(t.auth.forgot.successBody, { email: sentTo })}</p>
          <p className="mt-4">
            {t.auth.forgot.notReceived}{" "}
            <button
              onClick={() => setSentTo(null)}
              className="font-semibold text-azure-600 underline transition hover:text-azure-800"
            >
              {t.auth.forgot.tryAgain}
            </button>
          </p>
        </SuccessPanel>
      ) : (
        <>
          <AuthHeading title={t.auth.forgot.title} subtitle={t.auth.forgot.subtitle} />
          <form className="space-y-5" onSubmit={submit} noValidate>
            <TextField
              label={t.auth.forgot.email}
              type="email"
              name="email"
              placeholder={t.auth.login.emailPlaceholder}
              autoComplete="email"
              error={error}
            />
            <SubmitButton loading={loading}>
              {loading ? t.auth.forgot.submitting : t.auth.forgot.submit}
            </SubmitButton>
          </form>
        </>
      )}

      <p className="mt-8 text-center text-sm text-onyx/55">
        {t.auth.forgot.remembered}{" "}
        <Link
          href={path("/login")}
          className="font-semibold text-azure-600 transition hover:text-azure-800"
        >
          {t.auth.forgot.backToLogin}
        </Link>
      </p>
    </AuthShell>
  );
}
