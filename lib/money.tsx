"use client";

import { formatMoney } from "@/lib/data";
import { useStore } from "@/lib/store";

/**
 * Formats money in the signed in agency's currency.
 *
 * An agency picks its currency at signup and can change it in settings, so no
 * screen may hard code one. This reads it from the portfolio the layout
 * already loaded, which means changing it in settings changes every amount in
 * the product on the next render.
 */
export function useMoney() {
  const { agencyInfo } = useStore();
  const currency = agencyInfo?.currency ?? "GNF";
  return {
    currency,
    fmt: (amount: number) => formatMoney(amount, currency),
  };
}
