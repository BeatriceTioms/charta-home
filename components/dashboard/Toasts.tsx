"use client";

import { useStore } from "@/lib/store";

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[70] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          onClick={() => dismissToast(toast.id)}
          className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-white/20 bg-onyx px-5 py-4 text-left text-sm font-medium text-white shadow-2xl transition hover:bg-azure-900"
        >
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-soft-500 text-azure-950">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
          {toast.message}
        </button>
      ))}
    </div>
  );
}
