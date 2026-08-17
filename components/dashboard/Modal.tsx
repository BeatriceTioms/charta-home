"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/context";

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-onyx/60 p-5 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="my-auto w-full max-w-lg rounded-3xl border border-white/70 bg-white p-7 shadow-2xl dark:border-white/10 dark:bg-azure-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl font-medium text-azure-950 dark:text-white">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-sm text-onyx/55 dark:text-white/50">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={t.dash.common.close}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-onyx/40 transition hover:bg-azure-900/5 hover:text-azure-950 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-6">{children}</div>
        {footer && <div className="mt-7">{footer}</div>}
      </div>
    </div>
  );
}

/* shared form primitives for the modals */

export const fieldCls =
  "w-full rounded-2xl border border-azure-900/15 bg-white px-4 py-3 text-[15px] text-onyx outline-none transition placeholder:text-onyx/30 focus:border-azure-600 focus:ring-4 focus:ring-azure-600/10 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 dark:[&>option]:bg-onyx";

export function Field({
  label,
  children,
  error,
  hint,
  plain,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
  /** Renders a div rather than a label, for fields built from buttons. */
  plain?: boolean;
}) {
  const Wrapper = plain ? "div" : "label";
  return (
    <Wrapper className="block">
      <span className="mb-1.5 block text-sm font-semibold text-azure-800 dark:text-soft-500">
        {label}
      </span>
      {hint && (
        <span className="mb-2.5 block text-xs text-onyx/50 dark:text-white/45">{hint}</span>
      )}
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </Wrapper>
  );
}

export function ModalActions({
  onCancel,
  submitLabel,
  disabled,
}: {
  onCancel: () => void;
  submitLabel: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="flex gap-3">
      <button
        type="submit"
        disabled={disabled}
        className="flex-1 rounded-full bg-onyx py-3 text-sm font-semibold text-white transition hover:bg-azure-900 disabled:opacity-50 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
      >
        {submitLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-full border border-azure-900/15 px-6 py-3 text-sm font-semibold text-azure-800 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
      >
        {t.dash.common.cancel}
      </button>
    </div>
  );
}
