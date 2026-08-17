"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";

export const authInputCls =
  "w-full rounded-2xl border border-azure-800/15 bg-white px-4 py-3 text-[15px] text-onyx outline-none transition placeholder:text-onyx/30 focus:border-azure-600 focus:ring-4 focus:ring-azure-600/10";

export function TextField({
  label,
  type = "text",
  name,
  placeholder,
  autoComplete,
  error,
  defaultValue,
}: {
  label: string;
  type?: string;
  name: string;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-azure-800">{label}</span>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        className={authInputCls}
      />
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

export function PasswordField({
  label,
  name = "password",
  autoComplete = "current-password",
  hint,
  error,
}: {
  label: string;
  name?: string;
  autoComplete?: string;
  hint?: string;
  error?: string;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-azure-800">{label}</span>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          placeholder="••••••••"
          className={`${authInputCls} pr-12`}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-onyx/40 transition hover:text-azure-800"
          aria-label={visible ? t.auth.hidePassword : t.auth.showPassword}
        >
          {visible ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24M1 1l22 22" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {error ? (
        <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>
      ) : (
        hint && <span className="mt-1.5 block text-xs text-onyx/45">{hint}</span>
      )}
    </label>
  );
}

export function SubmitButton({
  children,
  loading,
}: {
  children: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-full bg-azure-800 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-azure-800/20 transition hover:bg-azure-900 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-8">
      <h1 className="font-serif text-4xl font-medium tracking-tight text-azure-800">{title}</h1>
      <p className="mt-2 text-[15px] text-onyx/55">{subtitle}</p>
    </div>
  );
}

export function SuccessPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-azure-800/10 bg-white p-8 text-center shadow-xl shadow-azure-800/5">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-soft-200 text-azure-800">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
      <h2 className="mt-5 text-xl font-bold text-azure-800">{title}</h2>
      <div className="mt-2.5 text-sm leading-relaxed text-onyx/60">{children}</div>
    </div>
  );
}
