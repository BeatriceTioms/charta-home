/**
 * Reference exchange rates, for reading one total across three currencies.
 *
 * These are not live. The XAF leg is a peg: 655.957 francs to the euro, fixed
 * since 1999, so only its dollar value moves, and slowly. The GNF leg floats.
 * Both are written down here with the date they were read, and shown with
 * that date wherever a converted figure appears, so nobody mistakes a
 * platform total for a bank statement. Update the two numbers and the date
 * together.
 *
 * Everything is expressed as francs per dollar, with the dollar at one, so
 * any pair converts through it.
 */
export type FxCurrency = "USD" | "XAF" | "GNF";

export const FX_CURRENCIES: readonly FxCurrency[] = ["GNF", "XAF", "USD"];

export const FX_AS_OF = "2026-09-01";

/** Units of each currency per one US dollar. */
export const FX_PER_USD: Record<FxCurrency, number> = {
  USD: 1,
  XAF: 605,
  GNF: 8650,
};

export const isFxCurrency = (value: string): value is FxCurrency =>
  (FX_CURRENCIES as readonly string[]).includes(value);

/**
 * Converts through the dollar and rounds to a whole unit, because every
 * currency here is spent in whole units.
 */
export function convert(amount: number, from: string, to: FxCurrency): number {
  const source = from.toUpperCase();
  if (!isFxCurrency(source)) return 0;
  if (source === to) return Math.round(amount);
  return Math.round((amount / FX_PER_USD[source]) * FX_PER_USD[to]);
}

/** "1 USD = 8 650 GNF = 605 XAF", the line printed beside a converted total. */
export function rateLine(): string {
  const fmt = (n: number) => n.toLocaleString("fr-FR").replace(/ /g, " ");
  return `1 USD = ${fmt(FX_PER_USD.GNF)} GNF = ${fmt(FX_PER_USD.XAF)} XAF`;
}
