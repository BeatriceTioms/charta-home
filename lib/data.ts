export type RentStatus = "paid" | "pending" | "overdue";
export type TicketStatus = "new" | "assigned" | "in-progress" | "resolved";

export type Payment = {
  month: string;
  amount: number;
  paidOn: string | null;
  status: RentStatus;
};

export type ApartmentPhoto = { id: string; src: string; caption?: string };

export type Technician = {
  id: string;
  name: string;
  trade: string;
  phone: string;
  isExternal: boolean;
  since: string;
};

export type Apartment = {
  id: string;
  photos?: ApartmentPhoto[];
  label: string;
  rooms: number;
  bathrooms: number;
  sqm: number;
  rent: number;
  cycle: "monthly" | "yearly";
  tenant?: { name: string; phone: string; since: string };
  rentStatus: RentStatus;
  netYield: number;
  payments: Payment[];
};

export type Building = {
  id: string;
  name: string;
  address: string;
  city: string;
  photo: string;
  interior: string;
  amenities: string[];
  incomeYtd: number;
  expensesYtd: number;
  netYield: number;
  apartments: Apartment[];
};

export type Ticket = {
  id: string;
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

const history = (
  amounts: number,
  pattern: RentStatus[] = ["paid", "paid", "paid", "paid", "paid", "paid"]
): Payment[] => {
  const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  return months.map((m, i) => ({
    month: `${m} 2026`,
    amount: amounts,
    paidOn: pattern[i] === "paid" ? `2 ${m}` : null,
    status: pattern[i],
  }));
};

export const buildings: Building[] = [
  {
    id: "palmiers",
    name: "Résidence Les Palmiers",
    address: "14 Avenue des Palmiers",
    city: "Riverside District",
    photo: "/photos/building-1.jpg",
    interior: "/photos/interior-2.jpg",
    amenities: ["Rooftop terrace", "Secure parking", "Concierge desk", "Fibre internet"],
    incomeYtd: 128400000,
    expensesYtd: 21750000,
    netYield: 9.2,
    apartments: [
      {
        id: "a1", label: "Apt 1A", rooms: 3, bathrooms: 2, sqm: 92, rent: 1450000, cycle: "monthly",
        tenant: { name: "Mariam Diallo", phone: "+224 620 14 22 31", since: "Mar 2024" },
        rentStatus: "paid", netYield: 9.8, payments: history(1450000),
      },
      {
        id: "a2", label: "Apt 1B", rooms: 2, bathrooms: 1, sqm: 68, rent: 1100000, cycle: "monthly",
        tenant: { name: "Karim Osei", phone: "+224 620 14 88 04", since: "Jan 2025" },
        rentStatus: "paid", netYield: 9.1, payments: history(1100000),
      },
      {
        id: "a3", label: "Apt 2A", rooms: 3, bathrooms: 2, sqm: 95, rent: 1500000, cycle: "yearly",
        tenant: { name: "Sofia Benali", phone: "+224 620 19 33 27", since: "Sep 2023" },
        rentStatus: "pending", netYield: 8.9,
        payments: history(1500000, ["paid", "paid", "paid", "paid", "paid", "pending"]),
      },
      {
        id: "a4", label: "Apt 2B", rooms: 1, bathrooms: 1, sqm: 44, rent: 780000, cycle: "monthly",
        tenant: { name: "Jonas Petit", phone: "+224 620 16 77 19", since: "Jun 2025" },
        rentStatus: "overdue", netYield: 8.2,
        payments: history(780000, ["paid", "paid", "paid", "overdue", "paid", "overdue"]),
      },
      {
        id: "a5", label: "Apt 3A", rooms: 4, bathrooms: 3, sqm: 120, rent: 1950000, cycle: "yearly",
        rentStatus: "pending", netYield: 0, payments: [],
      },
    ],
  },
  {
    id: "ocean",
    name: "Immeuble Océan",
    address: "3 Boulevard de la Corniche",
    city: "Marina Quarter",
    photo: "/photos/building-4.jpg",
    interior: "/photos/interior-4.jpg",
    amenities: ["Sea view balconies", "Underground parking", "Backup generator"],
    incomeYtd: 96200000,
    expensesYtd: 24900000,
    netYield: 7.6,
    apartments: [
      {
        id: "a1", label: "Apt 101", rooms: 2, bathrooms: 1, sqm: 70, rent: 1200000, cycle: "monthly",
        tenant: { name: "Awa Traoré", phone: "+224 620 21 55 40", since: "Nov 2024" },
        rentStatus: "paid", netYield: 7.9, payments: history(1200000),
      },
      {
        id: "a2", label: "Apt 102", rooms: 2, bathrooms: 1, sqm: 72, rent: 1250000, cycle: "monthly",
        tenant: { name: "Daniel Mensah", phone: "+224 620 23 88 12", since: "Feb 2024" },
        rentStatus: "overdue", netYield: 7.1,
        payments: history(1250000, ["paid", "paid", "overdue", "paid", "paid", "overdue"]),
      },
      {
        id: "a3", label: "Apt 201", rooms: 3, bathrooms: 2, sqm: 88, rent: 1400000, cycle: "yearly",
        tenant: { name: "Leïla Haddad", phone: "+224 620 27 33 90", since: "Aug 2022" },
        rentStatus: "paid", netYield: 7.8, payments: history(1400000),
      },
      {
        id: "a4", label: "Apt 202", rooms: 3, bathrooms: 2, sqm: 90, rent: 1420000, cycle: "monthly",
        rentStatus: "pending", netYield: 0, payments: [],
      },
    ],
  },
  {
    id: "andalouse",
    name: "Villa Andalouse",
    address: "27 Rue des Jardins",
    city: "Garden Heights",
    photo: "/photos/building-2.jpg",
    interior: "/photos/interior-3.jpg",
    amenities: ["Private garden", "Swimming pool", "Fully equipped gym", "Guest parking"],
    incomeYtd: 74800000,
    expensesYtd: 9400000,
    netYield: 11.8,
    apartments: [
      {
        id: "a1", label: "Garden Suite", rooms: 4, bathrooms: 3, sqm: 140, rent: 2400000, cycle: "yearly",
        tenant: { name: "Nadia El Fassi", phone: "+224 620 31 66 84", since: "Apr 2023" },
        rentStatus: "paid", netYield: 12.4, payments: history(2400000),
      },
      {
        id: "a2", label: "Terrace Suite", rooms: 3, bathrooms: 2, sqm: 110, rent: 2100000, cycle: "monthly",
        tenant: { name: "Omar Sy", phone: "+224 620 33 11 08", since: "Oct 2024" },
        rentStatus: "paid", netYield: 11.6, payments: history(2100000),
      },
      {
        id: "a3", label: "Court Suite", rooms: 2, bathrooms: 1, sqm: 80, rent: 1600000, cycle: "monthly",
        tenant: { name: "Ines Barka", phone: "+224 620 37 99 25", since: "Jul 2025" },
        rentStatus: "pending", netYield: 11.2,
        payments: history(1600000, ["paid", "paid", "paid", "paid", "paid", "pending"]),
      },
    ],
  },
];

export const tickets: Ticket[] = [
  {
    id: "T-1042", title: "Water heater not heating", buildingId: "palmiers", apartment: "Apt 2A",
    status: "in-progress", reportedVia: "whatsapp", assignee: "B. Keita (plumber)",
    tenant: "Sofia Benali", openedOn: "4 Aug", daysOpen: 4, month: "Aug", year: 2026,
  },
  {
    id: "T-1041", title: "Front gate lock jammed", buildingId: "ocean", apartment: "Common area",
    status: "assigned", reportedVia: "whatsapp", assignee: "S. Diop (locksmith)",
    openedOn: "5 Aug", daysOpen: 3, month: "Aug", year: 2026,
  },
  {
    id: "T-1040", title: "Kitchen tap leaking", buildingId: "palmiers", apartment: "Apt 1B",
    status: "new", reportedVia: "whatsapp",
    tenant: "Karim Osei", openedOn: "7 Aug", daysOpen: 1, month: "Aug", year: 2026,
  },
  {
    id: "T-1037", title: "Air conditioning service", buildingId: "andalouse", apartment: "Garden Suite",
    status: "in-progress", reportedVia: "email", assignee: "Coolair Services",
    tenant: "Nadia El Fassi", openedOn: "1 Aug", daysOpen: 7, month: "Aug", year: 2026,
  },
  {
    id: "T-1039", title: "Balcony door seal worn", buildingId: "andalouse", apartment: "Terrace Suite",
    status: "resolved", reportedVia: "whatsapp", assignee: "M. Fall (carpenter)",
    tenant: "Omar Sy", cost: 85000, openedOn: "28 Jul", daysOpen: 6, month: "Jul", year: 2026,
  },
  {
    id: "T-1038", title: "Corridor light flickering", buildingId: "ocean", apartment: "Common area",
    status: "resolved", reportedVia: "phone", assignee: "A. Ndiaye (electrician)",
    cost: 30000, openedOn: "25 Jul", daysOpen: 2, month: "Jul", year: 2026,
  },
  {
    id: "T-1036", title: "Repaint stairwell", buildingId: "ocean", apartment: "Common area",
    status: "resolved", reportedVia: "phone", assignee: "M. Fall (carpenter)",
    cost: 260000, openedOn: "12 Jul", daysOpen: 5, month: "Jul", year: 2026,
  },
  {
    id: "T-1035", title: "Broken window latch", buildingId: "palmiers", apartment: "Apt 1A",
    status: "resolved", reportedVia: "whatsapp", assignee: "S. Diop (locksmith)",
    tenant: "Mariam Diallo", cost: 45000, openedOn: "18 Jun", daysOpen: 2, month: "Jun", year: 2026,
  },
  {
    id: "T-1030", title: "Boiler annual service", buildingId: "andalouse", apartment: "Garden Suite",
    status: "resolved", reportedVia: "email", assignee: "Coolair Services",
    tenant: "Nadia El Fassi", cost: 180000, openedOn: "9 Dec", daysOpen: 3, month: "Dec", year: 2025,
  },
  {
    id: "T-1029", title: "Gate motor replacement", buildingId: "ocean", apartment: "Common area",
    status: "resolved", reportedVia: "phone", assignee: "S. Diop (locksmith)",
    cost: 420000, openedOn: "22 Nov", daysOpen: 6, month: "Nov", year: 2025,
  },
];

/* six months of collections for the overview chart */
export const collections = [
  { month: "Mar", collected: 14200, due: 14950 },
  { month: "Apr", collected: 14950, due: 14950 },
  { month: "May", collected: 13700, due: 14950 },
  { month: "Jun", collected: 14170, due: 14950 },
  { month: "Jul", collected: 14950, due: 14950 },
  { month: "Aug", collected: 11020, due: 14950 },
];

/**
 * Guinean francs. No subunit exists, so never any decimals, and the grouping
 * follows French convention because that is the language of the market.
 */
export const fmt = (n: number) =>
  `${Math.round(n).toLocaleString("fr-FR").replace(/\u202f/g, "\u00a0")}\u00a0GNF`;

/**
 * The agency issuing receipts. Demo values today, read from the agencies row
 * once a live Supabase project is connected.
 */
export const agency = {
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

export const getBuilding = (id: string) => buildings.find((b) => b.id === id);

export const allApartments = () =>
  buildings.flatMap((b) => b.apartments.map((a) => ({ ...a, building: b })));

export const occupancy = () => {
  const all = buildings.flatMap((b) => b.apartments);
  const occupied = all.filter((a) => a.tenant).length;
  return { total: all.length, occupied, vacant: all.length - occupied };
};

export type ActivityItem = {
  buildingId: string;
  time: string;
  title: string;
  detail: string;
  kind: "viewing" | "work";
  who: string;
};

export const activity: ActivityItem[] = [
  { buildingId: "palmiers", time: "09:00", title: "Viewing", detail: "Apt 3A · 2 guests, doors to be unlocked", kind: "viewing", who: "KD" },
  { buildingId: "palmiers", time: "10:00", title: "Plumbing", detail: "Apt 2A · water heater intervention", kind: "work", who: "BK" },
  { buildingId: "palmiers", time: "11:30", title: "Viewing", detail: "Apt 3A · 3 guests", kind: "viewing", who: "FB" },
  { buildingId: "palmiers", time: "14:00", title: "Inspection", detail: "Common areas · quarterly walkthrough", kind: "work", who: "AS" },
  { buildingId: "ocean", time: "09:30", title: "Locksmith", detail: "Front gate · lock replacement", kind: "work", who: "SD" },
  { buildingId: "ocean", time: "11:00", title: "Viewing", detail: "Apt 202 · 2 guests", kind: "viewing", who: "KD" },
  { buildingId: "ocean", time: "15:00", title: "Cleaning", detail: "Stairwells and lobby", kind: "work", who: "FB" },
  { buildingId: "andalouse", time: "10:30", title: "Garden care", detail: "Weekly landscaping visit", kind: "work", who: "MF" },
  { buildingId: "andalouse", time: "16:00", title: "Viewing", detail: "Court Suite · returning applicant", kind: "viewing", who: "AS" },
];


export const technicians: Technician[] = [
  { id: "tech-1", name: "B. Keita", trade: "plumber", phone: "+224 620 40 00 01", isExternal: true, since: "Jan 2024" },
  { id: "tech-2", name: "S. Diop", trade: "locksmith", phone: "+224 620 40 00 02", isExternal: true, since: "Mar 2024" },
  { id: "tech-3", name: "M. Fall", trade: "carpenter", phone: "+224 620 40 00 03", isExternal: false, since: "Sep 2023" },
  { id: "tech-4", name: "A. Ndiaye", trade: "electrician", phone: "+224 620 40 00 04", isExternal: true, since: "Jun 2025" },
];

/** Photos each apartment starts with, keyed by building then apartment. */
export const seedPhotos: Record<string, string[]> = {
  default: ["/photos/interior-2.jpg", "/photos/interior-3.jpg", "/photos/interior-4.jpg"],
  /** One cover per unit, rotated so no two neighbouring apartments look alike. */
  covers: [
    "/photos/interior-2.jpg",
    "/photos/interior-3.jpg",
    "/photos/interior-4.jpg",
    "/photos/interior-1.jpg",
  ],
};
