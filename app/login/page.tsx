"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import {
  AuthHeading,
  PasswordField,
  SubmitButton,
  TextField,
} from "@/components/auth/fields";

export default function LoginPage() {
  const router = useRouter();
  return (
    <AuthShell>
      <AuthHeading
        title="Welcome back"
        subtitle="Log in to your agency workspace."
      />
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          // TODO: wire up authentication backend
          router.push("/dashboard");
        }}
      >
        <TextField
          label="Email address"
          type="email"
          name="email"
          placeholder="you@agency.com"
          autoComplete="email"
        />
        <div>
          <PasswordField />
          <div className="mt-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-onyx/60">
              <input
                type="checkbox"
                name="remember"
                className="h-4 w-4 rounded border-azure-800/20 accent-[#003152]"
              />
              Remember me
            </label>
            <Link
              href="/forgot-password"
              className="text-sm font-semibold text-azure-600 transition hover:text-azure-800"
            >
              Forgot password?
            </Link>
          </div>
        </div>
        <SubmitButton>Log in</SubmitButton>
      </form>

      <p className="mt-8 text-center text-sm text-onyx/55">
        New to Charta Home?{" "}
        <Link
          href="/signup"
          className="font-semibold text-azure-600 transition hover:text-azure-800"
        >
          Start your free month
        </Link>
      </p>
    </AuthShell>
  );
}
