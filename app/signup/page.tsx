"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { COUNTRIES } from "@/lib/countries";
import {
  AuthHeading,
  PasswordField,
  SubmitButton,
  TextField,
} from "@/components/auth/fields";

export default function SignupPage() {
  const router = useRouter();
  return (
    <AuthShell
      quote="We manage 9 buildings across two cities. Charta Home is the first tool that shows the owners exactly what their properties earn."
      author="Karim D., Managing Partner, Atlas Properties"
    >
      <AuthHeading
        title="Start your free trial"
        subtitle="One month free, full access, no credit card required."
      />
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          // TODO: wire up authentication backend
          router.push("/dashboard");
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Full name"
            name="name"
            placeholder="Amina Sow"
            autoComplete="name"
          />
          <TextField
            label="Agency name"
            name="agency"
            placeholder="Horizon Realty"
            autoComplete="organization"
          />
        </div>
        <TextField
          label="Work email"
          type="email"
          name="email"
          placeholder="you@agency.com"
          autoComplete="email"
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-azure-800">Country</span>
            <select
              name="country"
              required
              defaultValue="Guinea"
              className="w-full rounded-2xl border border-azure-800/15 bg-white px-4 py-3 text-[15px] text-onyx outline-none transition focus:border-azure-600 focus:ring-4 focus:ring-azure-600/10"
            >
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <TextField
            label="City"
            name="city"
            placeholder="Conakry"
            autoComplete="address-level2"
          />
        </div>
        <PasswordField
          label="Create password"
          autoComplete="new-password"
          hint="At least 8 characters."
        />
        <SubmitButton>Create my account</SubmitButton>
        <p className="text-center text-xs leading-relaxed text-onyx/45">
          By signing up you agree to our{" "}
          <Link href="#" className="underline hover:text-azure-800">Terms of service</Link>{" "}
          and{" "}
          <Link href="#" className="underline hover:text-azure-800">Privacy policy</Link>.
        </p>
      </form>

      <p className="mt-8 text-center text-sm text-onyx/55">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-azure-600 transition hover:text-azure-800"
        >
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
