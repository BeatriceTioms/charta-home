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

export default function LoginPage() {
  const { t, path } = useI18n();
  const router = useRouter();
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = t.auth.login.errorEmail;
    if (password.length < 8) next.password = t.auth.login.errorPassword;
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      localStorage.setItem("charta-session", JSON.stringify({ email }));
    } catch {
      /* ignore */
    }
    router.push(path("/dashboard"));
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
