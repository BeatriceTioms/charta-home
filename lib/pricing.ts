/**
 * The pricing model.
 *
 * Three tiers, each a band of managed apartments, priced per country in the
 * currency people there actually pay in. This is the same table the database
 * seeds in `plan_prices`; the marketing page reads it from here so a visitor
 * sees prices before anything is loaded, and `pricing:check` holds the two
 * copies to each other so they cannot drift.
 *
 * A year is ten months for twelve, in both countries and every tier. Prices
 * are whole francs: GNF and XAF have no minor unit.
 *
 * The middle tier is called Professional in Guinea and Growth in Cameroon,
 * on the sheet and therefore here. One code, two names.
 */

export type PlanCode = "starter" | "growth" | "business";
export type BillingCycle = "monthly" | "annual";
export type PricingCountry = "Guinea" | "Cameroon";

export const PLAN_CODES: readonly PlanCode[] = ["starter", "growth", "business"];
export const PRICING_COUNTRIES: readonly PricingCountry[] = ["Guinea", "Cameroon"];
export const ANNUAL_MONTHS = 10;

/** How many apartments each tier covers. */
export const PLAN_BANDS: Record<PlanCode, { min: number; max: number }> = {
  starter: { min: 1, max: 30 },
  growth: { min: 31, max: 100 },
  business: { min: 101, max: 250 },
};

export const PLAN_PRICES: Record<
  PricingCountry,
  { currency: string; monthly: Record<PlanCode, number> }
> = {
  Guinea: {
    currency: "GNF",
    monthly: { starter: 175000, growth: 450000, business: 850000 },
  },
  Cameroon: {
    currency: "XAF",
    monthly: { starter: 12000, growth: 30000, business: 55000 },
  },
};

/** Where the sheet names a tier differently from its code. */
export const TIER_NAMES_BY_COUNTRY: Partial<Record<string, Partial<Record<PlanCode, string>>>> = {
  Guinea: { growth: "Professional" },
};

/**
 * The tier's name where the agency is. Falls back to the dictionary's name,
 * which is the code with a capital, so a country off the sheet reads fine.
 */
export function tierName(code: PlanCode, country: string, fallback: string): string {
  return TIER_NAMES_BY_COUNTRY[country]?.[code] ?? fallback;
}

/** The currency an agency in this country bills in. Anywhere else, dollars. */
export const CURRENCY_BY_COUNTRY: Record<string, string> = { Guinea: "GNF", Cameroon: "XAF" };
export const currencyFor = (country: string): string => CURRENCY_BY_COUNTRY[country] ?? "USD";

export const isPlanCode = (value: unknown): value is PlanCode =>
  typeof value === "string" && (PLAN_CODES as readonly string[]).includes(value);

export const isPricingCountry = (value: string): value is PricingCountry =>
  (PRICING_COUNTRIES as readonly string[]).includes(value);

/**
 * The list price, or null in a country without a list yet. Null is a quote,
 * not free.
 */
export function priceFor(
  country: string,
  code: PlanCode,
  cycle: BillingCycle
): { currency: string; amount: number } | null {
  if (!isPricingCountry(country)) return null;
  const list = PLAN_PRICES[country];
  const monthly = list.monthly[code];
  return { currency: list.currency, amount: cycle === "annual" ? monthly * ANNUAL_MONTHS : monthly };
}

/**
 * The smallest tier that holds this many apartments. Beyond the top band the
 * answer is the top tier, which the ceiling then refuses to add to; a parc
 * over two hundred and fifty is a conversation, not a tier.
 */
export function planForApartments(count: number): PlanCode {
  for (const code of PLAN_CODES) {
    if (count <= PLAN_BANDS[code].max) return code;
  }
  return "business";
}

/** The tier's name as it appears in mail, where there is no dictionary. */
export function planName(code: PlanCode, locale: string, country = ""): string {
  void locale;
  return tierName(code, country, code.charAt(0).toUpperCase() + code.slice(1));
}

/** What the dashboard knows about the agency's subscription. */
export type PlanInfo = {
  code: PlanCode;
  status: "trialing" | "active" | "past_due" | "cancelled";
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  /** From the catalogue. Null is no ceiling. */
  maxApartments: number | null;
  /** The most recent request still waiting for its payment, if any. */
  pending: {
    plan: PlanCode;
    cycle: BillingCycle;
    currency: string;
    amount: number | null;
    createdAt: string;
  } | null;
};
