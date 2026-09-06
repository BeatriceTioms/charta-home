"use client";

import { FX_CURRENCIES, type FxCurrency } from "@/lib/fx";

/** Three pills. The chosen one is the currency every converted figure reads in. */
export function CurrencyToggle({
  value,
  onChange,
}: {
  value: FxCurrency;
  onChange: (next: FxCurrency) => void;
}) {
  return (
    <div role="radiogroup" className="inline-flex rounded-full border border-azure-900/15 p-0.5 dark:border-white/15">
      {FX_CURRENCIES.map((c) => {
        const on = c === value;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(c)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
              on
                ? "bg-onyx text-white dark:bg-soft-500 dark:text-azure-950"
                : "text-onyx/55 hover:text-azure-950 dark:text-white/50 dark:hover:text-white"
            }`}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}
