"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import {
  AuthHeading,
  PasswordField,
  SubmitButton,
  SuccessPanel,
} from "@/components/auth/fields";
import { useI18n } from "@/lib/i18n/context";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

/**
 * Where an invitation and a forgotten password both end up.
 *
 * The link carries its token in the URL fragment, which never reaches a
 * server, so the whole exchange happens in the browser: Supabase's client
 * reads the fragment, establishes a session from it, and that session is what
 * authorises the password being set. Nothing here is trusted to the form.
 */
type Stage = "checking" | "ready" | "invalid" | "done";

export default function ResetPasswordPage() {
  const { t, path, locale } = useI18n();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("checking");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // An invitation ends at the dashboard; a reset ends at the sign in page.
  const [isInvite, setIsInvite] = useState(false);
  // Whose password this link is for, taken from the token and checked again
  // at the moment of writing.
  const [tokenUserId, setTokenUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setStage("ready");
      return;
    }

    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("error_description") || hash.get("error")) {
      // An expired or already used link says so here rather than failing at
      // the moment somebody has typed a new password twice.
      setError(hash.get("error_description") ?? t.auth.reset.linkInvalid);
      setStage("invalid");
      return;
    }

    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");

    // The token in the link is the only thing that says whose password this
    // is. Relying on whatever session the browser already held meant that an
    // owner who was still signed in, opening an invitation on their own
    // machine, changed their own password instead of the colleague's. Nothing
    // in the page warned them, because from the client's point of view a
    // signed in user asking to change their password is a perfectly ordinary
    // request.
    if (!accessToken || !refreshToken) {
      setError(t.auth.reset.linkMissing);
      setStage("invalid");
      return;
    }

    setIsInvite(hash.get("type") === "invite" || hash.get("type") === "signup");

    const supabase = createClient();
    let cancelled = false;

    // setSession replaces any session already in this browser, so what happens
    // next belongs to the person the link was sent to and to nobody else.
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ data, error: sessionError }) => {
        if (cancelled) return;
        if (sessionError || !data.session) {
          setError(sessionError?.message ?? t.auth.reset.linkInvalid);
          setStage("invalid");
          return;
        }
        setTokenUserId(data.session.user.id);
        setStage("ready");
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
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

    if (!isSupabaseConfigured()) {
      setLoading(false);
      setStage("done");
      return;
    }

    const supabase = createClient();

    // Checked once more here, because between the link opening and the form
    // being submitted another tab could have signed in as somebody else and
    // replaced the stored session underneath this page.
    const { data: current } = await supabase.auth.getSession();
    if (!current.session || current.session.user.id !== tokenUserId) {
      setLoading(false);
      setError(t.auth.reset.sessionChanged);
      setStage("invalid");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    // The session is already live, so an invited colleague goes straight in
    // rather than being asked to sign in with a password set two seconds ago.
    if (isInvite) {
      router.replace(`/${locale}/dashboard`);
      router.refresh();
      return;
    }
    setStage("done");
  };

  if (stage === "checking") {
    return (
      <AuthShell>
        <AuthHeading title={t.auth.reset.title} subtitle={t.auth.reset.checking} />
      </AuthShell>
    );
  }

  if (stage === "invalid") {
    return (
      <AuthShell>
        <AuthHeading title={t.auth.reset.linkInvalidTitle} subtitle={error ?? t.auth.reset.linkInvalid} />
        <Link
          href={path("/forgot-password")}
          className="mt-5 inline-block rounded-full bg-azure-800 px-8 py-3 text-sm font-semibold text-white transition hover:bg-azure-900"
        >
          {t.auth.reset.requestAnother}
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {stage === "done" ? (
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
          <AuthHeading
            title={isInvite ? t.auth.reset.inviteTitle : t.auth.reset.title}
            subtitle={isInvite ? t.auth.reset.inviteSubtitle : t.auth.reset.subtitle}
          />
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
