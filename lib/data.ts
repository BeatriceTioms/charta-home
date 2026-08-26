/**
 * The shapes the dashboard renders, and the small helpers that format them.
 *
 * The seeded portfolio that used to live here is gone: every screen now reads
 * the signed in agency's own rows through `lib/supabase/adapters.ts`.
 */

export type RentStatus = "paid" | "pending" | "overdue";
export type TicketStatus = "new" | "assigned" | "in-progress" | "resolved";

export type Payment = {
  month: string;
  amount: number;
  paidOn: string | null;
  status: RentStatus;
  /** The payment that settled this period, when one did. */
  paymentId?: string;
  /** Signed URL of the slip behind it, when the agency attached one. */
  proof?: string;
};

/**
 * One payment as it was received, rather than one period as it was billed.
 *
 * A tenant handing over six months is a single transaction that settles six
 * charges, and a receipt is written against the transaction. Keeping the two
 * shapes separate is what lets a receipt say which months it covers instead of
 * naming one and hoping.
 */
export type PaymentRecord = {
  id: string;
  amount: number;
  /** ISO, as recorded. The receipt formats it for reading. */
  paidOn: string;
  method: string;
  reference: string;
  /** Signed URL of the deposit slip or transfer screenshot. */
  proof?: string;
  /** Every period this payment settled, oldest first. */
  periods: string[];
};

export type ApartmentPhoto = {
  id: string;
  src: string;
  caption?: string;
  /** Storage object path, present once the photo lives in Supabase Storage. */
  path?: string;
};

export type Technician = {
  id: string;
  name: string;
  trade: string;
  phone: string;
  isExternal: boolean;
  since: string;
};

/**
 * How often the rent falls due. These are the values of the `lease_cycle`
 * enum in Postgres, so the two must be changed together.
 */
export type LeaseCycle = "daily" | "monthly" | "quarterly" | "semester" | "yearly";

/** The translated name of a cycle, from any dictionary section that carries all three. */
export function cycleLabel(
  cycle: LeaseCycle,
  labels: { daily: string; monthly: string; quarterly: string; semester: string; yearly: string }
): string {
  return labels[cycle] ?? labels.monthly;
}

export type Apartment = {
  id: string;
  /** The active lease behind this unit, needed to record a payment live. */
  leaseId?: string;
  /** The tenant's own row, which is where a name or number is corrected. */
  residentId?: string;
  /** ISO start of the active lease. Closing one cannot predate it. */
  leaseStartsOn?: string;
  /** What was actually received, for receipts. Newest first. */
  receipts?: PaymentRecord[];
  photos?: ApartmentPhoto[];
  label: string;
  rooms: number;
  bathrooms: number;
  sqm: number;
  rent: number;
  cycle: LeaseCycle;
  tenant?: { name: string; phone: string; since: string; until?: string };
  rentStatus: RentStatus;
  netYield: number;
  payments: Payment[];
};

export type Building = {
  id: string;
  name: string;
  address: string;
  city: string;
  /** Signed URL for display, empty when the agency has not uploaded one. */
  photo: string;
  /** Storage object path, needed to replace or delete the photo. */
  photoPath?: string;
  interior: string;
  amenities: string[];
  incomeYtd: number;
  expensesYtd: number;
  netYield: number;
  apartments: Apartment[];
};

export type Ticket = {
  /** Short display reference, T-1042 in the mock, T-5DDBC5 live. */
  id: string;
  /** The row's real uuid, absent on mock data. Server writes address this. */
  dbId?: string;
  description?: string;
  priority?: "normal" | "high" | "urgent";
  technicianId?: string;
  title: string;
  buildingId: string;
  apartment: string;
  status: TicketStatus;
  reportedVia: "whatsapp" | "phone" | "email";
  assignee?: string;
  tenant?: string;
  cost?: number;
  openedOn: string;
  daysOpen: number;
  month: string;
  year: number;
};

/* six months of collections for the overview chart */
/**
 * Guinean francs. No subunit exists, so never any decimals, and the grouping
 * follows French convention because that is the language of the market.
 */
/**
 * Currencies with no minor unit. Showing "1 200 000,00 GNF" would be wrong,
 * not merely noisy: a franc guinéen has no hundredths to show.
 */
const ZERO_DECIMAL = new Set(["GNF", "XOF", "XAF", "JPY", "KRW", "RWF", "UGX", "VND", "CLP", "KMF", "DJF"]);

/**
 * Money, in the agency's own currency.
 *
 * The agency chooses its currency at signup and can change it in settings, so
 * nothing here may assume Guinea. Grouping follows French convention because
 * that is the interface language; the code is placed after the amount, which
 * is how it is written in francophone West Africa.
 */
export function formatMoney(amount: number, currency = "GNF"): string {
  const code = (currency || "GNF").toUpperCase();
  const digits = ZERO_DECIMAL.has(code) ? 0 : 2;
  const value = amount.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  // Narrow no break spaces render inconsistently, and an amount should never
  // split across a line.
  return `${value.replace(/\u202f/g, "\u00a0")}\u00a0${code}`;
}

/**
 * The agency issuing receipts. Demo values today, read from the agencies row
 * once a live Supabase project is connected.
 */
/**
 * The fields a printed receipt needs that agencies does not yet carry a
 * column for (street address, registration number, a contact email). Name,
 * city, country and phone are overridden with the real agency once one is
 * signed in; these four stay as sensible defaults either way.
 */
export const agencyDefaults = {
  name: "Horizon Realty",
  address: "Immeuble Kakimbo, Quartier de la Corniche",
  city: "Conakry",
  country: "Guinée",
  phone: "+224 620 00 00 00",
  email: "contact@horizonrealty.gn",
  registration: "RCCM/GC KAL/2024 B 01842",
};

const MONTH_KEYS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Turns a "Aug 2026" rent period into a sortable number. */
export const periodValue = (period: string) => {
  const [m, y] = period.split(" ");
  return Number(y) * 12 + MONTH_KEYS.indexOf(m);
};

/**
 * A short human reference for a row. Ids are uuids once the data is real, and
 * a uuid printed in a table cell is unreadable, so show its leading block.
 */
export const shortRef = (id: string) => id.replace(/-/g, "").slice(0, 8).toUpperCase();

/** Newest rent period first. */
export const byPeriodDesc = (a: Payment, b: Payment) =>
  periodValue(b.month) - periodValue(a.month);

/**
 * Payment dates are stored as "2 Jul" with the year living on the period, so
 * they need stitching back together before any Date can read them.
 */
export const isoPaidOn = (paidOn: string | null, period: string) => {
  if (!paidOn) return "";
  const [day, mon] = paidOn.split(" ");
  const index = MONTH_KEYS.indexOf(mon);
  if (index < 0) return "";
  const year = period.split(" ")[1];
  return `${year}-${String(index + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
};

/** Turns a ticket's "28 Jul" plus its year into a sortable number. */
export const ticketValue = (t: Ticket) => {
  const [day, mon] = t.openedOn.split(" ");
  return t.year * 10000 + (MONTH_KEYS.indexOf(mon) + 1) * 100 + Number(day);
};

/** Most recently opened ticket first. */
export const byOpenedDesc = (a: Ticket, b: Ticket) => ticketValue(b) - ticketValue(a);

export type ActivityItem = {
  buildingId: string;
  time: string;
  title: string;
  detail: string;
  kind: "viewing" | "work" | "inspection" | "other";
  who: string;
};

