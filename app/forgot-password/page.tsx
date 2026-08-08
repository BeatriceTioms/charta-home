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

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);

  return (
    <AuthShell>
      {sentTo ? (
        <SuccessPanel title="Check your inbox">
          <p>
            If an account exists for <strong>{sentTo}</strong>, we&apos;ve sent
            a link to reset your password. The link expires in 30 minutes.
          </p>
          <p className="mt-4">
            Didn&apos;t get it?{" "}
            <button
              onClick={() => setSentTo(null)}
              className="font-semibold text-azure-600 underline transition hover:text-azure-800"
            >
              Try again
            </button>
          </p>
        </SuccessPanel>
      ) : (
        <>
          <AuthHeading
            title="Reset your password"
            subtitle="Enter your email and we'll send you a reset link."
          />
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              const email = new FormData(e.currentTarget).get("email");
              // TODO: wire up password-reset backend
              setSentTo(String(email));
            }}
          >
            <TextField
              label="Email address"
              type="email"
              name="email"
              placeholder="you@agency.com"
              autoComplete="email"
            />
            <SubmitButton>Send reset link</SubmitButton>
          </form>
        </>
      )}

      <p className="mt-8 text-center text-sm text-onyx/55">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-semibold text-azure-600 transition hover:text-azure-800"
        >
          Back to login
        </Link>
      </p>
    </AuthShell>
  );
}
