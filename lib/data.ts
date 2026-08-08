export type RentStatus = "paid" | "pending" | "overdue";
export type TicketStatus = "new" | "assigned" | "in-progress" | "resolved";

export type Payment = {
  month: string;
  amount: number;
  paidOn: string | null;
  status: RentStatus;
};

export type Apartment = {
  id: string;
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
  title: string;
  buildingId: string;
  apartment: string;
  status: TicketStatus;
  reportedVia: "whatsapp" | "phone" | "email";
  assignee?: string;
  openedOn: string;
  daysOpen: number;
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
    incomeYtd: 128400,
    expensesYtd: 21750,
    netYield: 9.2,
    apartments: [
      {
        id: "a1", label: "Apt 1A", rooms: 3, bathrooms: 2, sqm: 92, rent: 1450, cycle: "monthly",
        tenant: { name: "Mariam Diallo", phone: "+1 555 014 2231", since: "Mar 2024" },
        rentStatus: "paid", netYield: 9.8, payments: history(1450),
      },
      {
        id: "a2", label: "Apt 1B", rooms: 2, bathrooms: 1, sqm: 68, rent: 1100, cycle: "monthly",
        tenant: { name: "Karim Osei", phone: "+1 555 014 8804", since: "Jan 2025" },
        rentStatus: "paid", netYield: 9.1, payments: history(1100),
      },
      {
        id: "a3", label: "Apt 2A", rooms: 3, bathrooms: 2, sqm: 95, rent: 1500, cycle: "yearly",
        tenant: { name: "Sofia Benali", phone: "+1 555 019 3327", since: "Sep 2023" },
        rentStatus: "pending", netYield: 8.9,
        payments: history(1500, ["paid", "paid", "paid", "paid", "paid", "pending"]),
      },
      {
        id: "a4", label: "Apt 2B", rooms: 1, bathrooms: 1, sqm: 44, rent: 780, cycle: "monthly",
        tenant: { name: "Jonas Petit", phone: "+1 555 016 7719", since: "Jun 2025" },
        rentStatus: "overdue", netYield: 8.2,
        payments: history(780, ["paid", "paid", "paid", "overdue", "paid", "overdue"]),
      },
      {
        id: "a5", label: "Apt 3A", rooms: 4, bathrooms: 3, sqm: 120, rent: 1950, cycle: "yearly",
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
    incomeYtd: 96200,
    expensesYtd: 24900,
    netYield: 7.6,
    apartments: [
      {
        id: "a1", label: "Apt 101", rooms: 2, bathrooms: 1, sqm: 70, rent: 1200, cycle: "monthly",
        tenant: { name: "Awa Traoré", phone: "+1 555 021 5540", since: "Nov 2024" },
        rentStatus: "paid", netYield: 7.9, payments: history(1200),
      },
      {
        id: "a2", label: "Apt 102", rooms: 2, bathrooms: 1, sqm: 72, rent: 1250, cycle: "monthly",
        tenant: { name: "Daniel Mensah", phone: "+1 555 023 8812", since: "Feb 2024" },
        rentStatus: "overdue", netYield: 7.1,
        payments: history(1250, ["paid", "paid", "overdue", "paid", "paid", "overdue"]),
      },
      {
        id: "a3", label: "Apt 201", rooms: 3, bathrooms: 2, sqm: 88, rent: 1400, cycle: "yearly",
        tenant: { name: "Leïla Haddad", phone: "+1 555 027 3390", since: "Aug 2022" },
        rentStatus: "paid", netYield: 7.8, payments: history(1400),
      },
      {
        id: "a4", label: "Apt 202", rooms: 3, bathrooms: 2, sqm: 90, rent: 1420, cycle: "monthly",
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
    incomeYtd: 74800,
    expensesYtd: 9400,
    netYield: 11.8,
    apartments: [
      {
        id: "a1", label: "Garden Suite", rooms: 4, bathrooms: 3, sqm: 140, rent: 2400, cycle: "yearly",
        tenant: { name: "Nadia El Fassi", phone: "+1 555 031 6684", since: "Apr 2023" },
        rentStatus: "paid", netYield: 12.4, payments: history(2400),
      },
      {
        id: "a2", label: "Terrace Suite", rooms: 3, bathrooms: 2, sqm: 110, rent: 2100, cycle: "monthly",
        tenant: { name: "Omar Sy", phone: "+1 555 033 1108", since: "Oct 2024" },
        rentStatus: "paid", netYield: 11.6, payments: history(2100),
      },
      {
        id: "a3", label: "Court Suite", rooms: 2, bathrooms: 1, sqm: 80, rent: 1600, cycle: "monthly",
        tenant: { name: "Ines Barka", phone: "+1 555 037 9925", since: "Jul 2025" },
        rentStatus: "pending", netYield: 11.2,
        payments: history(1600, ["paid", "paid", "paid", "paid", "paid", "pending"]),
      },
    ],
  },
];

export const tickets: Ticket[] = [
  {
    id: "T-1042", title: "Water heater not heating", buildingId: "palmiers", apartment: "Apt 2A",
    status: "in-progress", reportedVia: "whatsapp", assignee: "B. Keita (plumber)",
    openedOn: "4 Aug", daysOpen: 4,
  },
  {
    id: "T-1041", title: "Front gate lock jammed", buildingId: "ocean", apartment: "Common area",
    status: "assigned", reportedVia: "whatsapp", assignee: "S. Diop (locksmith)",
    openedOn: "5 Aug", daysOpen: 3,
  },
  {
    id: "T-1040", title: "Kitchen tap leaking", buildingId: "palmiers", apartment: "Apt 1B",
    status: "new", reportedVia: "whatsapp",
    openedOn: "7 Aug", daysOpen: 1,
  },
  {
    id: "T-1039", title: "Balcony door seal worn", buildingId: "andalouse", apartment: "Terrace Suite",
    status: "resolved", reportedVia: "whatsapp", assignee: "M. Fall (carpenter)",
    openedOn: "28 Jul", daysOpen: 6,
  },
  {
    id: "T-1038", title: "Corridor light flickering", buildingId: "ocean", apartment: "Common area",
    status: "resolved", reportedVia: "phone", assignee: "A. Ndiaye (electrician)",
    openedOn: "25 Jul", daysOpen: 2,
  },
  {
    id: "T-1037", title: "Air conditioning service", buildingId: "andalouse", apartment: "Garden Suite",
    status: "in-progress", reportedVia: "email", assignee: "Coolair Services",
    openedOn: "1 Aug", daysOpen: 7,
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

export const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;

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
