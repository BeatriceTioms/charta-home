/**
 * The pricing model.
 *
 * Five tiers, each a band of managed apartments, priced per country in the
 * currency people there actually pay in. This is the same table the database
 * seeds in `plan_prices`; the marketing page reads it from here so a visitor
 * sees prices before anything is loaded, and `pricing:check` holds the two
 * copies to each other so they cannot drift.
 *
 * A year is ten months for twelve, in both countries and every tier. Prices
 * are whole francs: GNF and XAF have no minor unit.
 *
 * Enterprise has no number. It is priced by conversation, which is why its
 * entries are null rather than large.
 */

export type PlanCode = "starter" | "growth" | "pro" | "business" | "enterprise";
export type BillingCycle = "monthly" | "annual";
export type PricingCountry = "Guinea" | "Cameroon";

export const PLAN_CODES: readonly PlanCode[] = ["starter", "growth", "pro", "business", "enterprise"];
export const PRICING_COUNTRIES: readonly PricingCountry[] = ["Guinea", "Cameroon"];
export const ANNUAL_MONTHS = 10;

/** How many apartments each tier covers. `max` null is no ceiling. */
export const PLAN_BANDS: Record<PlanCode, { min: number; max: number | null }> = {
  starter: { min: 1, max: 30 },
  growth: { min: 31, max: 50 },
  pro: { min: 51, max: 100 },
  business: { min: 101, max: 250 },
  enterprise: { min: 251, max: null },
};

export const PLAN_PRICES: Record<
  PricingCountry,
  { currency: string; monthly: Record<PlanCode, number | null> }
> = {
  Guinea: {
    currency: "GNF",
    monthly: { starter: 175000, growth: 450000, pro: 500000, business: 850000, enterprise: null },
  },
  Cameroon: {
    currency: "XAF",
    monthly: { starter: 12000, growth: 30000, pro: 50000, business: 55000, enterprise: null },
  },
};

/** The currency an agency in this country bills in. Anywhere else, dollars. */
export const CURRENCY_BY_COUNTRY: Record<string, string> = { Guinea: "GNF", Cameroon: "XAF" };
export const currencyFor = (country: string): string => CURRENCY_BY_COUNTRY[country] ?? "USD";

export const isPlanCode = (value: unknown): value is PlanCode =>
  typeof value === "string" && (PLAN_CODES as readonly string[]).includes(value);

export const isPricingCountry = (value: string): value is PricingCountry =>
  (PRICING_COUNTRIES as readonly string[]).includes(value);

/**
 * The list price, or null when there is none: Enterprise anywhere, and any
 * tier in a country without a list yet. Null is a quote, not free.
 */
export function priceFor(
  country: string,
  code: PlanCode,
  cycle: BillingCycle
): { currency: string; amount: number } | null {
  if (!isPricingCountry(country)) return null;
  const list = PLAN_PRICES[country];
  const monthly = list.monthly[code];
  if (monthly === null) return null;
  return { currency: list.currency, amount: cycle === "annual" ? monthly * ANNUAL_MONTHS : monthly };
}

/** The smallest tier that holds this many apartments. */
export function planForApartments(count: number): PlanCode {
  for (const code of PLAN_CODES) {
    const band = PLAN_BANDS[code];
    if (band.max === null || count <= band.max) return code;
  }
  return "enterprise";
}

/** The tier's name as it appears in mail, where there is no dictionary. */
export function planName(code: PlanCode, locale: string): string {
  if (code === "enterprise") return locale === "fr" ? "Entreprise" : "Enterprise";
  return code.charAt(0).toUpperCase() + code.slice(1);
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
