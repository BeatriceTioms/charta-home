"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./server";
import type { LeaseCycle, PaymentMethod, ReportChannel, TicketPriority } from "./types";

/**
 * Write helpers. Anything with an invariant goes through a Postgres function so
 * the rule holds no matter who calls it.
 */

type ActionResult = { ok: true } | { ok: false; error: string };

const revalidateDashboard = (locale: string) =>
  revalidatePath(`/${locale}/dashboard`, "layout");

export async function addApartment(
  locale: string,
  input: {
    buildingId: string;
    agencyId: string;
    label: string;
    rooms: number;
    bathrooms: number;
    sqm: number;
    baseRent: number;
  }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("apartments").insert({
    agency_id: input.agencyId,
    building_id: input.buildingId,
    label: input.label,
    rooms: input.rooms,
    bathrooms: input.bathrooms,
    sqm: input.sqm,
    base_rent: input.baseRent,
  });
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

export async function createLease(
  locale: string,
  input: {
    apartmentId: string;
    residentName: string;
    residentPhone: string;
    rent: number;
    cycle: LeaseCycle;
    startsOn: string;
    deposit?: number;
  }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_lease", {
    target_apartment: input.apartmentId,
    resident_name: input.residentName,
    resident_phone: input.residentPhone,
    rent: input.rent,
    cycle_in: input.cycle,
    starts_on_in: input.startsOn,
    deposit_in: input.deposit ?? 0,
  });
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

export async function recordPayment(
  locale: string,
  input: {
    leaseId: string;
    amount: number;
    method: PaymentMethod;
    paidOn: string;
    reference?: string;
  }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_payment", {
    target_lease: input.leaseId,
    payment_amount: input.amount,
    payment_method_in: input.method,
    paid_on_in: input.paidOn,
    reference_in: input.reference ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

export async function createTicket(
  locale: string,
  input: {
    agencyId: string;
    buildingId: string;
    apartmentId?: string | null;
    title: string;
    description?: string;
    reportedVia: ReportChannel;
    priority: TicketPriority;
  }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("tickets").insert({
    agency_id: input.agencyId,
    building_id: input.buildingId,
    apartment_id: input.apartmentId ?? null,
    title: input.title,
    description: input.description ?? null,
    reported_via: input.reportedVia,
    priority: input.priority,
  });
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

export async function assignTicket(
  locale: string,
  input: { ticketId: string; technicianId: string }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tickets")
    .update({ technician_id: input.technicianId, status: "assigned" })
    .eq("id", input.ticketId);
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}

export async function resolveTicket(
  locale: string,
  input: { ticketId: string; cost: number }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_ticket", {
    target_ticket: input.ticketId,
    final_cost: input.cost,
  });
  if (error) return { ok: false, error: error.message };
  revalidateDashboard(locale);
  return { ok: true };
}
