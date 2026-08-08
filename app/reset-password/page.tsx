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

export default function ResetPasswordPage() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <AuthShell>
      {done ? (
        <SuccessPanel title="Password updated">
          <p>Your password has been changed. You can now log in with it.</p>
          <Link
            href="/login"
            className="mt-5 inline-block rounded-full bg-azure-800 px-8 py-3 text-sm font-semibold text-white transition hover:bg-azure-900"
          >
            Go to login
          </Link>
        </SuccessPanel>
      ) : (
        <>
          <AuthHeading
            title="Choose a new password"
            subtitle="Pick a strong password you haven't used before."
          />
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              if (data.get("password") !== data.get("confirm")) {
                setError("Passwords don't match.");
                return;
              }
              setError(null);
              // TODO: wire up password-reset backend (token from URL)
              setDone(true);
            }}
          >
            <PasswordField
              label="New password"
              name="password"
              autoComplete="new-password"
              hint="At least 8 characters."
            />
            <PasswordField
              label="Confirm new password"
              name="confirm"
              autoComplete="new-password"
            />
            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
                {error}
              </p>
            )}
            <SubmitButton>Update password</SubmitButton>
          </form>
        </>
      )}
    </AuthShell>
  );
}
